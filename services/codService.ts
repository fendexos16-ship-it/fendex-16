
import { 
  CodRecord, 
  CodDeposit, 
  CodState, 
  User, 
  UserRole,
  CashHandoverBatch,
  HandoverStatus,
  RiderExposure,
  CodAdjustment,
  CodWarning
} from '../types';
import { complianceService } from './complianceService';

const COD_RECORDS_KEY = 'fendex_cod_records_db';
const COD_DEPOSITS_KEY = 'fendex_cod_deposits_db';
const HANDOVERS_KEY = 'fendex_handovers_db';

const getRecordsDb = (): Record<string, CodRecord> => JSON.parse(localStorage.getItem(COD_RECORDS_KEY) || '{}');
const saveRecordsDb = (data: Record<string, CodRecord>) => localStorage.setItem(COD_RECORDS_KEY, JSON.stringify(data));

export const codService = {

  markCollected: async (awb: string, riderId: string, lmdcId: string, amount: number) => {
    const db = getRecordsDb();
    if (db[awb] && db[awb].state !== CodState.COD_PENDING) return; 

    db[awb] = {
      id: awb, 
      shipmentId: awb,
      riderId,
      lmdcId,
      codAmount: amount,
      state: CodState.COD_COLLECTED,
      collectedAt: new Date().toISOString()
    };
    saveRecordsDb(db);
  },

  getAllRecords: async (): Promise<Record<string, CodRecord>> => getRecordsDb(),

  /**
   * Added getStats method
   */
  getStats: async () => {
     const db = getRecordsDb();
     const records = Object.values(db);
     const deposits = JSON.parse(localStorage.getItem(COD_DEPOSITS_KEY) || '[]');
     return {
        collected: records.filter(r => r.state === CodState.COD_COLLECTED).reduce((s,r) => s + r.codAmount, 0),
        deposited: deposits.filter((d: any) => d.status === 'PENDING').reduce((s: number, d: any) => s + d.declaredAmount, 0),
        reconciled: deposits.filter((d: any) => d.status === 'SETTLED').reduce((s: number, d: any) => s + d.declaredAmount, 0),
        shortage: records.filter(r => r.state === CodState.COD_SHORT).reduce((s,r) => s + r.codAmount, 0)
     };
  },

  /**
   * Added getAllDeposits method
   */
  getAllDeposits: async (user: User): Promise<CodDeposit[]> => {
     return JSON.parse(localStorage.getItem(COD_DEPOSITS_KEY) || '[]');
  },

  reconcileDeposit: async (user: User, depositId: string, action: 'SETTLE' | 'REJECT') => {
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) {
        throw new Error('SECURITY BLOCK: Access Denied. Only Finance Department can reconcile cash.');
     }

     const deposits = JSON.parse(localStorage.getItem(COD_DEPOSITS_KEY) || '[]');
     const db = getRecordsDb();
     const idx = deposits.findIndex((d: any) => d.id === depositId);
     if (idx === -1) throw new Error('Deposit record not found');
     
     const deposit = deposits[idx];
     
     if (deposit.cod_locked) {
        throw new Error('HARD LOCK VIOLATION: This deposit is already reconciled and locked.');
     }

     if (action === 'SETTLE') {
        deposit.status = 'SETTLED';
        deposit.reconciledAt = new Date().toISOString();
        deposit.reconciledBy = user.id;
        deposit.cod_locked = true; 
        
        deposit.shipmentIds.forEach((id: string) => {
           if(db[id]) {
              db[id].state = CodState.COD_SETTLED;
              db[id].reconciledAt = new Date().toISOString();
           }
        });
     } else {
        deposit.status = 'MISMATCH';
     }

     localStorage.setItem(COD_DEPOSITS_KEY, JSON.stringify(deposits));
     saveRecordsDb(db);
     
     await complianceService.logEvent('COD_RECONCILED', user, `Finalized COD Reconciliation ${depositId}`, { 
       action,
       locked: true 
     });
  },

  /**
   * Added getPendingHandovers method
   */
  getPendingHandovers: async (lmdcId: string): Promise<CashHandoverBatch[]> => {
     const h = JSON.parse(localStorage.getItem(HANDOVERS_KEY) || '[]');
     return h.filter((batch: any) => batch.lmdcId === lmdcId && batch.status !== HandoverStatus.VERIFIED);
  },

  /**
   * Added getAllHandovers method
   */
  getAllHandovers: async (): Promise<CashHandoverBatch[]> => {
     return JSON.parse(localStorage.getItem(HANDOVERS_KEY) || '[]');
  },

  /**
   * Added getRiderExposures method
   */
  getRiderExposures: async (): Promise<RiderExposure[]> => {
     return []; // Simulation stub
  },

  /**
   * Added verifyHandoverBatch method
   */
  verifyHandoverBatch: async (user: User, id: string, amount: number): Promise<void> => {
     const h = JSON.parse(localStorage.getItem(HANDOVERS_KEY) || '[]');
     const idx = h.findIndex((b: any) => b.id === id);
     if (idx !== -1) {
        h[idx].status = HandoverStatus.VERIFIED;
        h[idx].physicalAmount = amount;
        localStorage.setItem(HANDOVERS_KEY, JSON.stringify(h));
     }
  },

  /**
   * Added getVerifiedRecords method
   */
  getVerifiedRecords: async (lmdcId: string): Promise<CodRecord[]> => {
     const db = getRecordsDb();
     return Object.values(db).filter(r => r.lmdcId === lmdcId && r.state === CodState.COD_VERIFIED);
  },

  /**
   * Added createCmsDeposit method
   */
  createCmsDeposit: async (user: User, data: any): Promise<void> => {
     const deposits = JSON.parse(localStorage.getItem(COD_DEPOSITS_KEY) || '[]');
     deposits.push({ ...data, id: 'DEP-' + Date.now(), status: 'PENDING', createdAt: new Date().toISOString() });
     localStorage.setItem(COD_DEPOSITS_KEY, JSON.stringify(deposits));
  },

  /**
   * Added getRiderHistory method
   */
  getRiderHistory: async (riderId: string): Promise<CodRecord[]> => {
     const db = getRecordsDb();
     return Object.values(db).filter(r => r.riderId === riderId);
  },

  /**
   * Added createHandoverBatch method
   */
  createHandoverBatch: async (user: User, ids: string[]): Promise<void> => {
     const db = getRecordsDb();
     const h = JSON.parse(localStorage.getItem(HANDOVERS_KEY) || '[]');
     const amount = ids.reduce((s, id) => s + (db[id]?.codAmount || 0), 0);
     h.push({
        id: 'CHB-' + Date.now(),
        riderId: user.id,
        lmdcId: user.linkedEntityId,
        shipmentIds: ids,
        declaredAmount: amount,
        status: HandoverStatus.CREATED,
        createdAt: new Date().toISOString()
     });
     localStorage.setItem(HANDOVERS_KEY, JSON.stringify(h));
  },

  /**
   * Added verifyRunsheetCash method
   */
  verifyRunsheetCash: async (user: User, rsId: string, riderId: string, ids: string[], amount: number): Promise<void> => {
     const db = getRecordsDb();
     ids.forEach(id => {
        if (db[id]) db[id].state = CodState.COD_VERIFIED;
     });
     saveRecordsDb(db);
  },

  /**
   * Added getAdjustments method
   */
  getAdjustments: async (user: User): Promise<CodAdjustment[]> => {
     return [];
  },

  /**
   * Added checkWarnings method
   */
  checkWarnings: async (): Promise<CodWarning[]> => {
     return [];
  }
};
