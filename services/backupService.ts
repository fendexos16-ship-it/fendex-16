
import { BackupRecord, User, UserRole, BackupConfig, DRStatus, RestoreDrill } from '../types';
import { complianceService } from './complianceService';
import { systemConfigService } from './systemConfigService';

const BACKUP_INDEX_KEY = 'fendex_backups_index';
const RESTORE_DRILLS_KEY = 'fendex_restore_drills_db';

// CRITICAL: Definitive List of all persistent storage keys in the system.
// This ensures backups are comprehensive and don't miss new modules.
const CRITICAL_KEYS = [
  'fendex_users_v2_db',
  'fendex_shipments_db',
  'fendex_lmdc_ledger_db',
  'fendex_rider_ledger_db',
  'fendex_cod_records_db',
  'fendex_cod_deposits_db',
  'fendex_cod_adjustments_db',
  'fendex_payout_batches_db',
  'fendex_dcs_db',
  'fendex_mmdcs_db',
  'fendex_lmdcs_db',
  'fendex_riders_db',
  'fendex_pincode_db',
  'fendex_client_db',
  'fendex_courier_db',
  'fendex_lmdc_rates',
  'fendex_rider_rates',
  'fendex_sla_records_db',
  'fendex_sla_adjustments_db',
  'fendex_bags_db',
  'fendex_bag_exceptions_db',
  'fendex_trips_db',
  'fendex_pickups_db',
  'fendex_runsheets_db',
  'fendex_atlas_areas_db',
  'fendex_atlas_audit_db',
  'fendex_gateway_credentials_db',
  'fendex_system_config',
  'fendex_compliance_logs_db',
  'fendex_client_credentials_db',
  'fendex_client_permissions_db',
  'fendex_client_ledger_db',
  'fendex_invoices_db',
  'fendex_receivables_db',
  'fendex_financial_notes_db',
  'fendex_collection_records_db',
  'fendex_reminder_config_db',
  'fendex_reminder_logs_db',
  'fendex_investor_snapshots_db'
];

const getIndex = (): BackupRecord[] => {
  const stored = localStorage.getItem(BACKUP_INDEX_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveIndex = (index: BackupRecord[]) => {
  localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(index));
};

const getDrillsDb = (): RestoreDrill[] => {
  const stored = localStorage.getItem(RESTORE_DRILLS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveDrillsDb = (drills: RestoreDrill[]) => {
  localStorage.setItem(RESTORE_DRILLS_KEY, JSON.stringify(drills));
};

export const backupService = {
  
  getBackups: async (): Promise<BackupRecord[]> => {
    await new Promise(r => setTimeout(r, 200));
    return getIndex().sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  getConfig: async (): Promise<BackupConfig> => {
     const sysConfig = await systemConfigService.getConfig();
     return sysConfig.backupConfig || {
        dbSchedule: 'HOURLY',
        storageSchedule: 'DAILY',
        retentionDays: 30,
        wormEnabled: true
     };
  },

  updateConfig: async (user: User, config: BackupConfig) => {
     if (user.role !== UserRole.FOUNDER) throw new Error("Unauthorized");
     await systemConfigService.updateConfig(user, { backupConfig: config });
  },

  createBackup: async (user: User): Promise<BackupRecord> => {
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.ADMIN) throw new Error('Only Founder/Admin can create backups.');

    const snapshot: Record<string, string> = {};
    let size = 0;
    let keyCount = 0;

    // Explicitly iterate known critical keys
    for (const key of CRITICAL_KEYS) {
      const val = localStorage.getItem(key);
      if (val) {
        snapshot[key] = val;
        size += val.length;
        keyCount++;
      }
    }

    const backupId = `BKP-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // In production, we would upload `snapshot` to S3/BlobStorage.
    // For this simulation, we verify we *could* create it, but avoid storing 
    // the massive JSON in LocalStorage to prevent quota limits.
    // We store the METADATA heavily.
    
    const record: BackupRecord = {
      id: backupId,
      timestamp,
      sizeBytes: size,
      type: 'FULL',
      createdBy: user.name,
      checksum: Math.random().toString(36).substring(7) // Mock Checksum
    };

    const index = getIndex();
    index.unshift(record);
    // Keep only last 50 backups metadata for simulation
    if (index.length > 50) index.pop();
    
    saveIndex(index);

    await complianceService.logEvent('BACKUP_OP', user, `Created Full System Backup ${backupId}`, { size, keysBackedUp: keyCount });
    
    return record;
  },

  restoreBackup: async (backupId: string, user: User) => {
    if (user.role !== UserRole.FOUNDER) throw new Error('Only Founder can restore backups.');
    
    // Simulation
    await new Promise(r => setTimeout(r, 1500));
    
    await complianceService.logEvent('BACKUP_OP', user, `[SIMULATION] Restored System from Backup ${backupId}`, { status: 'RESTORE_DRILL_PASS' });
    
    return true;
  },

  // DISASTER RECOVERY
  getDRStatus: async (): Promise<DRStatus> => {
     // Mock Logic based on system state
     const backups = getIndex();
     const lastBackup = backups.length > 0 ? backups[0].timestamp : 'NEVER';
     const sysConfig = await systemConfigService.getConfig();
     
     // Mock Lag Calculation
     const lag = backups.length > 0 ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 1000) : 99999;

     return {
        region: sysConfig.drRegion || 'ap-south-2',
        role: 'STANDBY',
        health: 'HEALTHY',
        replicationLagSeconds: lag,
        lastBackupAt: lastBackup
     };
  },

  initiateFailover: async (user: User) => {
     if (user.role !== UserRole.FOUNDER) throw new Error("Unauthorized");
     
     // 1. Log Start
     await complianceService.logEvent('DR_FAILOVER', user, 'INITIATING FAILOVER SEQUENCE', { target: 'DR_REGION' });
     
     // 2. Enable Incident Mode (Freeze)
     await systemConfigService.toggleIncidentMode(user, true, "Failover in Progress");

     // 3. Simulate Promotion
     await new Promise(r => setTimeout(r, 3000));

     // 4. Log Completion
     await complianceService.logEvent('DR_FAILOVER', user, 'FAILOVER COMPLETED. SYSTEM RUNNING ON DR.', {});
  },

  // DRILLS
  scheduleDrill: async (user: User): Promise<void> => {
     if (user.role !== UserRole.FOUNDER) throw new Error("Unauthorized");
     const drills = getDrillsDb();
     const newDrill: RestoreDrill = {
        id: `DRILL-${Date.now()}`,
        scheduledDate: new Date().toISOString(),
        status: 'PENDING'
     };
     drills.unshift(newDrill);
     saveDrillsDb(drills);
  },

  executeDrill: async (user: User, drillId: string, success: boolean, notes: string): Promise<void> => {
     if (user.role !== UserRole.FOUNDER) throw new Error("Unauthorized");
     const drills = getDrillsDb();
     const idx = drills.findIndex(d => d.id === drillId);
     if (idx === -1) throw new Error("Drill not found");

     drills[idx].status = success ? 'SUCCESS' : 'FAILED';
     drills[idx].executedAt = new Date().toISOString();
     drills[idx].verifiedBy = user.id;
     drills[idx].notes = notes;
     saveDrillsDb(drills);

     await complianceService.logEvent('DR_DRILL', user, `Restore Drill ${drillId} Completed`, { outcome: success ? 'PASS' : 'FAIL' });
  },

  getDrills: async (): Promise<RestoreDrill[]> => {
     await new Promise(r => setTimeout(r, 200));
     return getDrillsDb();
  }
};
