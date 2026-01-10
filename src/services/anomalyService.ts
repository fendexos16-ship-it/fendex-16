
import { 
  User, 
  UserRole, 
  Anomaly, 
  AnomalyCategory, 
  AnomalySeverity, 
  Baseline, 
  ShipmentStatus, 
  CodState,
  LedgerStatus,
  Shipment,
  CodRecord,
  ComplianceLog
} from '../types';
import { shipmentService } from './shipmentService';
import { codService } from './codService';
import { ledgerService } from './ledgerService';
import { complianceService } from './complianceService';
import { authService } from './authService';

const ANOMALY_KEY = 'fendex_anomalies_db';
const BASELINE_KEY = 'fendex_baselines_db';

const getAnomaliesDb = (): Anomaly[] => {
  const stored = localStorage.getItem(ANOMALY_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveAnomaliesDb = (data: Anomaly[]) => {
  localStorage.setItem(ANOMALY_KEY, JSON.stringify(data));
};

const getBaselinesDb = (): Baseline[] => {
  const stored = localStorage.getItem(BASELINE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveBaselinesDb = (data: Baseline[]) => {
  localStorage.setItem(BASELINE_KEY, JSON.stringify(data));
};

export const anomalyService = {

  // --- 1. DATA INGESTION & BASELINE CALCULATION ---
  
  // This simulation calculates baselines from current historical data available
  calculateBaselines: async (user: User): Promise<void> => {
     // Guard: Only Founder can trigger model training
     authService.requireRole(user, UserRole.FOUNDER);

     const baselines = getBaselinesDb();
     const [shipments, codRecords, lmdcLedgers, logs] = await Promise.all([
        shipmentService.getShipments(user),
        codService.getAllRecords(),
        ledgerService.getLmdcLedgers(user),
        complianceService.getLogs(user.role)
     ]) as [Shipment[], Record<string, CodRecord>, any[], ComplianceLog[]];

     // Helper to update/create baseline
     const upsertBaseline = (entityId: string, metric: string, value: number) => {
        // Simple rolling average logic for simulation
        let bl = baselines.find(b => b.entityId === entityId && b.metric === metric);
        if (!bl) {
           bl = {
              id: `BL-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
              entityId,
              metric,
              windowDays: 30,
              mean: value,
              stdDev: value * 0.1, // Mock stdDev
              lastUpdated: new Date().toISOString()
           };
           baselines.push(bl);
        } else {
           // Weighted average update
           bl.mean = (bl.mean * 0.9) + (value * 0.1);
           bl.lastUpdated = new Date().toISOString();
        }
     };

     // A. OPS: RTO RATE (Global & Per LMDC)
     const lmdcGroups = new Set(shipments.map(s => s.linkedLmdcId));
     lmdcGroups.forEach(lmdcId => {
        const lmdcShipments = shipments.filter(s => s.linkedLmdcId === lmdcId);
        const total = lmdcShipments.length;
        if (total > 0) {
           const rto = lmdcShipments.filter(s => s.status === ShipmentStatus.RTO).length;
           const rate = (rto / total) * 100;
           upsertBaseline(lmdcId, 'RTO_RATE', rate);
        }
     });

     // B. CASH: Shortage Rate
     const allCod = Object.values(codRecords);
     const totalCollected = allCod.reduce((sum, r) => sum + r.codAmount, 0);
     const totalShort = allCod.filter(r => r.state === CodState.COD_SHORT).reduce((sum, r) => sum + r.codAmount, 0);
     const shortageRate = totalCollected > 0 ? (totalShort / totalCollected) * 100 : 0;
     upsertBaseline('SYSTEM', 'COD_SHORTAGE_RATE', shortageRate);

     // C. SECURITY: Login Failure Rate
     const authLogs = logs.filter(l => l.eventType === 'AUTH_FAILURE');
     // Simplified: Count failures per day (mocking rate)
     upsertBaseline('SYSTEM', 'LOGIN_FAILURE_RATE', authLogs.length); // failures/month estimate

     saveBaselinesDb(baselines);
  },

  // --- 2. DETECTION ENGINE ---

  runDetection: async (user: User): Promise<Anomaly[]> => {
     // Guard
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) return [];

     await anomalyService.calculateBaselines(user); // Refresh baselines first
     
     const anomalies = getAnomaliesDb();
     const baselines = getBaselinesDb();
     const [shipments, logs] = await Promise.all([
        shipmentService.getShipments(user),
        complianceService.getLogs(user.role)
     ]) as [Shipment[], ComplianceLog[]];

     const createAlert = (cat: AnomalyCategory, metric: string, entityId: string, entityName: string, observed: number, baseline: Baseline, sev: AnomalySeverity, reason: string) => {
        // Idempotency: Don't create duplicate NEW alert for same entity/metric today
        const today = new Date().toISOString().split('T')[0];
        const exists = anomalies.find(a => 
           a.metric === metric && 
           a.entityId === entityId && 
           a.status === 'NEW' && 
           a.detectedAt.startsWith(today)
        );
        if (exists) return;

        const confidence = Math.min(100, Math.round(Math.abs((observed - baseline.mean) / (baseline.stdDev || 1)) * 20 + 50)); 

        anomalies.unshift({
           id: `ANM-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
           category: cat,
           metric,
           entityId,
           entityName,
           detectedAt: new Date().toISOString(),
           severity: sev,
           confidence,
           baselineValue: baseline.mean,
           observedValue: observed,
           description: reason,
           status: 'NEW'
        });
     };

     // 1. OPS ANOMALIES (RTO Spike)
     const lmdcGroups = new Set(shipments.map(s => s.linkedLmdcId));
     lmdcGroups.forEach(lmdcId => {
        const lmdcShipments = shipments.filter(s => s.linkedLmdcId === lmdcId);
        const total = lmdcShipments.length;
        if (total > 10) {
           const rto = lmdcShipments.filter(s => s.status === ShipmentStatus.RTO).length;
           const currentRate = (rto / total) * 100;
           
           const bl = baselines.find(b => b.entityId === lmdcId && b.metric === 'RTO_RATE');
           if (bl) {
              // Threshold: > 2x Baseline or > 10% absolute deviation
              if (currentRate > bl.mean * 2 && currentRate > 5) {
                 createAlert(
                    AnomalyCategory.OPS, 
                    'RTO_RATE_SPIKE', 
                    lmdcId, 
                    lmdcId, // Ideally fetch name
                    currentRate, 
                    bl, 
                    AnomalySeverity.HIGH, 
                    `RTO Rate ${currentRate.toFixed(1)}% is significantly higher than baseline ${bl.mean.toFixed(1)}%`
                 );
              }
           }
        }
     });

     // 2. SECURITY ANOMALIES (Login Spike)
     // Count failures in last hour
     const now = Date.now();
     const recentFailures = logs.filter(l => 
        l.eventType === 'AUTH_FAILURE' && 
        (now - new Date(l.timestamp).getTime() < 3600000)
     ).length;
     
     const authBl = baselines.find(b => b.entityId === 'SYSTEM' && b.metric === 'LOGIN_FAILURE_RATE');
     // Baseline is monthly count, so hourly avg is mean / 720. 
     // Let's use a simpler heuristic: if > 5 failures in an hour
     if (recentFailures > 5) {
         createAlert(
            AnomalyCategory.SECURITY,
            'AUTH_BRUTE_FORCE',
            'SYSTEM',
            'Authentication System',
            recentFailures,
            { mean: 1, stdDev: 1 } as any, // Mock baseline for hourly
            AnomalySeverity.HIGH,
            `Detected ${recentFailures} login failures in the last hour. Potential brute force.`
         );
     }

     saveAnomaliesDb(anomalies);
     return anomalies;
  },

  // --- 3. MANAGEMENT ---

  getAnomalies: async (): Promise<Anomaly[]> => {
     await new Promise(r => setTimeout(r, 200));
     return getAnomaliesDb();
  },

  getBaselines: async (): Promise<Baseline[]> => {
     await new Promise(r => setTimeout(r, 200));
     return getBaselinesDb();
  },

  submitFeedback: async (user: User, anomalyId: string, feedback: 'TRUE_POSITIVE' | 'FALSE_POSITIVE', notes: string): Promise<void> => {
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) throw new Error("Unauthorized");
     
     const anomalies = getAnomaliesDb();
     const idx = anomalies.findIndex(a => a.id === anomalyId);
     if (idx === -1) throw new Error("Anomaly not found");
     
     anomalies[idx].status = feedback;
     anomalies[idx].feedbackNotes = notes;
     saveAnomaliesDb(anomalies);

     // If False Positive, adjust baseline to be more tolerant (Training Loop Simulation)
     if (feedback === 'FALSE_POSITIVE') {
        const baselines = getBaselinesDb();
        const bl = baselines.find(b => b.entityId === anomalies[idx].entityId && b.metric === anomalies[idx].metric);
        if (bl) {
           bl.mean = (bl.mean + anomalies[idx].observedValue) / 2; // Shift mean towards observation
           bl.stdDev = bl.stdDev * 1.2; // Widen variance tolerance
           saveBaselinesDb(baselines);
        }
     }

     await complianceService.logEvent('ANOMALY_FEEDBACK', user, `Marked ${anomalyId} as ${feedback}`, { notes });
  }

};
