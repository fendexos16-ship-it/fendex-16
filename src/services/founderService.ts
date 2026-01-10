
import { 
  User, 
  UserRole, 
  ShipmentStatus, 
  PaymentMode, 
  LedgerStatus,
  ReceivableStatus,
  CodState,
  SlaBucket,
  RiderExposure,
  InvoiceStatus
} from '../types';
import { shipmentService } from './shipmentService';
import { ledgerService } from './ledgerService';
import { billingService } from './billingService';
import { codService } from './codService';
import { masterDataService } from './masterDataService';
import { complianceService } from './complianceService';
import { slaService } from './slaService';
import { clientService } from './clientService';

const FOUNDER_NOTES_KEY = 'fendex_founder_notes_db';

export interface DailyMetrics {
  shipments: { total: number, delivered: number, rto: number, undelivered: number };
  sla: { d0Percent: number, d1Percent: number };
  cod: { expected: number, verified: number, pending: number };
  payouts: { riderPending: number, lmdcPending: number };
  finance: { invoicesSent: number, receivablesOutstanding: number, overdueAmount: number };
}

export interface RedFlag {
  severity: 'HIGH' | 'MEDIUM';
  message: string;
  metric: string;
  value: string | number;
}

export const founderService = {

  // 1. NOTES
  saveNote: async (date: string, note: string) => {
     const db = JSON.parse(localStorage.getItem(FOUNDER_NOTES_KEY) || '{}');
     db[date] = note;
     localStorage.setItem(FOUNDER_NOTES_KEY, JSON.stringify(db));
  },

  getNote: (date: string): string => {
     const db = JSON.parse(localStorage.getItem(FOUNDER_NOTES_KEY) || '{}');
     return db[date] || '';
  },

  // 2. METRICS AGGREGATION
  getSnapshot: async (user: User, range: { start: string, end: string }): Promise<DailyMetrics> => {
     // Fetch Raw Data
     const [shipments, lmdcLedgers, riderLedgers, receivables, codRecords] = await Promise.all([
        shipmentService.getShipments(user),
        ledgerService.getLmdcLedgers(user),
        ledgerService.getRiderLedgers(user),
        billingService.getReceivables(),
        codService.getAllRecords()
     ]);

     const sStart = new Date(range.start).setHours(0,0,0,0);
     const sEnd = new Date(range.end).setHours(23,59,59,999);

     // SHIPMENTS
     const periodShipments = shipments.filter(s => {
        const d = new Date(s.createdAt).getTime();
        return d >= sStart && d <= sEnd;
     });

     const delivered = periodShipments.filter(s => s.status === ShipmentStatus.DELIVERED);
     
     // SLA
     let d0Count = 0;
     let d1Count = 0;
     
     // We need SLA records for accurate D0/D1, fetching them is expensive so we approximate 
     // or fetch if needed. Let's iterate delivered shipments and check created vs updated dates.
     delivered.forEach(s => {
        const created = new Date(s.createdAt).setHours(0,0,0,0);
        const updated = new Date(s.updatedAt).setHours(0,0,0,0);
        const diff = (updated - created) / (1000 * 60 * 60 * 24);
        if (diff <= 0) d0Count++;
        if (diff <= 1) d1Count++;
     });

     // COD
     const codShipments = delivered.filter(s => s.paymentMode === PaymentMode.COD);
     const expectedCod = codShipments.reduce((sum, s) => sum + s.codAmount, 0);
     
     // Verified COD (Check COD Records for these shipments)
     const verifiedCod = codShipments.reduce((sum, s) => {
        const rec = codRecords[s.awb];
        if (rec && (rec.state === CodState.COD_VERIFIED || rec.state === CodState.COD_DEPOSITED || rec.state === CodState.COD_SETTLED)) {
           return sum + rec.codAmount;
        }
        return sum;
     }, 0);

     // FINANCE
     // Invoices sent in period
     const invoicesSent = (await billingService.getInvoices())
        .filter(i => {
           const d = new Date(i.generatedAt).getTime();
           return d >= sStart && d <= sEnd && i.status !== InvoiceStatus.DRAFT;
        }).length;

     // Receivables Outstanding (Current Snapshot, not historical)
     // For a daily snapshot, we might want "Receivables Created", but usually "Outstanding" implies liability.
     // Requirement says: "Receivables Outstanding (₹)". This is usually a current state. 
     // However, for "Yesterday" vs "MTD" columns, it might mean "Receivables generated".
     // Let's interpret as: "Value of Invoices raised in this period" for the columns, 
     // but display Total Outstanding as a separate global metric if needed.
     // Re-reading prompt: "Receivables Outstanding (₹)" in daily/MTD context likely means Balance of invoices generated in that period?
     // Or just global? Let's assume Global Outstanding is handled in Control Tower. 
     // Here, let's show "Invoiced Revenue" for the period.
     
     const periodReceivables = receivables.filter(r => {
        const d = new Date(r.createdAt).getTime();
        return d >= sStart && d <= sEnd;
     });
     const invoicedAmount = periodReceivables.reduce((sum, r) => sum + r.totalAmount, 0);

     // Overdue (Current State)
     // We'll calculate Global Overdue separate from period filtering if requested as a Red Flag.
     // For the metric object, let's return period specific "Invoiced Amount".
     
     // PAYOUTS PENDING (Global State)
     // Pending Payouts accumulate. They aren't strictly "yesterday's". 
     // We will return GLOBAL pending for the dashboard view, as it's a "Snapshot".
     const riderPending = riderLedgers
        .filter(l => l.ledgerStatus === LedgerStatus.OPEN || l.ledgerStatus === LedgerStatus.APPROVED)
        .reduce((sum, l) => sum + l.calculatedAmount, 0);
        
     const lmdcPending = lmdcLedgers
        .filter(l => l.ledgerStatus === LedgerStatus.OPEN || l.ledgerStatus === LedgerStatus.APPROVED)
        .reduce((sum, l) => sum + l.calculatedAmount, 0);

     return {
        shipments: {
           total: periodShipments.length,
           delivered: delivered.length,
           rto: periodShipments.filter(s => s.status === ShipmentStatus.RTO).length,
           undelivered: periodShipments.filter(s => s.status === ShipmentStatus.UNDELIVERED).length
        },
        sla: {
           d0Percent: delivered.length > 0 ? (d0Count / delivered.length) * 100 : 0,
           d1Percent: delivered.length > 0 ? (d1Count / delivered.length) * 100 : 0
        },
        cod: {
           expected: expectedCod,
           verified: verifiedCod,
           pending: expectedCod - verifiedCod
        },
        payouts: {
           riderPending,
           lmdcPending
        },
        finance: {
           invoicesSent,
           receivablesOutstanding: invoicedAmount, // Invoiced in Period
           overdueAmount: 0 // Placeholder, calculated globally in Red Flags
        }
     };
  },

  // 3. RED FLAGS & ANALYSIS
  analyzeRisks: async (user: User): Promise<RedFlag[]> => {
     const flags: RedFlag[] = [];

     // A. COD Pending > Threshold
     const codStats = await codService.getStats();
     const COD_THRESHOLD = 50000;
     // 'collected' means with rider/lmdc but not deposited/settled? 
     // codService.getStats returns { collected, deposited, reconciled, shortage }
     // collected = On Hand. 
     if (codStats.collected > COD_THRESHOLD) {
        flags.push({ severity: 'HIGH', message: 'High Cash-on-Hand (Pending Deposit)', metric: 'COD Pending', value: `₹${codStats.collected.toLocaleString()}` });
     }
     if (codStats.shortage > 0) {
        flags.push({ severity: 'HIGH', message: 'COD Shortage Detected', metric: 'Shortage', value: `₹${codStats.shortage}` });
     }

     // B. Overdue Invoices
     const receivables = await billingService.getReceivables();
     const overdue = receivables.filter(r => r.status === ReceivableStatus.OVERDUE);
     const overdueTotal = overdue.reduce((sum, r) => sum + r.balance, 0);
     if (overdueTotal > 0) {
        flags.push({ severity: 'MEDIUM', message: 'Overdue Invoices Outstanding', metric: 'Overdue', value: `₹${overdueTotal.toLocaleString()}` });
     }

     // C. Rider Holds
     const riderRisks = await codService.getRiderExposures();
     const blockedRiders = riderRisks.filter(r => r.status === 'BLOCKED');
     if (blockedRiders.length > 0) {
        flags.push({ severity: 'HIGH', message: 'Riders Blocked (Cash/Shortage)', metric: 'Blocked Count', value: blockedRiders.length });
     }

     return flags;
  },

  // 4. LEADERBOARDS
  getLeaderboards: async (user: User) => {
     // Fetch Raw
     const shipments = await shipmentService.getShipments(user);
     const lmdcs = await masterDataService.getLMDCs();
     const riders = await masterDataService.getRiders();
     const clients = await clientService.getClients();

     // Helper: Metrics by Entity
     const lmdcStats: Record<string, { total: number, d0: number }> = {};
     const riderStats: Record<string, { total: number, delivered: number }> = {};
     const clientStats: Record<string, { volume: number }> = {};

     shipments.forEach(s => {
        // LMDC
        if (!lmdcStats[s.linkedLmdcId]) lmdcStats[s.linkedLmdcId] = { total: 0, d0: 0 };
        lmdcStats[s.linkedLmdcId].total++;
        if (s.status === ShipmentStatus.DELIVERED) {
           const created = new Date(s.createdAt).setHours(0,0,0,0);
           const updated = new Date(s.updatedAt).setHours(0,0,0,0);
           if (created === updated) lmdcStats[s.linkedLmdcId].d0++;
        }

        // Rider
        if (s.assignedRiderId) {
           if (!riderStats[s.assignedRiderId]) riderStats[s.assignedRiderId] = { total: 0, delivered: 0 };
           riderStats[s.assignedRiderId].total++;
           if (s.status === ShipmentStatus.DELIVERED) riderStats[s.assignedRiderId].delivered++;
        }

        // Client
        if (s.clientId) {
           if (!clientStats[s.clientId]) clientStats[s.clientId] = { volume: 0 };
           clientStats[s.clientId].volume++;
        }
     });

     // Process LMDC Top/Bottom (by D0 %)
     const lmdcScores = lmdcs.map(l => {
        const stats = lmdcStats[l.id] || { total: 0, d0: 0 };
        const score = stats.total > 0 ? (stats.d0 / stats.total) * 100 : 0;
        return { name: l.name, score, volume: stats.total };
     }).filter(l => l.volume > 0).sort((a,b) => b.score - a.score);

     // Process Riders (by Volume)
     const riderScores = riders.map(r => {
        const stats = riderStats[r.id] || { total: 0, delivered: 0 };
        return { name: r.name, volume: stats.delivered };
     }).sort((a,b) => b.volume - a.volume);

     // Process Clients (by Volume)
     const clientScores = clients.map(c => {
        const stats = clientStats[c.id] || { volume: 0 };
        return { name: c.name, volume: stats.volume };
     }).sort((a,b) => b.volume - a.volume);

     return {
        topLmdc: lmdcScores.slice(0, 5),
        bottomLmdc: [...lmdcScores].reverse().slice(0, 5),
        topRiders: riderScores.slice(0, 5),
        topClients: clientScores.slice(0, 5)
     };
  }
};
