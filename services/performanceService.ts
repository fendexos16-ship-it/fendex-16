
import { 
  User, 
  UserRole, 
  PerformanceMetrics, 
  AlertThreshold, 
  SlaBucket, 
  SlaState, 
  ShipmentStatus, 
  CodState 
} from '../types';
import { shipmentService } from './shipmentService';
import { slaService } from './slaService';
import { codService } from './codService';
import { masterDataService } from './masterDataService';

const THRESHOLDS_KEY = 'fendex_alert_thresholds_db';

const getThresholdsDb = (): AlertThreshold[] => {
  const stored = localStorage.getItem(THRESHOLDS_KEY);
  if (stored) return JSON.parse(stored);
  // Defaults
  return [
    { id: '1', metric: 'D0', condition: 'LESS_THAN', value: 80, isActive: true },
    { id: '2', metric: 'RTO_RATE', condition: 'GREATER_THAN', value: 15, isActive: true },
    { id: '3', metric: 'COD_TAT', condition: 'GREATER_THAN', value: 24, isActive: true },
  ];
};

const saveThresholdsDb = (data: AlertThreshold[]) => {
  localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(data));
};

export const performanceService = {

  getThresholds: async (): Promise<AlertThreshold[]> => {
    return getThresholdsDb();
  },

  updateThresholds: async (user: User, thresholds: AlertThreshold[]) => {
    if (user.role !== UserRole.FOUNDER) throw new Error("Unauthorized");
    saveThresholdsDb(thresholds);
  },

  // MAIN AGGREGATOR
  getMetrics: async (
    user: User, 
    filters: { start: string, end: string, city?: string, lmdcId?: string, riderId?: string }
  ): Promise<PerformanceMetrics> => {
    
    // 1. Fetch Raw Data
    const [shipments, slaRecords, codRecords] = await Promise.all([
      shipmentService.getShipments(user),
      slaService.getRecords(user), // Note: Need to verify if getRecords returns ALL for Founder
      codService.getAllRecords()
    ]);

    // 2. Apply Filters (Date & Scope)
    const startDate = new Date(filters.start).getTime();
    const endDate = new Date(filters.end).getTime() + (24 * 60 * 60 * 1000); // EOD

    let filteredShipments = shipments.filter(s => {
      const d = new Date(s.createdAt).getTime();
      return d >= startDate && d <= endDate;
    });

    if (filters.lmdcId) {
      filteredShipments = filteredShipments.filter(s => s.linkedLmdcId === filters.lmdcId);
    } else if (filters.city) {
      // Need LMDC City map. For speed, assume pre-filtered or fetch LMDCs.
      // Fetching LMDCs to filter by City
      const lmdcs = await masterDataService.getLMDCs();
      const cityLmdcIds = lmdcs.filter(l => l.city === filters.city).map(l => l.id);
      filteredShipments = filteredShipments.filter(s => cityLmdcIds.includes(s.linkedLmdcId));
    }

    if (filters.riderId) {
      filteredShipments = filteredShipments.filter(s => s.assignedRiderId === filters.riderId);
    }

    // 3. Compute Metrics
    const total = filteredShipments.length;
    if (total === 0) {
      return { total: 0, delivered: 0, rto: 0, d0Percent: 0, d1Percent: 0, fadPercent: 0, rtoPercent: 0, codPendingAmount: 0, avgDeliveryTatHrs: 0, avgCodVerifyHrs: 0 };
    }

    const delivered = filteredShipments.filter(s => s.status === ShipmentStatus.DELIVERED);
    const rto = filteredShipments.filter(s => s.status === ShipmentStatus.RTO);
    
    // SLA Calculations
    // Filter SLA records matching the filtered shipments
    const awbSet = new Set(filteredShipments.map(s => s.awb));
    const activeSlaRecords = slaRecords.filter(r => awbSet.has(r.shipmentId));

    const d0Count = activeSlaRecords.filter(r => r.slaBucket === SlaBucket.D0).length;
    const d1Count = activeSlaRecords.filter(r => r.slaBucket === SlaBucket.D1).length;
    
    // FAD (First Attempt Delivery) - Approximated if not explicitly tracked in SlaRecord
    // Assuming SlaRecord creation implies delivery success on first eval for this mvp logic
    // or we check if multiple scans exist. For now, assume delivered = fad.
    const fadCount = delivered.length; 

    // COD Calculations
    const codShipments = filteredShipments.filter(s => s.paymentMode === 'COD');
    const codRecordList = Object.values(codRecords).filter(r => awbSet.has(r.shipmentId));
    
    // Pending Amount
    const pendingCod = codRecordList
      .filter(r => r.state !== CodState.COD_SETTLED && r.state !== CodState.COD_DEPOSITED && r.state !== CodState.COD_VERIFIED)
      .reduce((sum, r) => sum + r.codAmount, 0);

    // Avg COD Verification Time
    let totalCodTime = 0;
    let verifiedCount = 0;
    codRecordList.forEach(r => {
      if (r.verifiedAt && r.collectedAt) {
        const diff = new Date(r.verifiedAt).getTime() - new Date(r.collectedAt).getTime();
        totalCodTime += diff;
        verifiedCount++;
      }
    });
    const avgCodHrs = verifiedCount > 0 ? (totalCodTime / verifiedCount) / (1000 * 60 * 60) : 0;

    // Avg Delivery TAT
    let totalDelTime = 0;
    delivered.forEach(s => {
       const start = new Date(s.createdAt).getTime();
       const end = new Date(s.updatedAt).getTime();
       totalDelTime += (end - start);
    });
    const avgDelHrs = delivered.length > 0 ? (totalDelTime / delivered.length) / (1000 * 60 * 60) : 0;

    return {
      total,
      delivered: delivered.length,
      rto: rto.length,
      d0Percent: (d0Count / (delivered.length || 1)) * 100,
      d1Percent: ((d0Count + d1Count) / (delivered.length || 1)) * 100,
      fadPercent: (fadCount / (delivered.length || 1)) * 100,
      rtoPercent: (rto.length / total) * 100,
      codPendingAmount: pendingCod,
      avgDeliveryTatHrs: avgDelHrs,
      avgCodVerifyHrs: avgCodHrs
    };
  },

  // AGGREGATION VIEW (Drill Down)
  getGroupedView: async (
    user: User, 
    groupBy: 'CITY' | 'LMDC' | 'RIDER', 
    filters: { start: string, end: string, parentId?: string }
  ) => {
    // 1. Get Base Data
    const lmdcs = await masterDataService.getLMDCs();
    const riders = await masterDataService.getRiders();
    
    const groups: any[] = [];

    // 2. Define Groups
    if (groupBy === 'CITY') {
      const cities = Array.from(new Set(lmdcs.map(l => l.city)));
      for (const city of cities) {
        const metrics = await performanceService.getMetrics(user, { ...filters, city });
        groups.push({ id: city, name: city, type: 'CITY', ...metrics });
      }
    } 
    else if (groupBy === 'LMDC') {
      // If parentId (City) provided, filter LMDCs
      const targetLmdcs = filters.parentId 
         ? lmdcs.filter(l => l.city === filters.parentId)
         : lmdcs;
      
      for (const lmdc of targetLmdcs) {
        const metrics = await performanceService.getMetrics(user, { ...filters, lmdcId: lmdc.id });
        groups.push({ id: lmdc.id, name: lmdc.name, type: 'LMDC', ...metrics });
      }
    }
    else if (groupBy === 'RIDER') {
      const targetRiders = filters.parentId 
         ? riders.filter(r => r.linkedLmdcId === filters.parentId)
         : riders;

      for (const rider of targetRiders) {
        const metrics = await performanceService.getMetrics(user, { ...filters, riderId: rider.id });
        groups.push({ id: rider.id, name: rider.name, type: 'RIDER', ...metrics });
      }
    }

    return groups;
  },

  checkAlerts: (metrics: PerformanceMetrics, thresholds: AlertThreshold[]): string[] => {
    const alerts: string[] = [];
    thresholds.forEach(t => {
      if (!t.isActive) return;
      let val = 0;
      if (t.metric === 'D0') val = metrics.d0Percent;
      if (t.metric === 'RTO_RATE') val = metrics.rtoPercent;
      if (t.metric === 'COD_TAT') val = metrics.avgCodVerifyHrs;

      if (t.condition === 'LESS_THAN' && val < t.value) {
        alerts.push(`Alert: ${t.metric} is ${val.toFixed(1)} (Threshold < ${t.value})`);
      }
      if (t.condition === 'GREATER_THAN' && val > t.value) {
        alerts.push(`Alert: ${t.metric} is ${val.toFixed(1)} (Threshold > ${t.value})`);
      }
    });
    return alerts;
  }
};
