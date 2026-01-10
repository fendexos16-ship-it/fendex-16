
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
    const isInternal = user.role === UserRole.FOUNDER || user.role === UserRole.FINANCE_ADMIN;
    const isClientSelfPay = user.role === UserRole.CLIENT_VIEW && mode === CollectionMode.RAZORPAY;

    if (!isInternal && !isClientSelfPay) {
      throw new Error('Unauthorized: Only Finance can record manual payments. Clients must use Gateway.');
    }

    // 2. Fetch Receivable State (via billingService which holds the source of truth)
    const receivables = await billingService.getReceivables();
    const rec = receivables.find(r => r.id === receivableId);
    
    if (!rec) throw new Error('Receivable not found.');
    if (rec.status === ReceivableStatus.DISPUTED) throw new Error('Cannot accept payment for DISPUTED receivable.');
    
    // Client Self-Pay check: Must own the receivable
    if (isClientSelfPay && rec.clientId !== user.linkedEntityId) {
       throw new Error('Security Violation: Cannot pay for another client.');
    }

    // 3. Validation
    if (amount <= 0) throw new Error('Invalid Amount');
    // Allow slight tolerance for float math
    if (amount > rec.balance + 1) throw new Error(`Overpayment. Balance is ₹${rec.balance}`);
    
    // Check Duplicate Reference (Idempotency)
    const db = getDb();
    if (db.some(c => c.reference === reference && c.status === 'SUCCESS')) {
       // If client retries, just return success if already recorded
       if (isClientSelfPay) return; 
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
    // We pass the user context. billingService needs to trust this call from collectionService.
    // However, billingService.recordPayment checks for FOUNDER/FINANCE. 
    // We need to bypass that check or update billingService. 
    // Ideally, collectionService should be the only one calling billingService updates for payments.
    // For this implementation, we will use a System User proxy if it's a Client Self-Pay to satisfy strict RBAC in billingService.
    
    let actor = user;
    if (isClientSelfPay) {
       // Proxy as System for the update
       actor = { ...user, role: UserRole.FINANCE_ADMIN, id: 'SYSTEM_PAYMENT_GATEWAY' };
    }

    await billingService.recordPayment(actor, receivableId, amount, reference);

    await complianceService.logEvent(
       'COLLECTION_OP',
       user,
       `Received ₹${amount} via ${mode}`,
       { recId: receivableId, ref: reference, selfServe: isClientSelfPay }
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
     await billingService.recordPayment(user, record.receivableId, -record.amount, `REVERSAL-${collectionId}`);

     await complianceService.logEvent(
        'COLLECTION_OP',
        user,
        `Reversed Payment ${collectionId}`,
        { reason, amount: record.amount }
     );
  }
};
