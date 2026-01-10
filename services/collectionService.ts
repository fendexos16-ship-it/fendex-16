
import { 
  CollectionRecord, 
  CollectionMode, 
  User, 
  UserRole,
  ReceivableStatus
} from '../types';
import { complianceService } from './complianceService';
import { billingService } from './billingService';
import { authService } from './authService';

const COLLECTION_KEY = 'fendex_collection_records_db';

const getDb = (): CollectionRecord[] => {
  const stored = localStorage.getItem(COLLECTION_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveDb = (data: CollectionRecord[]) => {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(data));
};

export const collectionService = {
  
  getHistory: async (receivableId?: string): Promise<CollectionRecord[]> => {
    await new Promise(r => setTimeout(r, 200));
    const all = getDb();
    if (receivableId) return all.filter(c => c.receivableId === receivableId);
    return all.sort((a,b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  },

  // Core Processing Unit
  processPayment: async (
    user: User, 
    receivableId: string, 
    amount: number, 
    mode: CollectionMode, 
    reference: string, 
    date: string,
    gatewayId?: string
  ): Promise<void> => {
    
    // 1. Security Check
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) {
      throw new Error('Unauthorized: Only Finance/Founder can record payments.');
    }

    // 2. Fetch Receivable State (via billingService which holds the source of truth)
    const receivables = await billingService.getReceivables();
    const rec = receivables.find(r => r.id === receivableId);
    
    if (!rec) throw new Error('Receivable not found.');
    if (rec.status === ReceivableStatus.DISPUTED) throw new Error('Cannot accept payment for DISPUTED receivable.');
    
    // 3. Validation
    if (amount <= 0) throw new Error('Invalid Amount');
    if (amount > rec.balance) throw new Error(`Overpayment. Balance is ₹${rec.balance}`);
    
    // Check Duplicate Reference (Idempotency)
    const db = getDb();
    if (db.some(c => c.reference === reference && c.status === 'SUCCESS')) {
       throw new Error(`Duplicate Transaction Reference: ${reference}`);
    }

    // 4. Create Record
    const record: CollectionRecord = {
       id: `COL-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
       receivableId,
       invoiceId: rec.invoiceId,
       clientId: rec.clientId,
       amount,
       mode,
       reference,
       date,
       status: 'SUCCESS',
       recordedBy: user.id,
       recordedAt: new Date().toISOString(),
       gatewayPaymentId: gatewayId
    };

    db.unshift(record);
    saveDb(db);

    // 5. Update Receivable & Invoice Status
    await billingService.recordPayment(user, receivableId, amount, reference);

    await complianceService.logEvent(
       'COLLECTION_OP',
       user,
       `Received ₹${amount} via ${mode}`,
       { recId: receivableId, ref: reference }
    );
  },

  // Reversal Logic
  reversePayment: async (user: User, collectionId: string, reason: string): Promise<void> => {
     authService.requireRole(user, UserRole.FOUNDER); // Strict Founder Only

     const db = getDb();
     const idx = db.findIndex(c => c.id === collectionId);
     if (idx === -1) throw new Error('Collection Record not found');
     
     const record = db[idx];
     if (record.status !== 'SUCCESS') throw new Error('Payment already reversed or failed.');

     // Revert Status
     record.status = 'REVERSED';
     saveDb(db);

     // Restore Balance (Negative payment effect)
     // We pass negative amount to recordPayment to increase balance back?
     // billingService.recordPayment logic subtracts amount from balance.
     // So passing negative amount adds to balance.
     await billingService.recordPayment(user, record.receivableId, -record.amount, `REVERSAL-${collectionId}`);

     await complianceService.logEvent(
        'COLLECTION_OP',
        user,
        `Reversed Payment ${collectionId}`,
        { reason, amount: record.amount }
     );
  }
};
