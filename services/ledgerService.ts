
import { 
  Shipment, 
  ShipmentStatus, 
  LmdcLedgerEntry, 
  RiderLedgerEntry, 
  LedgerStatus,
  User,
  UserRole,
  RiderJobType,
  LmdcShipmentType,
  LedgerEntry,
  PaymentMode,
  Runsheet
} from '../types';
import { rateCardService } from './rateCardService';
import { masterDataService } from './masterDataService';
import { complianceService } from './complianceService';

const LMDC_LEDGER_KEY = 'fendex_lmdc_ledger_db';
const RIDER_LEDGER_KEY = 'fendex_rider_ledger_db';

const getLmdcDb = (): LmdcLedgerEntry[] => {
  const stored = localStorage.getItem(LMDC_LEDGER_KEY);
  return stored ? JSON.parse(stored) : [];
};

const getRiderDb = (): RiderLedgerEntry[] => {
  const stored = localStorage.getItem(RIDER_LEDGER_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveLmdcDb = (data: LmdcLedgerEntry[]) => {
  localStorage.setItem(LMDC_LEDGER_KEY, JSON.stringify(data));
};

const saveRiderDb = (data: RiderLedgerEntry[]) => {
  localStorage.setItem(RIDER_LEDGER_KEY, JSON.stringify(data));
};

export const ledgerService = {

  // --- Core Calculation Logic ---

  generateEntries: async (shipment: Shipment): Promise<void> => {
    // Only generate for terminal statuses: DELIVERED, UNDELIVERED, RTO, CANCELLED
    if (![ShipmentStatus.DELIVERED, ShipmentStatus.UNDELIVERED, ShipmentStatus.RTO, ShipmentStatus.CANCELLED].includes(shipment.status)) {
      return;
    }

    let status: LedgerStatus;
    let isVoid = false;

    if (shipment.status === ShipmentStatus.DELIVERED) {
      status = LedgerStatus.OPEN;
    } else if (shipment.status === ShipmentStatus.RTO) {
      status = LedgerStatus.VOID;
      isVoid = true;
    } else {
      status = LedgerStatus.VOID;
      isVoid = true;
    }

    const paymentMode = shipment.paymentMode || PaymentMode.PREPAID;
    const codAmount = shipment.codAmount || 0;

    // 1. Generate LMDC Entry
    const lmdcDb = getLmdcDb();
    const existingLmdcIdx = lmdcDb.findIndex(l => l.shipmentId === shipment.awb);
    
    // IMMUTABILITY CHECK
    if (existingLmdcIdx !== -1) {
      const current = lmdcDb[existingLmdcIdx];
      if (current.ledgerStatus === LedgerStatus.APPROVED || 
          current.ledgerStatus === LedgerStatus.LOCKED || 
          current.ledgerStatus === LedgerStatus.PROCESSING || 
          current.ledgerStatus === LedgerStatus.PAID) {
        return; 
      }
    }

    const lmdcCalc = await rateCardService.calculatePreview({
      dcId: shipment.linkedDcId,
      lmdcId: shipment.linkedLmdcId,
      role: 'LMDC',
      geoType: shipment.geoType,
      type: shipment.shipmentType,
      status: shipment.status
    });

    const lmdcAmount = isVoid ? 0 : lmdcCalc.amount;

    const lmdcEntry: LmdcLedgerEntry = {
      id: existingLmdcIdx !== -1 ? lmdcDb[existingLmdcIdx].id : 'LLED-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      shipmentId: shipment.awb,
      dcId: shipment.linkedDcId,
      lmdcId: shipment.linkedLmdcId,
      shipmentType: shipment.shipmentType,
      shipmentStatus: shipment.status,
      appliedRate: lmdcAmount,
      calculatedAmount: lmdcAmount,
      ledgerStatus: status,
      paymentMode: paymentMode, 
      codAmount: codAmount,     
      createdAt: existingLmdcIdx !== -1 ? lmdcDb[existingLmdcIdx].createdAt : new Date().toISOString()
    };

    if (existingLmdcIdx !== -1) {
      lmdcDb[existingLmdcIdx] = lmdcEntry;
    } else {
      lmdcDb.unshift(lmdcEntry);
    }
    saveLmdcDb(lmdcDb);

    // 2. Rider Entries DISABLED here.
    // Strict Mode: Rider payout is generated per Runsheet Closure in createRunsheetLedger.
  },

  // --- Strict Rider Runsheet Ledger ---
  createRunsheetLedger: async (user: User, runsheet: Runsheet, amount: number) => {
     const db = getRiderDb();
     
     // Duplication Check (One Runsheet = One Record)
     if (db.some(l => l.runsheetId === runsheet.id)) {
        throw new Error(`Ledger already exists for Runsheet ${runsheet.runsheetCode}`);
     }

     const newEntry: RiderLedgerEntry = {
        id: `RLED-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        runsheetId: runsheet.id,
        shipmentId: runsheet.runsheetCode, // Display Runsheet Code in generic UI views
        riderId: runsheet.riderId,
        dcId: '', // Runsheet might not carry DC directly, or resolve via LMDC
        lmdcId: runsheet.lmdcId,
        jobType: runsheet.type === 'FWD' ? RiderJobType.DELIVERY : (runsheet.type === 'FM' ? RiderJobType.PICKUP : RiderJobType.REVERSE_PICKUP),
        shipmentStatus: ShipmentStatus.DELIVERED, // Virtual Status indicating Success
        appliedRate: amount, // Total calculated
        calculatedAmount: amount,
        ledgerStatus: LedgerStatus.OPEN,
        paymentMode: PaymentMode.PREPAID, // N/A for runsheet aggregator
        codAmount: 0,
        createdAt: new Date().toISOString()
     };

     db.unshift(newEntry);
     saveRiderDb(db);

     await complianceService.logEvent(
        'PAYOUT_GEN',
        user,
        `Generated Payout for Runsheet ${runsheet.runsheetCode}`,
        { amount, runsheetId: runsheet.id }
     );
  },

  // --- Retrieval Logic ---

  getLmdcLedgers: async (user: User): Promise<LmdcLedgerEntry[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const all = getLmdcDb();

    if (user.role === UserRole.FOUNDER || user.role === UserRole.FINANCE_ADMIN) return all;
    if (user.role === UserRole.AREA_MANAGER && user.linkedEntityId) return all.filter(l => l.dcId === user.linkedEntityId);
    if (user.role === UserRole.LMDC_MANAGER && user.linkedEntityId) return all.filter(l => l.lmdcId === user.linkedEntityId);
    return [];
  },

  getRiderLedgers: async (user: User): Promise<RiderLedgerEntry[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const all = getRiderDb();

    if (user.role === UserRole.FOUNDER || user.role === UserRole.FINANCE_ADMIN) return all;
    if (user.role === UserRole.AREA_MANAGER && user.linkedEntityId) return all.filter(l => l.dcId === user.linkedEntityId);
    if (user.role === UserRole.LMDC_MANAGER && user.linkedEntityId) return all.filter(l => l.lmdcId === user.linkedEntityId);
    if (user.role === UserRole.RIDER) return all.filter(r => r.riderId === user.id);
    return [];
  },

  // --- Actions ---

  approveLedger: async (user: User, ledgerId: string) => {
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) throw new Error("Unauthorized");
     const db = getRiderDb();
     const idx = db.findIndex(l => l.id === ledgerId);
     if (idx === -1) throw new Error("Ledger not found");
     
     if (db[idx].ledgerStatus !== LedgerStatus.OPEN) throw new Error("Only OPEN ledgers can be approved.");
     
     db[idx].ledgerStatus = LedgerStatus.APPROVED;
     saveRiderDb(db);
     await complianceService.logEvent('PAYOUT_OP', user, `Approved Payout ${ledgerId}`, {});
  },

  markPaid: async (user: User, ledgerId: string, ref: string, date: string) => {
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) throw new Error("Unauthorized");
     const db = getRiderDb();
     const idx = db.findIndex(l => l.id === ledgerId);
     if (idx === -1) throw new Error("Ledger not found");

     if (db[idx].ledgerStatus !== LedgerStatus.APPROVED) throw new Error("Must be APPROVED first.");
     if (!ref || !date) throw new Error("Transaction Reference and Date mandatory.");

     db[idx].ledgerStatus = LedgerStatus.PAID;
     db[idx].razorpayPayoutId = ref; // Storing generic ref here
     // Could add paidAt field if schema allowed, using createdAt or repurposing unused field
     saveRiderDb(db);
     await complianceService.logEvent('PAYOUT_OP', user, `Marked PAID ${ledgerId}`, { ref });
  },

  markOnHold: async (user: User, ledgerId: string, reason: string) => {
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) throw new Error("Unauthorized");
     if (!reason) throw new Error("Hold reason required.");
     
     const db = getRiderDb();
     const idx = db.findIndex(l => l.id === ledgerId);
     if (idx === -1) throw new Error("Ledger not found");

     db[idx].ledgerStatus = LedgerStatus.ON_HOLD;
     saveRiderDb(db);
     await complianceService.logEvent('PAYOUT_OP', user, `Held Payout ${ledgerId}`, { reason });
  },

  // --- Batch Update Logic (Existing for bulk runs if needed) ---

  approveLedgersForBatch: async (role: 'LMDC' | 'RIDER', ledgerIds: string[], batchId: string): Promise<void> => {
    if (role === 'LMDC') {
      const db = getLmdcDb();
      let updated = false;
      db.forEach(l => {
        if (ledgerIds.includes(l.id)) {
          l.ledgerStatus = LedgerStatus.LOCKED;
          l.payoutBatchId = batchId;
          updated = true;
        }
      });
      if (updated) saveLmdcDb(db);
    } else {
      const db = getRiderDb();
      let updated = false;
      db.forEach(l => {
        if (ledgerIds.includes(l.id)) {
          l.ledgerStatus = LedgerStatus.LOCKED;
          l.payoutBatchId = batchId;
          updated = true;
        }
      });
      if (updated) saveRiderDb(db);
    }
  },

  setProcessingStatus: async (role: 'LMDC' | 'RIDER', batchId: string): Promise<void> => {
    if (role === 'LMDC') {
      const db = getLmdcDb();
      let updated = false;
      db.forEach(l => {
        if (l.payoutBatchId === batchId) {
          l.ledgerStatus = LedgerStatus.PROCESSING;
          updated = true;
        }
      });
      if (updated) saveLmdcDb(db);
    } else {
      const db = getRiderDb();
      let updated = false;
      db.forEach(l => {
        if (l.payoutBatchId === batchId) {
          l.ledgerStatus = LedgerStatus.PROCESSING;
          updated = true;
        }
      });
      if (updated) saveRiderDb(db);
    }
  },

  finalizePayouts: async (
    role: 'LMDC' | 'RIDER', 
    batchId: string, 
    status: LedgerStatus.PAID | LedgerStatus.FAILED, 
    razorpayIdPrefix: string
  ): Promise<void> => {
    if (role === 'LMDC') {
      const db = getLmdcDb();
      let updated = false;
      db.forEach((l, idx) => {
        if (l.payoutBatchId === batchId) {
          l.ledgerStatus = status;
          if (status === LedgerStatus.PAID) {
            l.razorpayPayoutId = `${razorpayIdPrefix}_${idx}`;
          }
          updated = true;
        }
      });
      if (updated) saveLmdcDb(db);
    } else {
      const db = getRiderDb();
      let updated = false;
      db.forEach((l, idx) => {
        if (l.payoutBatchId === batchId) {
          l.ledgerStatus = status;
          if (status === LedgerStatus.PAID) {
            l.razorpayPayoutId = `${razorpayIdPrefix}_${idx}`;
          }
          updated = true;
        }
      });
      if (updated) saveRiderDb(db);
    }
  },

  getStats: (ledgers: LedgerEntry[]) => {
    return {
      open: ledgers.filter(l => l.ledgerStatus === LedgerStatus.OPEN)
                      .reduce((sum, l) => sum + l.calculatedAmount, 0),
      void: ledgers.filter(l => l.ledgerStatus === LedgerStatus.VOID).length,
      approved: ledgers.filter(l => l.ledgerStatus === LedgerStatus.APPROVED || l.ledgerStatus === LedgerStatus.LOCKED)
                   .reduce((sum, l) => sum + l.calculatedAmount, 0),
      processing: ledgers.filter(l => l.ledgerStatus === LedgerStatus.PROCESSING)
                         .reduce((sum, l) => sum + l.calculatedAmount, 0),
      paid: ledgers.filter(l => l.ledgerStatus === LedgerStatus.PAID)
                   .reduce((sum, l) => sum + l.calculatedAmount, 0),
    };
  }
};
