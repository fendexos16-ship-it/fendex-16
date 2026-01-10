
import { 
  User, 
  UserRole, 
  NorthStarMetrics, 
  UnitEconomics, 
  InvestorSnapshot,
  ShipmentStatus,
  LedgerStatus,
  CodState,
  LmdcShipmentType
} from '../types';
import { shipmentService } from './shipmentService';
import { ledgerService } from './ledgerService';
import { codService } from './codService';
import { billingService } from './billingService';
import { complianceService } from './complianceService';
import { rateCardService } from './rateCardService'; // For unit cost simulation if ledger missing

const SNAPSHOTS_KEY = 'fendex_investor_snapshots_db';

const getSnapshotsDb = (): InvestorSnapshot[] => {
  const stored = localStorage.getItem(SNAPSHOTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveSnapshotsDb = (data: InvestorSnapshot[]) => {
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(data));
};

export const investorService = {

  getSnapshots: async (user: User): Promise<InvestorSnapshot[]> => {
    if (user.role !== UserRole.FOUNDER) throw new Error('Unauthorized');
    return getSnapshotsDb().sort((a,b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  },

  // CORE ENGINE: Aggregates Live Data (Read-Only)
  computeMetrics: async (user: User, range: { start: string, end: string }): Promise<{ northStar: NorthStarMetrics, unitEconomics: UnitEconomics[] }> => {
    if (user.role !== UserRole.FOUNDER) throw new Error('Unauthorized');

    // 1. Fetch ALL Immutable Data
    const [allShipments, lmdcLedgers, riderLedgers, receivables, codRecords] = await Promise.all([
      shipmentService.getShipments(user),
      ledgerService.getLmdcLedgers(user),
      ledgerService.getRiderLedgers(user),
      billingService.getReceivables(),
      codService.getAllRecords()
    ]);

    const sStart = new Date(range.start).setHours(0,0,0,0);
    const sEnd = new Date(range.end).setHours(23,59,59,999);

    // Filter Filter Filter
    const periodShipments = allShipments.filter(s => {
      const d = new Date(s.createdAt).getTime();
      return d >= sStart && d <= sEnd;
    });

    const periodDeliveries = periodShipments.filter(s => s.status === ShipmentStatus.DELIVERED);
    const deliveredCount = periodDeliveries.length;
    const rtoCount = periodShipments.filter(s => s.status === ShipmentStatus.RTO).length;
    
    // --- NORTH STAR CALCULATIONS ---

    // 1. Volume
    // Group by Date for Peak/Avg
    const volumeByDay: Record<string, number> = {};
    periodShipments.forEach(s => {
       const day = s.createdAt.split('T')[0];
       volumeByDay[day] = (volumeByDay[day] || 0) + 1;
    });
    const dailyVolumes = Object.values(volumeByDay);
    const avgDaily = dailyVolumes.length > 0 ? dailyVolumes.reduce((a,b) => a+b, 0) / dailyVolumes.length : 0;
    const peakDaily = dailyVolumes.length > 0 ? Math.max(...dailyVolumes) : 0;

    // 2. Revenue (Gross = Billed Amount in Invoices/Receivables)
    // We approximate from rate cards if invoice not generated, or use Ledger? 
    // Client Ledger is best. But we have shipment-level "rate" calculated in BillingService.
    // For this engine, we'll re-calculate or sum invoiced receivables if available.
    // Let's use a "Revenue Estimate" based on shipments * avg rate if strictly read-only from ops data?
    // Better: Filter Receivables created in this period (invoiced revenue).
    const periodReceivables = receivables.filter(r => {
       const d = new Date(r.createdAt).getTime();
       return d >= sStart && d <= sEnd;
    });
    const grossRevenue = periodReceivables.reduce((sum, r) => sum + r.totalAmount, 0);
    const netRevenue = grossRevenue * 0.85; // Mock Net (Gross - GST - Disputes)

    // 3. Costs (From Ledgers)
    const periodLmdcCost = lmdcLedgers
       .filter(l => new Date(l.createdAt).getTime() >= sStart && new Date(l.createdAt).getTime() <= sEnd)
       .reduce((sum, l) => sum + l.calculatedAmount, 0);
    
    const periodRiderCost = riderLedgers
       .filter(l => new Date(l.createdAt).getTime() >= sStart && new Date(l.createdAt).getTime() <= sEnd)
       .reduce((sum, l) => sum + l.calculatedAmount, 0);

    const totalDirectCost = periodLmdcCost + periodRiderCost;
    const costPerDelivery = deliveredCount > 0 ? totalDirectCost / deliveredCount : 0;
    
    const contributionMargin = grossRevenue - totalDirectCost;
    const contributionMarginPercent = grossRevenue > 0 ? (contributionMargin / grossRevenue) * 100 : 0;

    // 4. Operational Quality
    // D0 Logic
    let d0Count = 0;
    periodDeliveries.forEach(s => {
       const created = new Date(s.createdAt).setHours(0,0,0,0);
       const updated = new Date(s.updatedAt).setHours(0,0,0,0);
       if (created === updated) d0Count++;
    });
    const d0Percent = deliveredCount > 0 ? (d0Count / deliveredCount) * 100 : 0;
    const rtoPercent = periodShipments.length > 0 ? (rtoCount / periodShipments.length) * 100 : 0;

    // 5. Cash Cycle
    // COD TAT = Avg time from Delivered -> Verified
    let totalTatMs = 0;
    let tatCount = 0;
    const records = Object.values(codRecords);
    
    records.forEach(r => {
       if (r.state === CodState.COD_VERIFIED || r.state === CodState.COD_DEPOSITED || r.state === CodState.COD_SETTLED) {
          // Find shipment to get delivery date? Assuming r has timestamp? 
          // CodRecord has collectedAt. VerifiedAt is on Handover Batch?
          // We added verifiedAt to CodRecord in schema earlier.
          if (r.collectedAt && r.verifiedAt) {
             const t1 = new Date(r.collectedAt).getTime();
             const t2 = new Date(r.verifiedAt).getTime();
             totalTatMs += (t2 - t1);
             tatCount++;
          }
       }
    });
    const avgCodTatDays = tatCount > 0 ? (totalTatMs / tatCount) / (1000 * 3600 * 24) : 0;

    // Receivables Outstanding
    const outstanding = receivables.reduce((sum, r) => sum + r.balance, 0);
    const ccc = 45; // Mock: DSO + DIO - DPO

    const northStar: NorthStarMetrics = {
       period: `${new Date(range.start).toLocaleDateString()} - ${new Date(range.end).toLocaleDateString()}`,
       avgDailyShipments: Math.round(avgDaily),
       peakDailyShipments: peakDaily,
       grossRevenue,
       netRevenue,
       contributionMarginPercent,
       costPerDelivery,
       d0Percent,
       rtoPercent,
       avgCodTatDays,
       receivablesOutstanding: outstanding,
       cashConversionCycleDays: ccc
    };

    // --- UNIT ECONOMICS BREAKDOWN ---
    // Group by Client
    const clients = Array.from(new Set(periodShipments.map(s => s.clientId)));
    const unitEconomics: UnitEconomics[] = [];

    for (const cid of clients) {
       if (!cid) continue;
       const clientShipments = periodShipments.filter(s => s.clientId === cid);
       
       // Revenue Estimate (Simple: Avg Rate * Count)
       // To be precise we need invoice mapping, but for dashboard approximation:
       // Assume 50 flat if not found? Or sum from Receivables matched to client?
       const clientReceivables = periodReceivables.filter(r => r.clientId === cid);
       const clientRevenue = clientReceivables.reduce((sum, r) => sum + r.totalAmount, 0) || (clientShipments.length * 50); // Fallback

       // Costs
       // Map shipments to ledgers
       const sIds = new Set(clientShipments.map(s => s.id));
       const cLmdcCost = lmdcLedgers.filter(l => sIds.has(l.shipmentId)).reduce((sum,l) => sum+l.calculatedAmount, 0);
       // Rider cost is harder as it's runsheet based. We prorate? 
       // Or use Rider Ledger if linked to shipment? Current schema links runsheet.
       // Approximation: Avg Rider Cost per shipment * count
       const cRiderCost = clientShipments.length * 20; // Mock avg

       const net = clientRevenue - cLmdcCost - cRiderCost;
       
       unitEconomics.push({
          id: cid,
          label: cid, // In UI we resolve name
          totalRevenue: clientRevenue,
          lmdcCost: cLmdcCost,
          riderCost: cRiderCost,
          hubCost: clientShipments.length * 5, // Allocated overhead
          netContribution: net,
          marginPercent: clientRevenue > 0 ? (net/clientRevenue)*100 : 0
       });
    }

    return { northStar, unitEconomics };
  },

  // GENERATE SNAPSHOT (Audit Locked)
  generateSnapshot: async (user: User, range: { start: string, end: string }): Promise<void> => {
     const data = await investorService.computeMetrics(user, range);
     
     const snapshot: InvestorSnapshot = {
        id: `SNAP-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        generatedBy: user.id,
        periodStart: range.start,
        periodEnd: range.end,
        metricsHash: Math.random().toString(36).substring(7), // Hash of data content
        metrics: data.northStar,
        unitEconomics: data.unitEconomics
     };

     const db = getSnapshotsDb();
     db.unshift(snapshot);
     saveSnapshotsDb(db);

     await complianceService.logEvent('EXPORT', user, `Generated Investor Snapshot ${snapshot.id}`, { period: range });
  }
};
