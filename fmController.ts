
import { Response } from 'express';
import { db, FieldValue } from './firebaseAdmin';
import { getTodayIST } from './dateUtils';
import { logFmAction } from './backendAuditService';
import { UserRole, FmStatus, ShipmentStatus } from './types';

export const fmController = {
  /**
   * RIDER: GET ASSIGNED TASKS
   */
  getRiderTasks: async (req: any, res: Response) => {
    const { user } = req;
    const today = getTodayIST();

    try {
      const snapshot = await db.collection('fm_pickups')
        .where('assigned_rider_id', '==', user.id)
        .where('pickup_date', '==', today)
        .where('status', 'in', [FmStatus.ASSIGNED_TO_RIDER, FmStatus.PICKED_UP])
        .get();

      const tasks = snapshot.docs.map(doc => doc.data());
      return res.json({ success: true, data: tasks });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * 1. CREATE FM PICKUP
   * Role: LMDC_MANAGER
   */
  create: async (req: any, res: Response) => {
    const { awb, seller_id, pickup_date } = req.body;
    const { user } = req;
    const today = getTodayIST();

    if (pickup_date !== today) {
      return res.status(400).json({ success: false, message: "FM Pickup allowed only for today" });
    }

    try {
      await db.runTransaction(async (transaction) => {
        const fmQuery = db.collection('fm_pickups').where('awb', '==', awb).limit(1);
        const shpQuery = db.collection('shipments').where('awb', '==', awb).limit(1);

        const [fmSnap, shpSnap] = await Promise.all([
          transaction.get(fmQuery),
          transaction.get(shpQuery)
        ]);

        if (!fmSnap.empty || !shpSnap.empty) {
          throw new Error("AWB already exists");
        }

        const fmId = `FM-${Date.now()}-${awb}`;
        const fmRef = db.collection('fm_pickups').doc(fmId);

        transaction.set(fmRef, {
          fm_id: fmId,
          awb,
          seller_id,
          origin_lmdc_id: user.linkedEntityId,
          status: FmStatus.FM_CREATED,
          pickup_date: today,
          created_at: FieldValue.serverTimestamp()
        });

        await logFmAction({
          userId: user.id,
          role: user.role,
          action: 'FM_CREATE',
          fmId,
          awb,
          lmdcId: user.linkedEntityId
        });
      });

      return res.status(201).json({ success: true, message: "FM Pickup initialized" });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * 2. ASSIGN FM TO RIDER
   * Role: LMDC_MANAGER
   */
  assign: async (req: any, res: Response) => {
    const { fm_id, rider_id } = req.body;
    const { user } = req;
    const today = getTodayIST();

    try {
      await db.runTransaction(async (transaction) => {
        const fmRef = db.collection('fm_pickups').doc(fm_id);
        const fmDoc = await transaction.get(fmRef);

        if (!fmDoc.exists) throw new Error("FM record not found");
        const fmData = fmDoc.data();

        const limitCheckSnapshot = await transaction.get(
          db.collection('fm_pickups')
            .where('assigned_rider_id', '==', rider_id)
            .where('pickup_date', '==', today)
            .where('status', 'in', [
              FmStatus.FM_CREATED,
              FmStatus.ASSIGNED_TO_RIDER,
              FmStatus.PICKED_UP
            ])
        );

        if (limitCheckSnapshot.size >= 2) {
          await logFmAction({
            userId: user.id,
            role: user.role,
            action: 'FM_ASSIGN_BLOCKED',
            fmId: fm_id,
            awb: fmData?.awb || 'N/A',
            lmdcId: user.linkedEntityId,
            details: { rider_id, reason: 'DAILY_LIMIT_EXCEEDED' }
          });
          throw new Error("Rider FM limit exceeded (2/day)");
        }

        if (fmData?.status !== FmStatus.FM_CREATED) throw new Error("Invalid status transition");

        transaction.update(fmRef, {
          status: FmStatus.ASSIGNED_TO_RIDER,
          assigned_rider_id: rider_id
        });

        await logFmAction({
          userId: user.id,
          role: user.role,
          action: 'FM_ASSIGN',
          fmId: fm_id,
          awb: fmData?.awb,
          lmdcId: user.linkedEntityId,
          details: { rider_id }
        });
      });

      return res.json({ success: true, message: "Rider assigned successfully" });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * 3. RIDER: START PICKUP
   */
  pickup: async (req: any, res: Response) => {
    const { fm_id } = req.body;
    const { user } = req;

    try {
      const fmRef = db.collection('fm_pickups').doc(fm_id);
      const fmDoc = await fmRef.get();
      const data = fmDoc.data();

      if (!fmDoc.exists) return res.status(404).json({ message: "FM not found" });
      
      if (data?.assigned_rider_id !== user.id) {
        return res.status(403).json({ message: "FM not assigned to this rider" });
      }

      if (data?.status !== FmStatus.ASSIGNED_TO_RIDER) {
        return res.status(400).json({ message: "FM not in assignable state" });
      }

      await fmRef.update({
        status: FmStatus.PICKED_UP,
        picked_up_at: FieldValue.serverTimestamp()
      });

      await logFmAction({
        userId: user.id,
        role: user.role,
        action: 'FM_PICKUP_EXECUTE',
        fmId: fm_id,
        awb: data.awb,
        lmdcId: data.origin_lmdc_id
      });

      return res.json({ success: true, message: "Custody transferred: PICKED_UP" });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * 4. RIDER: SUBMIT METADATA
   */
  submitMetadata: async (req: any, res: Response) => {
    const { fm_id, package_count, package_condition, photo_proof } = req.body;
    const { user } = req;

    try {
      const fmRef = db.collection('fm_pickups').doc(fm_id);
      const fmDoc = await fmRef.get();
      const data = fmDoc.data();

      if (!fmDoc.exists) return res.status(404).json({ message: "FM not found" });
      
      if (data?.assigned_rider_id !== user.id) {
        return res.status(403).json({ message: "Unauthorized metadata submission" });
      }

      if (data?.status !== FmStatus.PICKED_UP) {
        return res.status(400).json({ message: "Metadata capture requires PICKED_UP status" });
      }

      await fmRef.update({
        package_count,
        package_condition,
        photo_proof,
        metadata_captured_at: FieldValue.serverTimestamp()
      });

      await logFmAction({
        userId: user.id,
        role: user.role,
        action: 'FM_METADATA_SUBMIT',
        fmId: fm_id,
        awb: data.awb,
        lmdcId: data.origin_lmdc_id,
        details: { count: package_count, condition: package_condition }
      });

      return res.json({ success: true, message: "Pickup metadata saved" });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * 5. INBOUND RECEIPT AT LMDC
   * Role: LMDC_MANAGER
   */
  inbound: async (req: any, res: Response) => {
    const { fm_id, verified_count } = req.body;
    const { user } = req;

    try {
      await db.runTransaction(async (transaction) => {
        const fmRef = db.collection('fm_pickups').doc(fm_id);
        const fmDoc = await transaction.get(fmRef);
        const fmData = fmDoc.data();

        if (!fmDoc.exists) throw new Error("FM not found");
        if (fmData?.status !== FmStatus.PICKED_UP) throw new Error("Invalid status transition");

        transaction.update(fmRef, {
          status: FmStatus.INBOUND_RECEIVED_LMDC,
          verified_count,
          inbound_at: FieldValue.serverTimestamp()
        });

        const shipmentRef = db.collection('shipments').doc(fmData.awb);
        transaction.set(shipmentRef, {
          awb: fmData.awb,
          status: ShipmentStatus.INBOUND,
          origin_lmdc_id: fmData.origin_lmdc_id,
          current_lmdc_id: user.linkedEntityId,
          created_via: "FM_PICKUP",
          fm_reference: fm_id,
          created_at: FieldValue.serverTimestamp()
        });

        await logFmAction({
          userId: user.id,
          role: user.role,
          action: 'FM_INBOUND',
          fmId: fm_id,
          awb: fmData.awb,
          lmdcId: user.linkedEntityId
        });
      });

      return res.json({ success: true, message: "Inbound successful. Shipment birthed." });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * 6. CLOSE FM PICKUP
   * Role: LMDC_MANAGER
   */
  close: async (req: any, res: Response) => {
    const { fm_id } = req.body;
    const { user } = req;

    try {
      const fmRef = db.collection('fm_pickups').doc(fm_id);
      const fmDoc = await fmRef.get();
      const data = fmDoc.data();

      if (!fmDoc.exists) return res.status(404).json({ message: "FM not found" });
      
      if (data?.status !== FmStatus.INBOUND_RECEIVED_LMDC) {
        return res.status(400).json({ message: "Cannot close FM before inbound receipt" });
      }

      await fmRef.update({
        status: FmStatus.CLOSED,
        closed_at: FieldValue.serverTimestamp(),
        closed_by: user.id
      });

      await logFmAction({
        userId: user.id,
        role: user.role,
        action: 'FM_CLOSE',
        fmId: fm_id,
        awb: data.awb,
        lmdcId: user.linkedEntityId
      });

      return res.json({ success: true, message: "FM Pickup cycle closed and locked." });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }
};
