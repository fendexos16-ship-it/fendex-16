
import { 
  PayoutSummaryStats, 
  ExceptionRecord, 
  LedgerStatus, 
  PayoutBatchStatus, 
  UserRole,
  LedgerReportRow,
  ReconciliationRecord,
  PayoutBatch,
  LedgerEntry,
  PaymentGateway,
  RiderLedgerEntry,
  User
} from '../types';
import { ledgerService } from './ledgerService';
import { payoutService } from './payoutService';
import { complianceService } from './complianceService';
import { runsheetService } from './runsheetService';
import { shipmentService } from './shipmentService';
import { codService } from './codService';
import { masterDataService } from './masterDataService';

export const reportService = {

  getPayoutSummary: async (
    user: { role: UserRole },
    startDate: string, 
    endDate: string,
    entityRole: 'LMDC' | 'RIDER' | 'ALL' = 'ALL'
  ): Promise<PayoutSummaryStats> => {
    
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) {
      throw new Error('Access Denied');
    }

    let ledgers: any[] = [];
    if (entityRole === 'ALL' || entityRole === 'LMDC') {
      ledgers.push(...await ledgerService.getLmdcLedgers({ role: UserRole.FOUNDER } as any));
    }
    if (entityRole === 'ALL' || entityRole === 'RIDER') {
      ledgers.push(...await ledgerService.getRiderLedgers({ role: UserRole.FOUNDER } as any));
    }

    const start = new Date(startDate).setHours(0,0,0,0);
    const end = new Date(endDate).setHours(23,59,59,999);

    const filtered = ledgers.filter(l => {
      const d = new Date(l.createdAt).getTime();
      return d >= start && d <= end;
    });

    const stats: PayoutSummaryStats = {
      totalPayable: 0,
      executedAmount: 0,
      pendingAmount: 0,
      failedCount: 0,
      failedAmount: 0
    };

    filtered.forEach(l => {
      const amt = l.calculatedAmount;
      if (l.ledgerStatus === LedgerStatus.VOID) return;

      stats.totalPayable += amt;

      if (l.ledgerStatus === LedgerStatus.PAID) {
        stats.executedAmount += amt;
      } else if (l.ledgerStatus === LedgerStatus.FAILED) {
        stats.failedAmount += amt;
        stats.failedCount++;
      } else {
        stats.pendingAmount += amt;
      }
    });

    return stats;
  },

  getLedgerReport: async (user: { role: UserRole }): Promise<LedgerReportRow[]> => {
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) return [];

    const batches = await payoutService.getBatches();
    const batchMap = new Map<string, PayoutBatch>();
    batches.forEach(b => batchMap.set(b.id, b));

    const lmdcLedgers = await ledgerService.getLmdcLedgers({ role: UserRole.FOUNDER } as any);
    const riderLedgers = await ledgerService.getRiderLedgers({ role: UserRole.FOUNDER } as any);

    const mapToRow = (l: any): LedgerReportRow => {
      const batch = l.payoutBatchId ? batchMap.get(l.payoutBatchId) : null;
      return {
        id: l.id,
        cycleId: l.payoutBatchId || 'N/A',
        awb: l.shipmentId,
        entityId: l.lmdcId || l.riderId,
        paymentMode: l.paymentMode || 'Prepaid',
        codAmount: l.codAmount || 0,
        rate: l.appliedRate,
        payoutAmount: l.calculatedAmount,
        status: l.ledgerStatus,
        gatewayRef: l.razorpayPayoutId || '-', 
        executedAt: batch?.executedAt || '-'
      };
    };

    return [...lmdcLedgers.map(mapToRow), ...riderLedgers.map(mapToRow)];
  },

  getReconciliationReport: async (user: { role: UserRole }): Promise<ReconciliationRecord[]> => {
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) return [];

    const batches = await payoutService.getBatches();
    const batchMap = new Map<string, PayoutBatch>();
    batches.forEach(b => batchMap.set(b.id, b));

    const lmdcLedgers = await ledgerService.getLmdcLedgers({ role: UserRole.FOUNDER } as any);
    const riderLedgers = await ledgerService.getRiderLedgers({ role: UserRole.FOUNDER } as any);
    const allLedgers = [...lmdcLedgers, ...riderLedgers];

    const processedLedgers = allLedgers.filter(l => 
      l.ledgerStatus === LedgerStatus.PAID || 
      l.ledgerStatus === LedgerStatus.FAILED
    );

    return processedLedgers.map(l => {
      const batch = l.payoutBatchId ? batchMap.get(l.payoutBatchId) : null;
      const entityId = 'riderId' in l ? (l as RiderLedgerEntry).riderId : l.lmdcId;
      
      return {
        id: l.id,
        gateway: PaymentGateway.CASHFREE,
        transferId: l.razorpayPayoutId || `FENDEX-${l.payoutBatchId}-${entityId}`,
        referenceId: batch?.gatewayRef || '-', 
        status: l.ledgerStatus === LedgerStatus.PAID ? 'SUCCESS' : 'FAILED',
        amount: l.calculatedAmount,
        cycleId: l.payoutBatchId || 'UNKNOWN',
        executedAt: batch?.executedAt || '-',
        webhookVerified: l.ledgerStatus === LedgerStatus.PAID
      };
    });
  },

  getExceptions: async (user: { role: UserRole }): Promise<ExceptionRecord[]> => {
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) return [];

    const exceptions: ExceptionRecord[] = [];
    const batches = await payoutService.getBatches();
    batches.forEach(b => {
      if (b.status === PayoutBatchStatus.FAILED || b.status === PayoutBatchStatus.PARTIAL_FAILURE) {
        exceptions.push({
          id: b.id,
          type: 'BATCH',
          referenceId: b.id,
          amount: b.totalAmount,
          date: b.executedAt || b.approvedAt,
          issue: `Batch Status: ${b.status}`,
          founderNote: (complianceService as any).getExceptionNote(b.id)
        });
      }
    });

    const lmdcLedgers = await ledgerService.getLmdcLedgers({ role: UserRole.FOUNDER } as any);
    const riderLedgers = await ledgerService.getRiderLedgers({ role: UserRole.FOUNDER } as any);
    
    [...lmdcLedgers, ...riderLedgers].forEach(l => {
      if (l.ledgerStatus === LedgerStatus.FAILED) {
        exceptions.push({
          id: l.id,
          type: 'LEDGER',
          referenceId: l.shipmentId,
          amount: l.calculatedAmount,
          date: l.createdAt,
          issue: 'Payout Failed at Ledger Level',
          founderNote: (complianceService as any).getExceptionNote(l.id)
        });
      }
    });

    return exceptions;
  },

  getRunsheetReport: async (user: User, start: string, end: string) => {
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) return [];
    
    const lmdcs = await masterDataService.getLMDCs();
    let allSheets: any[] = [];
    
    for (const lmdc of lmdcs) {
       const sheets = await runsheetService.getRunsheets(lmdc.id);
       allSheets.push(...sheets.map(s => ({...s, lmdcName: lmdc.name})));
    }
    
    const s = new Date(start).setHours(0,0,0,0);
    const e = new Date(end).setHours(23,59,59,999);
    
    const filtered = allSheets.filter(r => {
       const d = new Date(r.createdAt).getTime();
       return d >= s && d <= e;
    });

    return filtered.map(r => ({
       Date: new Date(r.createdAt).toLocaleDateString(),
       Runsheet_ID: r.runsheetCode,
       Type: r.type,
       LMDC: r.lmdcName,
       Rider_ID: r.riderId,
       Status: r.status,
       Items_Count: r.shipmentIds.length
    }));
  },

  getCodReport: async (user: User, start: string, end: string) => {
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) return [];
     
     const shipments = await shipmentService.getShipments(user);
     const codRecords = await codService.getAllRecords();
     const riders = await masterDataService.getRiders();
     
     const s = new Date(start).setHours(0,0,0,0);
     const e = new Date(end).setHours(23,59,59,999);

     const filtered = shipments.filter(ship => {
        const d = new Date(ship.updatedAt).getTime();
        return d >= s && d <= e && ship.paymentMode === 'COD' && ship.status === 'Delivered';
     });

     return filtered.map(ship => {
        const rec = codRecords[ship.awb];
        const rider = riders.find(r => r.id === ship.assignedRiderId);
        return {
           Date: new Date(ship.updatedAt).toLocaleDateString(),
           AWB: ship.awb,
           LMDC_ID: ship.linkedLmdcId,
           Rider_Name: rider ? rider.name : ship.assignedRiderId,
           COD_Amount: ship.codAmount,
           COD_Status: rec ? rec.state : 'PENDING_ACTION',
           Verified_At: rec?.reconciledAt ? new Date(rec.reconciledAt).toLocaleDateString() : '-'
        };
     });
  },

  generateCsv: (data: any[], headers: string[]) => {
    const csvRows = [];
    csvRows.push(headers.join(','));
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        return `"${val === undefined || val === null ? '' : val}"`;
      });
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  },

  generateAuditManifest: (user: { id: string, name: string }) => {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
      manifest_id: `AUDIT-${Date.now()}`,
      generated_by: user.id,
      generated_at: timestamp,
      contents: [
        'ledger_detail_report.csv',
        'gateway_recon_report.csv',
        'compliance_logs.json'
      ],
      integrity_hash: `SHA256-SIMULATED-${Math.random().toString(36).substring(7)}`,
      environment: 'PRODUCTION_READ_ONLY'
    }, null, 2);
  }
};
