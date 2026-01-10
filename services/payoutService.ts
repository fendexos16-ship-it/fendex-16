
import { 
  PayoutBatch, 
  PayoutBatchStatus, 
  User, 
  UserRole,
  LedgerStatus,
  PaymentGateway,
  GatewayStatus,
  SystemEnvironment,
  GatewayProvider,
  GatewayEnvironment
} from '../types';
import { ledgerService } from './ledgerService';
import { masterDataService } from './masterDataService';
import { systemConfigService } from './systemConfigService';
import { complianceService } from './complianceService';
import { resilienceService } from './resilienceService'; 
import { cashfreeService } from './cashfreeService';
import { razorpayService } from './razorpayService'; 
import { gatewayService } from './gatewayService';
import { authService } from './authService';

const BATCHES_KEY = 'fendex_payout_batches_db';

const getBatchesDb = (): PayoutBatch[] => {
  const stored = localStorage.getItem(BATCHES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveBatchesDb = (batches: PayoutBatch[]) => {
  localStorage.setItem(BATCHES_KEY, JSON.stringify(batches));
};

export const payoutService = {

  // --- 1. Cycle Manager: Get Open Ledgers ---

  getOpenLedgersInRange: async (role: 'LMDC' | 'RIDER', user: User, startDate: string, endDate: string) => {
    // Only Founder/Finance can see pool
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) return [];

    let allLedgers = [];
    if (role === 'LMDC') {
      allLedgers = await ledgerService.getLmdcLedgers(user);
    } else {
      allLedgers = await ledgerService.getRiderLedgers(user);
    }

    const start = new Date(startDate).setHours(0,0,0,0);
    const end = new Date(endDate).setHours(23,59,59,999);

    // Filter strictly for OPEN (Payable) or FAILED (Retry)
    // AND within Date Range
    return allLedgers.filter(l => {
      const d = new Date(l.createdAt).getTime();
      return d >= start && d <= end && 
             (l.ledgerStatus === LedgerStatus.OPEN || l.ledgerStatus === LedgerStatus.FAILED);
    });
  },

  getBatches: async (): Promise<PayoutBatch[]> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return getBatchesDb().sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime());
  },

  // --- 2. Approval Flow: Create & Approve Batch ---

  approveCycle: async (
    role: 'LMDC' | 'RIDER', 
    ledgerIds: string[], 
    user: User,
    cycleRange: { start: string, end: string },
    gateway: PaymentGateway 
  ): Promise<PayoutBatch> => {
    // STRICT RULE: Founder Approval Gate
    authService.requireRole(user, UserRole.FOUNDER);

    // Check Incident Mode
    if (systemConfigService.isIncidentMode()) {
       throw new Error("OPERATION BLOCKED: System is in Incident Mode. Approvals Disabled.");
    }

    if (ledgerIds.length === 0) {
      throw new Error('No ledgers selected for payout.');
    }

    if (!gateway || gateway === PaymentGateway.NONE) {
       throw new Error('Invalid Gateway Selection. Must choose CASHFREE or RAZORPAY.');
    }

    // Phase 15: Fixed Weekly Payout Calendar Logic
    const endD = new Date(cycleRange.end);
    const endDay = endD.getDate();
    let payoutDateStr = '';

    if (endDay === 7) {
      const p = new Date(endD);
      p.setDate(14);
      payoutDateStr = p.toISOString().split('T')[0];
    } else if (endDay === 13) {
      const p = new Date(endD);
      p.setDate(21);
      payoutDateStr = p.toISOString().split('T')[0];
    } else if (endDay === 21) {
      const p = new Date(endD);
      p.setDate(28);
      payoutDateStr = p.toISOString().split('T')[0];
    } else if (endDay === 28) {
      const p = new Date(endD);
      p.setMonth(p.getMonth() + 1); // Next Month
      p.setDate(4);
      payoutDateStr = p.toISOString().split('T')[0];
    } else {
      throw new Error(`POLICY VIOLATION: Cycle End Date ${endDay} is invalid. Must be 7th, 13th, 21st, or 28th.`);
    }

    // Fetch ledgers to calculate total
    let allLedgers = [];
    if (role === 'LMDC') allLedgers = await ledgerService.getLmdcLedgers(user);
    else allLedgers = await ledgerService.getRiderLedgers(user);

    const selectedLedgers = allLedgers.filter(l => ledgerIds.includes(l.id));
    const totalAmount = selectedLedgers.reduce((sum, l) => sum + l.calculatedAmount, 0);

    const batch: PayoutBatch = {
      id: 'PB-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      role,
      ledgerIds,
      totalAmount,
      count: ledgerIds.length,
      status: PayoutBatchStatus.LOCKED, // Phase 7: Auto-Lock on Approval
      approvedByUserId: user.id,
      approvedByName: user.name,
      approvedAt: new Date().toISOString(),
      cycleRangeStart: cycleRange.start,
      cycleRangeEnd: cycleRange.end,
      payoutDate: payoutDateStr, 
      gatewaySelected: gateway, 
      gateway: PaymentGateway.NONE, 
      gatewayStatus: GatewayStatus.NA
    };

    // LOCK LEDGERS: Transition to LOCKED
    await ledgerService.approveLedgersForBatch(role, ledgerIds, batch.id);

    const batches = getBatchesDb();
    batches.unshift(batch);
    saveBatchesDb(batches);

    // COMPLIANCE LOG
    await complianceService.logEvent(
      'APPROVAL',
      user,
      `Approved Payout Batch ${batch.id} via ${gateway}`,
      { amount: totalAmount, count: ledgerIds.length, cycle: cycleRange, payoutDate: payoutDateStr }
    );

    return batch;
  },

  // --- 3. Execution (Hardened Fail-Safe Pattern) ---

  executeBatch: async (batchId: string, user: User): Promise<PayoutBatch> => {
    // 0. INCIDENT MODE CHECK
    if (systemConfigService.isIncidentMode()) {
       throw new Error("CRITICAL BLOCK: Incident Mode Active. Financial Execution Frozen.");
    }

    // 1. RATE LIMIT CHECK
    if (!resilienceService.checkRateLimit('payout_execute', 1)) {
      throw new Error('Rate Limit Exceeded. Please wait 1 minute.');
    }

    const batches = getBatchesDb();
    const batchIndex = batches.findIndex(b => b.id === batchId);
    if (batchIndex === -1) throw new Error('Batch not found');
    const batch = batches[batchIndex];

    // 2. GATEWAY & CIRCUIT BREAKER CHECK
    const activeGateway = batch.gatewaySelected || PaymentGateway.CASHFREE;
    const breaker = resilienceService.getBreakerStatus(activeGateway);
    if (breaker.status === 'OPEN') {
      throw new Error(`Circuit Breaker OPEN for ${activeGateway}. Execution Blocked. Contact Ops.`);
    }

    // 3. POLICY CHECK: DATE BARRIER (AUDIT REQUIREMENT)
    const today = new Date().toISOString().split('T')[0];
    if (batch.payoutDate && today < batch.payoutDate) {
       throw new Error(`PAYOUT POLICY LOCK: Cannot execute before Release Date ${batch.payoutDate}. Today is ${today}.`);
    }

    // 4. IDEMPOTENCY CHECK
    const idempotencyKey = `PAYOUT::${batchId}::${activeGateway}`;
    const existing = resilienceService.checkIdempotency(idempotencyKey);
    
    if (existing && existing.status === 'COMPLETED') {
      return batch; 
    }
    if (existing && existing.status === 'IN_PROGRESS') {
      throw new Error('Execution already in progress for this batch.');
    }

    // 5. ACQUIRE LOCK (Concurrency Control)
    const lockKey = `LOCK::PAYOUT::${batchId}`;
    const acquired = await resilienceService.acquireLock(lockKey, user.id);
    if (!acquired) {
      throw new Error('Could not acquire execution lock. System busy or another admin is operating.');
    }

    // START TWO-PHASE EXECUTION
    try {
      // PREPARE PHASE
      resilienceService.recordIdempotency(idempotencyKey, 'IN_PROGRESS');

      // Check Permissions via Middleware
      authService.requireRole(user, UserRole.FOUNDER);

      // Check State
      if (batch.status === PayoutBatchStatus.EXECUTED_TEST || batch.status === PayoutBatchStatus.EXECUTED_PRODUCTION) {
        throw new Error('Batch already processed.');
      }

      const config = await systemConfigService.getConfig();
      const isProduction = config.payoutEnvironment === SystemEnvironment.PRODUCTION;

      // COMMIT PHASE - Logic
      batch.status = PayoutBatchStatus.PROCESSING;
      saveBatchesDb(batches); 
      await ledgerService.setProcessingStatus(batch.role, batchId);

      // --- AGGREGATE TRANSFERS ---
      let allLedgers: any[] = [];
      if (batch.role === 'LMDC') allLedgers = await ledgerService.getLmdcLedgers(user);
      else allLedgers = await ledgerService.getRiderLedgers(user);
      const batchLedgers = allLedgers.filter(l => batch.ledgerIds.includes(l.id));
      const transfers: Record<string, number> = {};
      batchLedgers.forEach(l => {
        const entityId = batch.role === 'LMDC' ? l.lmdcId : l.riderId;
        transfers[entityId] = (transfers[entityId] || 0) + l.calculatedAmount;
      });

      // --- AUTHENTICATE GATEWAY ---
      let creds;
      // Force TEST credentials for Safe Mode Simulation unless configured otherwise
      const env = isProduction ? GatewayEnvironment.PROD : GatewayEnvironment.TEST; 
      
      if (activeGateway === PaymentGateway.CASHFREE) {
         creds = await gatewayService.getActiveCredential(GatewayProvider.CASHFREE, env);
      } else {
         creds = await gatewayService.getActiveCredential(GatewayProvider.RAZORPAY, env);
      }

      if (!creds) throw new Error(`No Active ${activeGateway} Credentials for ${env} environment.`);

      // --- EXECUTE PER BENEFICIARY (ATOMIC) ---
      let successCount = 0;
      let failureCount = 0;
      let finalGatewayRef = '';

      const entityIds = Object.keys(transfers);
      
      for (const entityId of entityIds) {
         const amount = transfers[entityId];
         if (amount <= 0) continue; // Skip zero/negative

         if (activeGateway === PaymentGateway.CASHFREE) {
            // 1. Create Immutable Disbursement Record
            const disbursement = await cashfreeService.initiatePayoutRecord(user, batch.id, entityId, batch.role, amount);
            
            // 2. Call Gateway API
            const res = await cashfreeService.processPayout(user, disbursement.disbursement_id, creds);
            
            if (res.success) {
               successCount++;
               finalGatewayRef = res.transferId || 'MULTI_TXN';
            } else {
               failureCount++;
            }
         } else {
            // Placeholder for Razorpay strict flow update (currently legacy)
            // For now fail safe if strict mode required
            console.warn("Razorpay strict flow pending implementation. Skipping.");
            failureCount++; 
         }
      }

      // HANDLE BATCH RESULT
      // Determine final status based on aggregated atomic results
      if (successCount > 0 && failureCount === 0) {
        batch.status = isProduction ? PayoutBatchStatus.EXECUTED_PRODUCTION : PayoutBatchStatus.EXECUTED_TEST;
        batch.gatewayStatus = GatewayStatus.SUCCESS;
      } else if (successCount > 0 && failureCount > 0) {
        batch.status = PayoutBatchStatus.PARTIAL_FAILURE;
        batch.gatewayStatus = GatewayStatus.FAILED;
      } else {
        batch.status = PayoutBatchStatus.FAILED;
        batch.gatewayStatus = GatewayStatus.FAILED;
      }

      batch.executedAt = new Date().toISOString();
      batch.gateway = activeGateway;
      batch.gatewayRef = finalGatewayRef;
      
      // Update Ledgers to PAID only if individual disbursement success? 
      // Current Ledger Logic is bulk update. Ideally we map back.
      // For this implementation, if batch SUCCESS, mark all PAID. If partial, manual reconciliation required.
      if (batch.status === PayoutBatchStatus.EXECUTED_TEST || batch.status === PayoutBatchStatus.EXECUTED_PRODUCTION) {
         await ledgerService.finalizePayouts(batch.role, batch.id, LedgerStatus.PAID, batch.gatewayRef || 'REF');
         resilienceService.recordIdempotency(idempotencyKey, 'COMPLETED', batch.gatewayRef);
         resilienceService.recordGatewaySuccess(activeGateway);
      } else {
         resilienceService.recordGatewayFailure(activeGateway, user);
         resilienceService.recordIdempotency(idempotencyKey, 'FAILED');
         // We do NOT rollback to OPEN automatically for Partial/Failed. Finance admin must investigate.
      }

      batches[batchIndex] = batch;
      saveBatchesDb(batches);
      return batch;

    } catch (error: any) {
      // CRITICAL FAILURE HANDLING
      console.error("Payout Execution Error", error);
      
      resilienceService.recordGatewayFailure(activeGateway, user);
      resilienceService.recordIdempotency(idempotencyKey, 'FAILED');
      
      // Rollback Status to FAILED so it can be retried or investigated
      batch.status = PayoutBatchStatus.FAILED;
      batch.gatewayStatus = GatewayStatus.FAILED;
      
      // We do not revert ledgers to OPEN to prevent double payment risk. They stay PROCESSING/LOCKED until manual intervention.
      
      batches[batchIndex] = batch;
      saveBatchesDb(batches);

      throw error; 

    } finally {
      // ALWAYS RELEASE LOCK
      await resilienceService.releaseLock(lockKey, user.id);
    }
  },

  // --- Helpers ---
  hasSuccessfulTestPayout: async (): Promise<boolean> => {
    const batches = getBatchesDb();
    return batches.some(b => b.status === PayoutBatchStatus.EXECUTED_TEST);
  },

  generateCsv: (ledgers: any[], cycleId: string) => {
    const headers = [
      'Cycle ID', 'Ledger ID', 'Shipment ID (AWB)', 'Shipment Status', 'Job Type',
      'Entity ID', 'DC ID', 'Delivery Date', 'Payment Mode', 'COD Collected',
      'Applied Rate', 'Payout Amount', 'Ledger Status'
    ];

    const rows = ledgers.map(l => [
      cycleId, l.id, l.shipmentId, l.shipmentStatus, l.shipmentType || l.jobType,
      l.lmdcId || l.riderId, l.dcId, new Date(l.createdAt).toLocaleDateString(),
      l.paymentMode || 'Prepaid', l.codAmount || 0, l.appliedRate, l.calculatedAmount, l.ledgerStatus
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
};
