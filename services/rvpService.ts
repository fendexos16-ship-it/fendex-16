
import { RVP, RvpStatus, Runsheet as RvpRunsheet, Shipment, ShipmentStatus, User, UserRole, RunsheetStatus } from '../types';
import { complianceService } from './complianceService';
import { shipmentService } from './shipmentService';

const RVP_DB_KEY = 'fendex_rvp_db_v1';
const RVP_RUNSHEET_DB_KEY = 'fendex_rvp_runsheets_db_v1';

const getRvpDb = (): RVP[] => JSON.parse(localStorage.getItem(RVP_DB_KEY) || '[]');
const saveRvpDb = (db: RVP[]) => localStorage.setItem(RVP_DB_KEY, JSON.stringify(db));

const getRunsheetDb = (): RvpRunsheet[] => JSON.parse(localStorage.getItem(RVP_RUNSHEET_DB_KEY) || '[]');
const saveRunsheetDb = (db: RvpRunsheet[]) => localStorage.setItem(RVP_RUNSHEET_DB_KEY, JSON.stringify(db));

const getTodayIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset).toISOString().split('T')[0];
};

export const rvpService = {
  
  /**
   * CREATE RVP
   * Strictly enforced rules: DELIVERED/RTO only, no duplicates, today only.
   */
  createRvp: async (actor: User, awb: string, reasonCode: string): Promise<RVP> => {
    // Correct UserRole is LMDC_MANAGER
    if (actor.role !== UserRole.LMDC_MANAGER && actor.role !== UserRole.FOUNDER) {
      throw new Error('Unauthorized to create RVP.');
    }

    // Must pass actor to getShipments
    const shipments = await shipmentService.getShipments(actor);
    const shipment = shipments.find(s => s.awb === awb);

    // Filter statuses allowed for return
    if (!shipment || ![ShipmentStatus.DELIVERED, ShipmentStatus.RTO].includes(shipment.status)) {
      throw new Error("Reverse pickup not allowed for this shipment.");
    }

    const db = getRvpDb();
    if (db.some(r => r.awb === awb && r.status !== RvpStatus.CLOSED)) {
      throw new Error("An active RVP already exists for this shipment.");
    }

    const newRvp: RVP = {
      rvp_id: `RVP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      awb,
      reason_code: reasonCode,
      origin_lmdc_id: actor.linkedEntityId || 'LM-UNK',
      pickup_date: getTodayIST(),
      status: RvpStatus.RVP_CREATED,
      created_at: new Date().toISOString()
    };

    db.push(newRvp);
    saveRvpDb(db);

    await complianceService.logEvent('RVP_CREATED', actor, `RVP Created: ${newRvp.rvp_id}`, { reason: reasonCode });
    return newRvp;
  },

  /**
   * CREATE RVP RUNSHEET
   * Rule: Max 2 per rider per day. Separate from FWD.
   */
  createRvpRunsheet: async (actor: User, riderId: string, rvpIds: string[]): Promise<RvpRunsheet> => {
    if (actor.role !== UserRole.LMDC_MANAGER && actor.role !== UserRole.FOUNDER) {
      throw new Error('Unauthorized.');
    }

    const today = getTodayIST();
    const rsDb = getRunsheetDb();
    
    const riderTodayCount = rsDb.filter(rs => (rs as any).rider_id === riderId && (rs as any).date === today).length;
    if (riderTodayCount >= 2) {
      throw new Error("RIDER LIMIT BREACH: Max 2 RVP Runsheets per day allowed.");
    }

    const newRs: any = {
      id: `RS-RVP-${Date.now()}`,
      runsheetCode: `RVP-RS-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      lmdcId: actor.linkedEntityId || '',
      riderId: riderId,
      date: today,
      shipmentIds: rvpIds,
      type: 'RVP',
      status: RunsheetStatus.IN_PROGRESS,
      createdAt: new Date().toISOString(),
      createdBy: actor.id
    };

    rsDb.push(newRs);
    saveRunsheetDb(rsDb);

    const rvpDb = getRvpDb();
    rvpDb.forEach(r => {
      if (rvpIds.includes(r.rvp_id)) {
        r.status = RvpStatus.ASSIGNED_TO_RIDER;
        r.assigned_rider_id = riderId;
      }
    });
    saveRvpDb(rvpDb);

    await complianceService.logEvent('RVP_RS_CREATED', actor, `RVP Runsheet Created: ${newRs.id}`, { riderId, count: rvpIds.length });
    return newRs;
  },

  /**
   * RIDER EXECUTION: PICKED UP
   */
  markPickedUp: async (actor: User, rvpId: string, condition: string, photo?: string): Promise<void> => {
    const db = getRvpDb();
    const idx = db.findIndex(r => r.rvp_id === rvpId);
    if (idx === -1) throw new Error('RVP not found');

    const rvp = db[idx];
    if (rvp.status !== RvpStatus.ASSIGNED_TO_RIDER) throw new Error('Invalid state transition.');

    rvp.status = RvpStatus.PICKED_UP;
    rvp.package_condition = condition;
    rvp.photo_proof = photo;
    
    db[idx] = rvp;
    saveRvpDb(db);

    await complianceService.logEvent('RVP_PICKED_UP', actor, `RVP Picked Up: ${rvp.rvp_id}`, { condition });
  },

  /**
   * LMDC RECEIPT
   */
  inboundAtLmdc: async (actor: User, rvpId: string): Promise<void> => {
    const db = getRvpDb();
    const idx = db.findIndex(r => r.rvp_id === rvpId);
    if (idx === -1) throw new Error('RVP not found');

    const rvp = db[idx];
    if (rvp.status !== RvpStatus.PICKED_UP) throw new Error('Item must be Picked Up first.');

    rvp.status = RvpStatus.INBOUND_RECEIVED_LMDC;
    db[idx] = rvp;
    saveRvpDb(db);

    await complianceService.logEvent('RVP_INBOUND_LMDC', actor, `RVP Inbound @ Station: ${rvp.rvp_id}`, { lmdcId: actor.linkedEntityId });
  },

  /**
   * HANDOVER & CLOSE (IMMUTABLE)
   */
  closeRvp: async (actor: User, rvpId: string, action: 'HANDOVER' | 'CLOSE'): Promise<void> => {
    const db = getRvpDb();
    const idx = db.findIndex(r => r.rvp_id === rvpId);
    if (idx === -1) throw new Error('RVP not found');

    const rvp = db[idx];
    if (rvp.status === RvpStatus.CLOSED) throw new Error('RVP is already closed and immutable.');

    if (action === 'HANDOVER') {
       rvp.status = RvpStatus.HANDED_OVER;
       await complianceService.logEvent('RVP_HANDED_OVER', actor, `RVP Handover: ${rvp.rvp_id}`, {});
    } else {
       rvp.status = RvpStatus.CLOSED;
       await complianceService.logEvent('RVP_CLOSED', actor, `RVP Closed: ${rvp.rvp_id}`, {});
    }
    
    db[idx] = rvp;
    saveRvpDb(db);
  },

  getRvps: async (lmdcId?: string): Promise<RVP[]> => {
    const db = getRvpDb();
    if (lmdcId) return db.filter(r => r.origin_lmdc_id === lmdcId);
    return db;
  },

  getRiderRvps: async (riderId: string): Promise<RVP[]> => {
    const db = getRvpDb();
    return db.filter(r => r.assigned_rider_id === riderId && r.status === RvpStatus.ASSIGNED_TO_RIDER);
  }
};
