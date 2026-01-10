
import { Runsheet, RunsheetStatus, RunsheetType, User, ShipmentStatus, PickupStatus, LmdcShipmentType, PaymentMode, CodState, UserRole } from '../types';
import { complianceService } from './complianceService';
import { shipmentService } from './shipmentService';
import { codService } from './codService';
import { ledgerService } from './ledgerService';

const RUNSHEETS_KEY = 'fendex_runsheets_db';
const getDb = (): Runsheet[] => JSON.parse(localStorage.getItem(RUNSHEETS_KEY) || '[]');
const saveDb = (data: Runsheet[]) => localStorage.setItem(RUNSHEETS_KEY, JSON.stringify(data));

export const runsheetService = {
  
  /**
   * Added getRunsheets method
   */
  getRunsheets: async (lmdcId: string): Promise<Runsheet[]> => {
    const db = getDb();
    return db.filter(r => r.lmdcId === lmdcId);
  },

  /**
   * Added getRiderRunsheets method
   */
  getRiderRunsheets: async (riderId: string): Promise<Runsheet[]> => {
    const db = getDb();
    return db.filter(r => r.riderId === riderId && r.status !== RunsheetStatus.CLOSED);
  },

  createRunsheet: async (
    user: User, 
    lmdcId: string, 
    riderId: string, 
    items: string[], 
    type: RunsheetType
  ): Promise<Runsheet> => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const todayDrsCount = db.filter(r => 
      r.riderId === riderId && 
      r.createdAt.startsWith(today) && 
      r.status !== RunsheetStatus.ABANDONED
    ).length;

    if (todayDrsCount >= 4) {
      throw new Error(`RIDER DAILY DRS LIMIT BREACH: Max 4 DRS per day. Current: ${todayDrsCount}`);
    }

    const allShipments = await shipmentService.getShipments(user);
    if (type === 'FWD') {
        const targetShipments = allShipments.filter(s => items.includes(s.id));
        const ineligible = targetShipments.find(s => s.eligible_for_drs !== true);
        if (ineligible) {
           throw new Error(`CUSTODY BLOCK: Shipment ${ineligible.awb} is not marked eligible for DRS.`);
        }
        for (const s of targetShipments) {
           await shipmentService.updateStatus(s.id, ShipmentStatus.ASSIGNED, riderId);
        }
    } 

    const runsheetCode = `${type}-${Date.now().toString().slice(-6)}`;
    const newSheet: Runsheet = {
      id: `RS-${Date.now()}`,
      runsheetCode,
      type,
      lmdcId,
      riderId,
      shipmentIds: type === 'FWD' || type === 'RVP' ? items : [],
      pickupIds: type === 'FM' ? items : [],
      status: RunsheetStatus.CREATED,
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };

    db.unshift(newSheet);
    saveDb(db);
    await complianceService.logEvent('DRS_CREATED', user, `Created ${type} DRS ${runsheetCode}`, { rider: riderId });
    return newSheet;
  },

  closeRunsheet: async (user: User, runsheetId: string) => {
     const db = getDb();
     const rs = db.find(r => r.id === runsheetId);
     if (!rs) throw new Error('Runsheet not found');
     
     rs.status = RunsheetStatus.CLOSED;
     rs.closedAt = new Date().toISOString();
     saveDb(db);

     await complianceService.logEvent('DRS_CLOSED', user, `Closed DRS ${rs.runsheetCode}`, {});
  },

  /**
   * Added abandonRunsheet method
   */
  abandonRunsheet: async (user: User, id: string, reason: string): Promise<void> => {
     const db = getDb();
     const idx = db.findIndex(r => r.id === id);
     if (idx !== -1) {
        db[idx].status = RunsheetStatus.ABANDONED;
        db[idx].abandonedReason = reason;
        saveDb(db);
        await complianceService.logEvent('DRS_ABANDONED', user, `Abandoned DRS ${db[idx].runsheetCode}`, { reason });
     }
  }
};
