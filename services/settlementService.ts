
import { 
  ClientSettlementBatch, 
  ClientSettlementRow, 
  ClientSettlementEntry, 
  SettlementState, 
  SettlementCycle, 
  ShipmentStatus, 
  PaymentMode,
  User,
  UserRole
} from '../types';
import { shipmentService } from './shipmentService';
import { codService } from './codService';
import { clientService } from './clientService';
import { complianceService } from './complianceService';
import { rateCardService } from './rateCardService';

const SETTLEMENT_BATCH_KEY = 'fendex_settlement_batches_db';
const SETTLEMENT_ENTRY_KEY = 'fendex_settlement_entries_db';

const getBatchesDb = (): ClientSettlementBatch[] => {
  const stored = localStorage.getItem(SETTLEMENT_BATCH_KEY);
  return stored ? JSON.parse(stored) : [];
};

const getEntriesDb = (): ClientSettlementEntry[] => {
  const stored = localStorage.getItem(SETTLEMENT_ENTRY_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveBatchesDb = (data: ClientSettlementBatch[]) => {
  localStorage.setItem(SETTLEMENT_BATCH_KEY, JSON.stringify(data));
};

const saveEntriesDb = (data: ClientSettlementEntry[]) => {
  localStorage.setItem(SETTLEMENT_ENTRY_KEY, JSON.stringify(data));
};

export const settlementService = {
  
  getBatches: async (clientId?: string, role?: UserRole): Promise<ClientSettlementBatch[]> => {
    await new Promise(r => setTimeout(r, 300));
    const all = getBatchesDb();
    if (clientId && role !== UserRole.FOUNDER && role !== UserRole.FINANCE_ADMIN) {
       return all.filter(b => b.clientId === clientId);
    }
    return all;
  },

  getClientLedger: async (clientId: string) => {
     // Calculate stats for client dashboard
     const batches = getBatchesDb();
     const clientBatches = batches.filter(b => b.clientId === clientId);
     
     const totalSettled = clientBatches
        .filter(b => b.status === SettlementState.SETTLED)
        .reduce((sum, b) => sum + b.netAmount, 0);
        
     const unsettled = clientBatches
        .filter(b => b.status !== SettlementState.SETTLED)
        .reduce((sum, b) => sum + b.netAmount, 0);

     // "Total Collected" - we can estimate from batches or fetch all shipments
     // For speed, let's use batches
     const totalCollected = clientBatches.reduce((sum, b) => sum + b.totalCodAmount, 0);

     return { totalSettled, unsettled, totalCollected };
  },

  generateStatement: async (
    user: User, 
    clientId: string, 
    start: string, 
    end: string, 
    onlyDeposited: boolean
  ): Promise<{ rows: ClientSettlementRow[], totals: { cod: number, fees: number, net: number } }> => {
    
    // 1. Fetch Shipments
    const allShipments = await shipmentService.getShipments({ role: UserRole.FOUNDER } as any);
    
    // 2. Filter Candidate Shipments
    // Criteria: 
    // - Belongs to Client
    // - Delivered
    // - Date in Range (Delivery Date or Created Date? Usually Delivery Date for Settlement)
    // - NOT already in a settlement batch
    
    const entriesDb = getEntriesDb();
    const settledShipmentIds = new Set(entriesDb.map(e => e.shipmentId));

    const startDate = new Date(start).setHours(0,0,0,0);
    const endDate = new Date(end).setHours(23,59,59,999);

    const candidates = allShipments.filter(s => {
       if (s.clientId !== clientId) return false;
       if (s.status !== ShipmentStatus.DELIVERED && s.status !== ShipmentStatus.RTO) return false;
       if (settledShipmentIds.has(s.id)) return false; // Already processed

       const dateStr = s.updatedAt; // Delivery Date
       const d = new Date(dateStr).getTime();
       return d >= startDate && d <= endDate;
    });

    const rows: ClientSettlementRow[] = [];
    let totalCod = 0;
    let totalFees = 0;

    const codRecords = JSON.parse(localStorage.getItem('fendex_cod_records_db') || '{}');
    const deposits = JSON.parse(localStorage.getItem('fendex_cod_deposits_db') || '[]');

    for (const s of candidates) {
       // 3. COD Verification
       let codStatus: 'COLLECTED' | 'DEPOSITED' | 'PENDING' = 'PENDING';
       let cmsRef = undefined;

       if (s.paymentMode === PaymentMode.COD) {
          const rec = codRecords[s.awb];
          if (rec) {
             if (rec.state === 'COD_VERIFIED' || rec.state === 'COD_DEPOSITED' || rec.state === 'COD_SETTLED') {
                codStatus = rec.state === 'COD_VERIFIED' ? 'COLLECTED' : 'DEPOSITED';
                if (rec.depositId) {
                   const dep = deposits.find((d: any) => d.id === rec.depositId);
                   if (dep) cmsRef = dep.referenceNo;
                }
             } else if (rec.state === 'COD_COLLECTED' || rec.state === 'COD_HANDOVER_INITIATED') {
                codStatus = 'COLLECTED';
             }
          }
       } else {
          codStatus = 'COLLECTED'; // Prepaid is effectively collected
       }

       if (s.paymentMode === PaymentMode.COD && onlyDeposited && codStatus !== 'DEPOSITED') {
          continue; // Skip if strict mode
       }

       // 4. Rate Calculation
       const fees = await rateCardService.calculateClientFees({
          clientId,
          shipmentType: s.shipmentType,
          geoType: s.geoType,
          status: s.status,
          paymentMode: s.paymentMode,
          codAmount: s.codAmount,
          date: s.updatedAt
       });

       const net = (s.paymentMode === PaymentMode.COD ? s.codAmount : 0) - fees.totalDeductions;

       rows.push({
          awb: s.awb,
          deliveryDate: s.updatedAt,
          codAmount: s.paymentMode === PaymentMode.COD ? s.codAmount : 0,
          freightAmount: fees.freightAmount,
          codFee: fees.codFee,
          rtoFee: fees.rtoFee,
          platformFee: fees.platformFee,
          feeAmount: fees.totalDeductions,
          netAmount: net,
          codStatus,
          cmsReference: cmsRef,
          appliedRateCardId: fees.appliedRateCardId
       });

       totalCod += (s.paymentMode === PaymentMode.COD ? s.codAmount : 0);
       totalFees += fees.totalDeductions;
    }

    return {
       rows,
       totals: { cod: totalCod, fees: totalFees, net: totalCod - totalFees }
    };
  },

  createBatch: async (
    user: User, 
    clientId: string, 
    range: { start: string, end: string }, 
    rows: ClientSettlementRow[]
  ): Promise<ClientSettlementBatch> => {
     
     const batches = getBatchesDb();
     const entries = getEntriesDb();
     
     // Recalculate totals for safety
     const totalCod = rows.reduce((s, r) => s + r.codAmount, 0);
     const totalFees = rows.reduce((s, r) => s + r.feeAmount, 0);
     const netAmount = totalCod - totalFees;

     const client = (await clientService.getClients()).find(c => c.id === clientId);

     const batchId = `SET-${Date.now()}`;
     const batchCode = `SET/${client?.clientCode}/${Date.now().toString().slice(-6)}`;

     const newBatch: ClientSettlementBatch = {
        id: batchId,
        clientId,
        clientName: client?.name || 'Unknown',
        batchCode,
        cycle: client?.settlementCycle || SettlementCycle.WEEKLY,
        periodStart: range.start,
        periodEnd: range.end,
        totalCodAmount: totalCod,
        totalFees,
        netAmount,
        shipmentCount: rows.length,
        status: SettlementState.DRAFT,
        generatedBy: user.id,
        generatedAt: new Date().toISOString()
     };

     // Create Entries
     const newEntries = rows.map(r => ({
        ...r,
        id: `SE-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
        batchId,
        clientId,
        shipmentId: r.awb
     }));

     batches.unshift(newBatch);
     entries.push(...newEntries);
     
     saveBatchesDb(batches);
     saveEntriesDb(entries);

     await complianceService.logEvent('SETTLEMENT_OP', user, `Generated Settlement ${batchCode}`, { count: rows.length, net: netAmount });
     
     return newBatch;
  },

  updateStatus: async (
     user: User, 
     batchId: string, 
     status: SettlementState, 
     bankRef?: string, 
     notes?: string
  ): Promise<void> => {
     const batches = getBatchesDb();
     const idx = batches.findIndex(b => b.id === batchId);
     if (idx === -1) throw new Error('Batch not found');
     
     const batch = batches[idx];
     batch.status = status;
     if (bankRef) batch.bankReference = bankRef;
     if (notes) batch.notes = notes;
     if (status === SettlementState.SHARED) batch.sharedAt = new Date().toISOString();
     if (status === SettlementState.SETTLED) batch.settledAt = new Date().toISOString();

     batches[idx] = batch;
     saveBatchesDb(batches);

     await complianceService.logEvent('SETTLEMENT_OP', user, `Updated Batch ${batch.batchCode} to ${status}`, { ref: bankRef });
  },

  getBatchReport: async (batchId: string): Promise<any[]> => {
     const batches = getBatchesDb();
     const batch = batches.find(b => b.id === batchId);
     if (!batch) throw new Error("Batch not found");

     const allEntries = getEntriesDb();
     const batchEntries = allEntries.filter(e => e.batchId === batchId);

     return batchEntries.map(e => ({
        ...e,
        clientName: batch.clientName,
        settlementStatus: batch.status,
        settlementRef: batch.bankReference
     }));
  }
};
