
import { ConnectionSheet, Bag, BagStatus, User, UserRole } from '../types';
import { complianceService } from './complianceService';
import { bagService } from './bagService';

const CS_KEY = 'fendex_connection_sheets_db';

const getDb = (): ConnectionSheet[] => {
  const stored = localStorage.getItem(CS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveDb = (data: ConnectionSheet[]) => {
  localStorage.setItem(CS_KEY, JSON.stringify(data));
};

export const connectionSheetService = {
  
  getSheets: async (mmdcId: string): Promise<ConnectionSheet[]> => {
    await new Promise(r => setTimeout(r, 200));
    const all = getDb();
    return all.filter(s => s.mmdcId === mmdcId);
  },

  create: async (user: User, mmdcId: string, destinationId: string, destinationType: 'LMDC' | 'DC' | 'MMDC' | 'RTO'): Promise<ConnectionSheet> => {
    const db = getDb();
    
    // Check for active sheet to same destination (CREATED or IN_PROGRESS)
    const existing = db.find(s => 
      s.mmdcId === mmdcId && 
      s.destinationId === destinationId && 
      (s.status === 'CREATED' || s.status === 'IN_PROGRESS')
    );
    
    if (existing) {
       throw new Error(`Active Connection Sheet (${existing.code}) already exists for this destination.`);
    }

    const code = `CS-${destinationId}-${Date.now().toString().slice(-4)}`;
    const newSheet: ConnectionSheet = {
       id: `CS-${Date.now()}`,
       code,
       mmdcId,
       destinationId,
       destinationType,
       bagIds: [],
       status: 'CREATED',
       createdBy: user.id,
       createdAt: new Date().toISOString()
    };

    db.unshift(newSheet);
    saveDb(db);
    
    await complianceService.logEvent('MMDC_SORT', user, `Created Connection Sheet ${code}`, { destination: destinationId, type: destinationType });
    return newSheet;
  },

  addBag: async (user: User, sheetId: string, bagCode: string): Promise<void> => {
     const db = getDb();
     const sheet = db.find(s => s.id === sheetId);
     if (!sheet) throw new Error('Connection Sheet not found');
     
     // 1. Check Sheet Status
     if (sheet.status !== 'CREATED' && sheet.status !== 'IN_PROGRESS') {
        throw new Error(`Sheet is ${sheet.status}. Cannot add bags. Must be CREATED or IN_PROGRESS.`);
     }

     // 2. Find Bag
     const bag = await bagService.getBagByCode(bagCode);
     if (!bag) throw new Error('Bag not found');

     // 3. Strict Bag State Check (Inbound Received Only)
     // Rule: "MMDC can create Connection Sheet ONLY if Bag_Status = INBOUND_RECEIVED" (and not exception marked)
     // Exception check: logic in bagService ensures separate status for Shortage/Damage.
     // Also allow 'CREATED' or 'SEALED' if the bag originated at this MMDC (Outbound creation flow)
     const isLocalOrigin = bag.originEntityId === sheet.mmdcId;
     const isValidStatus = 
        bag.status === BagStatus.INBOUND_RECEIVED || 
        (isLocalOrigin && (bag.status === BagStatus.CREATED || bag.status === BagStatus.SEALED));

     if (!isValidStatus) {
        throw new Error(`Bag ${bagCode} status is ${bag.status}. Must be INBOUND_RECEIVED (or locally CREATED) to connect.`);
     }

     if (bag.currentConnectionSheetId) {
        throw new Error(`Bag ${bagCode} already connected to ${bag.currentConnectionSheetId}`);
     }

     // 4. Update Bag Status
     await bagService.updateStatus(bag.id, BagStatus.CONNECTED, sheetId);

     // 5. Update Sheet
     sheet.bagIds.push(bag.id);
     sheet.status = 'IN_PROGRESS'; // State Transition
     saveDb(db);
     
     await complianceService.logEvent('MMDC_SORT', user, `Added Bag ${bagCode} to CS ${sheet.code}`, {});
  },

  close: async (user: User, sheetId: string) => {
     const db = getDb();
     const sheet = db.find(s => s.id === sheetId);
     if (!sheet) throw new Error('Sheet not found');
     
     // 6. Hard Stop Closure Rule
     if (sheet.bagIds.length === 0) throw new Error('Cannot close empty sheet');
     if (sheet.status === 'CLOSED') throw new Error('Sheet already CLOSED');
     if (sheet.status === 'DISPATCHED') throw new Error('Sheet already DISPATCHED');

     sheet.status = 'CLOSED';
     sheet.closedAt = new Date().toISOString();
     saveDb(db);

     await complianceService.logEvent('MMDC_SORT', user, `Closed Connection Sheet ${sheet.code}`, { bags: sheet.bagIds.length });
  },

  // Called by Trip Service on Dispatch
  markDispatched: async (sheetId: string) => {
     const db = getDb();
     const sheet = db.find(s => s.id === sheetId);
     if (sheet) {
        sheet.status = 'DISPATCHED';
        sheet.dispatchedAt = new Date().toISOString();
        saveDb(db);
     }
  }
};
