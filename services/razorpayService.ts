
import { 
  User, 
  UserRole, 
  PayoutBatch, 
  PaymentGateway, 
  RazorpayBeneficiary, 
  GatewayProvider, 
  GatewayEnvironment,
  PayoutBatchStatus
} from '../types';
import { complianceService } from './complianceService';
import { masterDataService } from './masterDataService';
import { gatewayService } from './gatewayService';

const RZ_BENEFICIARIES_KEY = 'fendex_razorpay_beneficiaries_db';

const getBeneficiariesDb = (): RazorpayBeneficiary[] => {
  const stored = localStorage.getItem(RZ_BENEFICIARIES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveBeneficiariesDb = (list: RazorpayBeneficiary[]) => {
  localStorage.setItem(RZ_BENEFICIARIES_KEY, JSON.stringify(list));
};

export const razorpayService = {
  
  // 1. CONFIGURATION CHECK
  // Ensures Founder has set up Razorpay Credentials in System
  checkReadiness: async (user: User, env: GatewayEnvironment): Promise<boolean> => {
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) return false;
    const cred = await gatewayService.getActiveCredential(GatewayProvider.RAZORPAY, env);
    return !!cred;
  },

  // 2. BENEFICIARY MANAGEMENT (Fund Accounts)
  syncBeneficiaries: async (user: User): Promise<{ synced: number, errors: number }> => {
    if (user.role !== UserRole.FOUNDER) throw new Error('Unauthorized: Founder Access Required');

    const lmdcs = await masterDataService.getLMDCs();
    const riders = await masterDataService.getRiders();
    const existing = getBeneficiariesDb();
    let syncedCount = 0;

    // Simulate API calls to Razorpay to create Contact & Fund Account
    const addBene = (type: 'LMDC' | 'RIDER', id: string, name: string, acc: string, ifsc: string) => {
      // Idempotency: Skip if already exists
      if (existing.find(b => b.entityId === id)) return;
      
      // Data Validation
      if (!acc || !ifsc || acc.length < 5) return;

      // Mock IDs returned by Razorpay API
      const contactId = `cont_${Math.random().toString(36).substr(2, 10)}`;
      const fundAccountId = `fa_${Math.random().toString(36).substr(2, 10)}`;

      existing.push({
        entityType: type,
        entityId: id,
        contactId,
        fundAccountId,
        bankAccount: acc.slice(-4), // Store only mask for display
        ifsc: ifsc,
        status: 'ACTIVE', 
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
      await complianceService.logEvent('RAZORPAY_OP', user, `Synced ${syncedCount} Fund Accounts to Razorpay`, {});
    }

    return { synced: syncedCount, errors: 0 };
  },

  getBeneficiaryStatus: (entityId: string): boolean => {
    const list = getBeneficiariesDb();
    return list.some(b => b.entityId === entityId && b.status === 'ACTIVE');
  },

  // 3. PAYOUT EXECUTION (Strict Mode)
  requestTransfer: async (
    user: User, 
    batch: PayoutBatch,
    transfers: Record<string, number> 
  ): Promise<{ success: boolean, refId?: string, rawResponse?: any }> => {
    
    // A. Pre-flight Checks
    if (batch.gatewaySelected !== PaymentGateway.RAZORPAY) {
       throw new Error('Routing Error: Batch not routed for Razorpay');
    }

    // Determine Environment (Simulated by System Config, here mocked as passed or derived)
    // In PayoutService, env is decided based on Production Mode flag.
    // We fetch credentials for that env.
    // Assuming 'TEST' for simulation default unless Prod enabled externally.
    const isProd = batch.status === PayoutBatchStatus.EXECUTED_PRODUCTION; // Wait, this is post-facto. 
    // We need to know env BEFORE execution. PayoutService handles logic, but here we need creds.
    // We will attempt to get TEST creds first for safety in this simulation unless explicitly PROD context passed.
    // For Safety in this mock, we default to TEST credential check.
    const env: GatewayEnvironment = GatewayEnvironment.TEST; 
    
    const creds = await gatewayService.getActiveCredential(GatewayProvider.RAZORPAY, env);
    if (!creds) throw new Error(`CRITICAL: No Active Razorpay ${env} Credentials found.`);

    // B. Beneficiary Verification (Hard Block)
    const beneficiaries = getBeneficiariesDb();
    const missingBeneficiaries = Object.keys(transfers).filter(id => !beneficiaries.find(b => b.entityId === id));
    
    if (missingBeneficiaries.length > 0) {
      throw new Error(`PAYOUT BLOCKED: Beneficiaries missing for: ${missingBeneficiaries.join(', ')}. Run Razorpay Sync.`);
    }

    // C. Execution Simulation
    console.log(`[RAZORPAY ${env}] Authenticating with Key ID: ${creds.clientId}`);
    console.log(`[RAZORPAY ${env}] Initiating Bulk Payout for Batch ${batch.id}`);
    
    let totalValue = 0;
    Object.entries(transfers).forEach(([id, amount]) => {
        const bene = beneficiaries.find(b => b.entityId === id);
        console.log(` -> Payout to ${bene?.fundAccountId} (Ref: ${id}): ₹${amount}`);
        totalValue += amount;
    });

    if (Math.abs(totalValue - batch.totalAmount) > 1) {
       console.warn(`[RAZORPAY] Amount Warning: Batch Total ${batch.totalAmount} vs Calculated ${totalValue}`);
    }

    // Simulate Network Latency
    await new Promise(r => setTimeout(r, 2000));

    // Simulate Response
    // In strict mode, we assume success for the simulation unless specific error condition injected.
    const isSuccess = true; 

    if (isSuccess) {
      const payoutId = `pout_${Math.random().toString(36).substr(2, 14)}`;
      return { 
        success: true, 
        refId: payoutId, 
        rawResponse: { 
           id: payoutId, 
           entity: 'payout', 
           amount: totalValue * 100, 
           currency: 'INR', 
           status: 'processing', 
           reference_id: batch.id 
        } 
      };
    } else {
      return { success: false, rawResponse: { error: { description: 'Simulated Bank Error' } } };
    }
  },

  // 4. COLLECTION METHODS (Payment Links)
  
  createPaymentLink: async (
    user: User, 
    invoiceId: string, 
    amount: number, 
    clientData: { name: string, phone: string, email: string }
  ): Promise<{ id: string, short_url: string, status: string }> => {
    
    const env = GatewayEnvironment.TEST; // Default to TEST for collections simulation
    const creds = await gatewayService.getActiveCredential(GatewayProvider.RAZORPAY, env);
    if (!creds) throw new Error("No Razorpay Credentials Active");

    // Mock API Call
    console.log(`[RAZORPAY] Generating Payment Link for Invoice ${invoiceId}`);
    
    await new Promise(r => setTimeout(r, 800));

    const plinkId = `plink_${Math.random().toString(36).substr(2, 12)}`;
    const url = `https://rzp.io/i/${plinkId}`; // Mock URL

    await complianceService.logEvent(
      'RAZORPAY_OP',
      user,
      `Created Payment Link ${plinkId} for Invoice ${invoiceId}`,
      { amount, url }
    );

    return {
      id: plinkId,
      short_url: url,
      status: 'created'
    };
  },

  fetchPaymentStatus: async (paymentId: string): Promise<string> => {
    // Mock check
    return 'captured';
  },

  // 5. WEBHOOK VERIFICATION (Mock)
  verifySignature: (body: string, signature: string, secret: string) => {
     // In real backend: crypto.createHmac('sha256', secret).update(body).digest('hex')
     return true; 
  }
};
