
import { 
  CashfreeBeneficiary, 
  User, 
  UserRole, 
  PayoutBatch, 
  PaymentGateway, 
  GatewayProvider, 
  GatewayEnvironment,
  BankDisbursement,
  CashfreeWebhookEvent
} from '../types';
import { complianceService } from './complianceService';
import { masterDataService } from './masterDataService';
import { gatewayService } from './gatewayService';

const CF_BENEFICIARIES_KEY = 'fendex_cashfree_beneficiaries_db';
const CF_DISBURSEMENTS_KEY = 'fendex_bank_disbursements_db';

// Accessors
const getBeneficiariesDb = (): CashfreeBeneficiary[] => {
  const stored = localStorage.getItem(CF_BENEFICIARIES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveBeneficiariesDb = (list: CashfreeBeneficiary[]) => {
  localStorage.setItem(CF_BENEFICIARIES_KEY, JSON.stringify(list));
};

const getDisbursementsDb = (): BankDisbursement[] => {
  const stored = localStorage.getItem(CF_DISBURSEMENTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveDisbursementsDb = (list: BankDisbursement[]) => {
  localStorage.setItem(CF_DISBURSEMENTS_KEY, JSON.stringify(list));
};

export const cashfreeService = {
  
  // 1. CONFIGURATION (Delegated to GatewayService)
  getConfig: async (user: User) => {
    if (user.role !== UserRole.FOUNDER) return null;
    const cred = await gatewayService.getActiveCredential(GatewayProvider.CASHFREE, GatewayEnvironment.TEST);
    if (!cred) return null;
    return {
      clientId: cred.clientId,
      clientSecret: cred.clientSecret,
      environment: 'SANDBOX',
      status: 'Active'
    };
  },

  // 2. BENEFICIARY MANAGEMENT
  syncBeneficiaries: async (user: User): Promise<{ synced: number, errors: number }> => {
    if (user.role !== UserRole.FOUNDER) throw new Error('Unauthorized');

    const lmdcs = await masterDataService.getLMDCs();
    const riders = await masterDataService.getRiders();
    const existing = getBeneficiariesDb();
    let syncedCount = 0;

    const addBene = (type: 'LMDC' | 'RIDER', id: string, name: string, acc: string, ifsc: string) => {
      if (existing.find(b => b.entityId === id)) return;
      if (!acc || !ifsc) return;

      const beneId = `${type}_${id}_${Date.now().toString().slice(-4)}`;
      existing.push({
        entityType: type,
        entityId: id,
        beneId: beneId,
        bankAccount: acc,
        ifsc: ifsc,
        verified: true, 
        addedAt: new Date().toISOString()
      });
      syncedCount++;
    };

    lmdcs.forEach(l => {
      if (l.status === 'Active') addBene('LMDC', l.id, l.name, l.bankAccount || '', l.ifsc || '');
    });

    riders.forEach(r => {
      if (r.status === 'Active') addBene('RIDER', r.id, r.name, r.bankAccount || '', r.ifsc || '');
    });

    saveBeneficiariesDb(existing);
    
    if (syncedCount > 0) {
      await complianceService.logEvent('CASHFREE_OP', user, `Synced ${syncedCount} Beneficiaries to Cashfree Sandbox`, {});
    }

    return { synced: syncedCount, errors: 0 };
  },

  getBeneficiaryStatus: (entityId: string): boolean => {
    const list = getBeneficiariesDb();
    return list.some(b => b.entityId === entityId && b.verified);
  },

  getBeneficiary: (entityId: string): CashfreeBeneficiary | undefined => {
    const list = getBeneficiariesDb();
    return list.find(b => b.entityId === entityId);
  },

  // 3. EXECUTION: Create PENDING Disbursement (Step 1 of Flow)
  initiatePayoutRecord: async (
    user: User,
    batchId: string,
    entityId: string,
    role: 'LMDC' | 'RIDER',
    amount: number
  ): Promise<BankDisbursement> => {
    const disbursements = getDisbursementsDb();
    const disbursementId = `DISB_${batchId}_${entityId}`;

    // IDEMPOTENCY CHECK
    const existing = disbursements.find(d => d.disbursement_id === disbursementId);
    if (existing) {
      if (existing.status === 'SUCCESS') throw new Error(`Payout already SUCCESS for ${entityId} in batch ${batchId}`);
      // Return existing record if PENDING or FAILED (retry allowed on fail, usually requires manual reset but here we allow re-attempt logic handled by caller)
      return existing;
    }

    // Beneficiary Check
    const bene = cashfreeService.getBeneficiary(entityId);
    if (!bene) throw new Error(`Beneficiary not found for ${entityId}`);

    const record: BankDisbursement = {
      disbursement_id: disbursementId,
      payout_batch_id: batchId,
      beneficiary_id: bene.beneId,
      entity_id: entityId,
      role,
      amount,
      currency: 'INR',
      method: 'bank_transfer',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    disbursements.push(record);
    saveDisbursementsDb(disbursements);
    return record;
  },

  // 4. EXECUTION: Call Cashfree API (Step 2 of Flow)
  processPayout: async (
    user: User,
    disbursementId: string,
    credentials: { clientId: string, clientSecret: string }
  ): Promise<{ success: boolean, transferId?: string, status: string }> => {
    
    // Strict State Check
    const disbursements = getDisbursementsDb();
    const recordIndex = disbursements.findIndex(d => d.disbursement_id === disbursementId);
    if (recordIndex === -1) throw new Error('Disbursement record not found');
    
    const record = disbursements[recordIndex];
    if (record.status === 'SUCCESS') return { success: true, transferId: record.cashfree_transfer_id, status: 'SUCCESS' };
    if (record.status === 'INITIATED') return { success: false, status: 'INITIATED' }; // Already running

    // Mark INITIATED
    record.status = 'INITIATED';
    record.updated_at = new Date().toISOString();
    saveDisbursementsDb(disbursements);

    try {
      console.log(`[CASHFREE MOCK] POST /payout/transfers`);
      console.log(`Headers: X-Client-Id: ${credentials.clientId}`);
      console.log(`Payload: transferId: ${disbursementId}, amount: ${record.amount}, beneId: ${record.beneficiary_id}`);

      // SIMULATE NETWORK CALL
      await new Promise(r => setTimeout(r, 1000));

      // Simulate Success Response
      const mockTransferId = `CF_TR_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // UPDATE RECORD
      record.status = 'SUCCESS';
      record.cashfree_transfer_id = mockTransferId;
      record.bank_reference = `REF_${mockTransferId}`;
      record.updated_at = new Date().toISOString();
      
      disbursements[recordIndex] = record;
      saveDisbursementsDb(disbursements);

      await complianceService.logEvent(
        'PAYOUT_EXECUTION',
        user,
        `Cashfree Transfer Executed: ${disbursementId}`,
        { transferId: mockTransferId, amount: record.amount }
      );

      return { success: true, transferId: mockTransferId, status: 'SUCCESS' };

    } catch (e: any) {
      // HANDLE FAILURE
      record.status = 'FAILED';
      record.status_description = e.message;
      record.updated_at = new Date().toISOString();
      disbursements[recordIndex] = record;
      saveDisbursementsDb(disbursements);

      await complianceService.logEvent(
        'PAYOUT_FAILURE',
        user,
        `Cashfree Transfer Failed: ${disbursementId}`,
        { error: e.message }
      );

      return { success: false, status: 'FAILED' };
    }
  },

  // 5. WEBHOOK VERIFICATION & HANDLING
  verifySignature: (payload: string, signature: string, secret: string): boolean => {
    // In real implementation: crypto.createHmac('sha256', secret).update(payload).digest('base64')
    // Simulation:
    return true; 
  },

  handleWebhook: async (event: CashfreeWebhookEvent): Promise<void> => {
    // 1. Verify Signature (Simulated call before entering here usually)
    
    // 2. Find Record
    const disbursements = getDisbursementsDb();
    const idx = disbursements.findIndex(d => d.disbursement_id === event.reference_id);
    
    if (idx === -1) {
      console.error(`[WEBHOOK] Mismatch: Disbursement ${event.reference_id} not found.`);
      await complianceService.logEvent('WEBHOOK_ERROR', { id: 'SYSTEM', role: 'SYSTEM' }, `Webhook ID Mismatch: ${event.reference_id}`, {});
      return;
    }

    const record = disbursements[idx];

    // 3. Update Status
    // Only allow specific transitions
    if (event.type === 'TRANSFER_SUCCESS' && record.status !== 'SUCCESS') {
      record.status = 'SUCCESS';
      record.bank_reference = event.data.transfer.bank_reference_num;
      record.updated_at = new Date().toISOString();
    } else if (event.type === 'TRANSFER_FAILED') {
      record.status = 'FAILED';
      record.status_description = event.data.transfer.reason;
      record.updated_at = new Date().toISOString();
    } else if (event.type === 'TRANSFER_REVERSED') {
      record.status = 'REVERSED';
      record.updated_at = new Date().toISOString();
    }

    saveDisbursementsDb(disbursements);

    await complianceService.logEvent(
      'WEBHOOK_UPDATE',
      { id: 'SYSTEM', role: 'SYSTEM' },
      `Payout Updated via Webhook: ${record.disbursement_id} -> ${record.status}`,
      { event }
    );
  },

  // Deprecated Legacy Method (Refactored to new flow in PayoutService)
  requestTransfer: async (user: User, batch: PayoutBatch, transfers: Record<string, number>): Promise<any> => {
     throw new Error("Legacy method disabled. Use atomic initiatePayoutRecord flow.");
  }
};
