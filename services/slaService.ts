import { 
  Shipment, 
  SlaRecord, 
  SlaAdjustment, 
  SlaState, 
  SlaBucket, 
  AdjustmentType, 
  User, 
  UserRole 
} from '../types';
import { complianceService } from './complianceService';

const SLA_RECORDS_KEY = 'fendex_sla_records_db';
const SLA_ADJUSTMENTS_KEY = 'fendex_sla_adjustments_db';

const getRecordsDb = (): Record<string, SlaRecord> => {
  const stored = localStorage.getItem(SLA_RECORDS_KEY);
  return stored ? JSON.parse(stored) : {};
};

const saveRecordsDb = (data: Record<string, SlaRecord>) => {
  localStorage.setItem(SLA_RECORDS_KEY, JSON.stringify(data));
};

const getAdjustmentsDb = (): SlaAdjustment[] => {
  const stored = localStorage.getItem(SLA_ADJUSTMENTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveAdjustmentsDb = (data: SlaAdjustment[]) => {
  localStorage.setItem(SLA_ADJUSTMENTS_KEY, JSON.stringify(data));
};

// Configurable Rules (Hardcoded for Phase 13)
const SLA_RULES = {
  RIDER_D2_PENALTY: { code: 'RIDER_D2_PENALTY', amount: 5, type: AdjustmentType.PENALTY, desc: 'D2+ Delivery Delay' },
  RIDER_D0_INCENTIVE: { code: 'RIDER_D0_INCENTIVE', amount: 3, type: AdjustmentType.INCENTIVE, desc: 'Same Day Delivery Bonus' }
};

export const slaService = {

  // --- 1. Evaluation Engine ---

  evaluateShipment: async (shipment: Shipment) => {
    // Only evaluate Delivered shipments
    if (!shipment.assignedRiderId) return;

    // Determine Dates
    const created = new Date(shipment.createdAt);
    const delivered = new Date(); // Assuming this is called at the moment of delivery
    
    // Normalize to Midnight for Day comparison
    const cDate = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    const dDate = new Date(delivered.getFullYear(), delivered.getMonth(), delivered.getDate());
    
    const diffTime = Math.abs(dDate.getTime() - cDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    let bucket = SlaBucket.NA;
    let state = SlaState.SLA_MET;

    if (diffDays === 0) {
      bucket = SlaBucket.D0;
    } else if (diffDays === 1) {
      bucket = SlaBucket.D1;
    } else {
      bucket = SlaBucket.D2_PLUS;
      state = SlaState.SLA_BREACHED;
    }

    const record: SlaRecord = {
      id: shipment.awb, // Map AWB as ID
      shipmentId: shipment.awb,
      riderId: shipment.assignedRiderId,
      lmdcId: shipment.linkedLmdcId,
      promisedDate: new Date(cDate.getTime() + (24 * 60 * 60 * 1000)).toISOString(), // Promised D1
      actualDeliveryDate: delivered.toISOString(),
      slaState: state,
      slaBucket: bucket,
      breachReason: state === SlaState.SLA_BREACHED ? 'Delivery beyond D1' : undefined,
      calculatedAt: new Date().toISOString()
    };

    const db = getRecordsDb();
    db[shipment.awb] = record;
    saveRecordsDb(db);
  },

  // --- 2. Data Retrieval ---

  getSlaStats: async () => {
    const db = getRecordsDb();
    const all = Object.values(db);
    return {
      d0: all.filter(r => r.slaBucket === SlaBucket.D0).length,
      d1: all.filter(r => r.slaBucket === SlaBucket.D1).length,
      d2plus: all.filter(r => r.slaBucket === SlaBucket.D2_PLUS).length,
      breached: all.filter(r => r.slaState === SlaState.SLA_BREACHED).length,
      met: all.filter(r => r.slaState === SlaState.SLA_MET).length,
      total: all.length
    };
  },

  getRecords: async (user: User): Promise<SlaRecord[]> => {
    await new Promise(r => setTimeout(r, 300));
    const db = getRecordsDb();
    // Ensure ID is present (backfill for existing records)
    const all = Object.values(db).map(r => ({ ...r, id: r.id || r.shipmentId }));

    if (user.role === UserRole.RIDER) {
      // Mock rider ID check using phone or direct ID map if available
      // For this mock, we assume filtering happens or rider sees only their own in a real DB
      return all.filter(r => r.riderId.includes('R') ); // Loose filter for mock
    }
    return all;
  },

  // --- 3. Adjustment Logic ---

  getPendingAdjustments: async (user: User): Promise<{ record: SlaRecord, suggestion: any }[]> => {
    if (user.role !== UserRole.FOUNDER) return [];

    const records = getRecordsDb();
    const adjustments = getAdjustmentsDb();
    const pending = [];

    // Identify records that match rules but lack adjustments
    for (const rec of Object.values(records)) {
      const existingAdj = adjustments.find(a => a.linkedShipmentId === rec.shipmentId);
      if (existingAdj) continue; // Already processed

      if (rec.slaBucket === SlaBucket.D2_PLUS) {
        pending.push({ record: { ...rec, id: rec.id || rec.shipmentId }, suggestion: SLA_RULES.RIDER_D2_PENALTY });
      } else if (rec.slaBucket === SlaBucket.D0) {
        pending.push({ record: { ...rec, id: rec.id || rec.shipmentId }, suggestion: SLA_RULES.RIDER_D0_INCENTIVE });
      }
    }

    return pending;
  },

  approveAdjustment: async (
    user: User, 
    shipmentId: string, 
    ruleCode: string, 
    note: string
  ) => {
    if (user.role !== UserRole.FOUNDER) throw new Error('Only Founder can approve adjustments.');

    const rule = Object.values(SLA_RULES).find(r => r.code === ruleCode);
    if (!rule) throw new Error('Invalid Rule Code');

    const records = getRecordsDb();
    const record = records[shipmentId];
    if (!record) throw new Error('SLA Record not found');

    const adjustments = getAdjustmentsDb();
    
    const adj: SlaAdjustment = {
      id: `ADJ-SLA-${Date.now()}`,
      entityType: 'RIDER', // Phase 13 focuses on Rider SLA primarily
      entityId: record.riderId,
      adjustmentType: rule.type,
      amount: rule.amount,
      ruleCode: rule.code,
      linkedShipmentId: shipmentId,
      approvedBy: user.id,
      approvedAt: new Date().toISOString(),
      notes: note
    };

    adjustments.unshift(adj);
    saveAdjustmentsDb(adjustments);

    await complianceService.logEvent(
      'SLA_OP',
      user,
      `Approved ${rule.type} of ₹${rule.amount} for ${shipmentId}`,
      { rule: ruleCode, entity: record.riderId }
    );
  },

  rejectAdjustment: async (user: User, shipmentId: string) => {
     if (user.role !== UserRole.FOUNDER) throw new Error('Unauthorized');
     
     // Mark record as exempted/processed to prevent re-suggestion
     const records = getRecordsDb();
     if (records[shipmentId]) {
       records[shipmentId].slaState = SlaState.SLA_EXEMPTED;
       records[shipmentId].breachReason = 'Manual Exemption by Founder';
       saveRecordsDb(records);
     }

     await complianceService.logEvent(
      'SLA_OP',
      user,
      `Exempted Shipment ${shipmentId} from SLA adjustments`,
      {}
    );
  },

  getCommittedAdjustments: async (user: User): Promise<SlaAdjustment[]> => {
    await new Promise(r => setTimeout(r, 300));
    return getAdjustmentsDb();
  }
};