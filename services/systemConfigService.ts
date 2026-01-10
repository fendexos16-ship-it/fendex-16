
import { SystemConfig, SystemEnvironment, UserRole, User, IncidentState } from '../types';
import { complianceService } from './complianceService';

const SYSTEM_CONFIG_KEY = 'fendex_system_config';

const DEFAULT_CONFIG: SystemConfig = {
  payoutEnvironment: SystemEnvironment.TEST,
  payoutProdEnabled: false,
  drRegion: 'ap-south-2', // Default DR Region
  incidentMode: { active: false },
  backupConfig: {
     dbSchedule: 'HOURLY',
     storageSchedule: 'DAILY',
     retentionDays: 30,
     wormEnabled: true
  }
};

const getConfigDb = (): SystemConfig => {
  const stored = localStorage.getItem(SYSTEM_CONFIG_KEY);
  if (!stored) return DEFAULT_CONFIG;
  const parsed = JSON.parse(stored);
  return { ...DEFAULT_CONFIG, ...parsed }; // Merge defaults for new fields
};

const saveConfigDb = (config: SystemConfig) => {
  localStorage.setItem(SYSTEM_CONFIG_KEY, JSON.stringify(config));
};

export const systemConfigService = {
  getConfig: async (): Promise<SystemConfig> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return getConfigDb();
  },

  updateConfig: async (user: User, updates: Partial<SystemConfig>): Promise<void> => {
     if (user.role !== UserRole.FOUNDER) throw new Error("Unauthorized");
     const current = getConfigDb();
     const newConfig = { ...current, ...updates };
     saveConfigDb(newConfig);
     await complianceService.logEvent('INFRA_OP', user, 'Updated System Configuration', updates);
  },

  // PHASE 9: HARD GATE ACTIVATION
  enableProduction: async (founderId: string, founderRole: UserRole): Promise<void> => {
    if (founderRole !== UserRole.FOUNDER) {
      throw new Error('SECURITY ALERT: Only Founder can enable Production Mode.');
    }

    const config = getConfigDb();
    
    // Idempotency check
    if (config.payoutProdEnabled) return;

    config.payoutEnvironment = SystemEnvironment.PRODUCTION;
    config.payoutProdEnabled = true;
    config.payoutProdEnabledAt = new Date().toISOString();
    config.payoutProdEnabledBy = founderId;

    saveConfigDb(config);

    // PERMANENT AUDIT LOG
    console.warn(`[AUDIT][CRITICAL] PRODUCTION_MODE_ENABLED | By: ${founderId} | Time: ${config.payoutProdEnabledAt}`);
  },

  // Incident Mode
  toggleIncidentMode: async (user: User, active: boolean, reason: string): Promise<void> => {
     if (user.role !== UserRole.FOUNDER) throw new Error("Unauthorized");
     if (active && !reason) throw new Error("Reason is mandatory to activate Incident Mode.");

     const config = getConfigDb();
     const newState: IncidentState = {
        active,
        reason: active ? reason : undefined,
        startedAt: active ? new Date().toISOString() : undefined,
        startedBy: active ? user.id : undefined
     };
     
     config.incidentMode = newState;
     saveConfigDb(config);

     await complianceService.logEvent(
        'INCIDENT_OP', 
        user, 
        `Incident Mode ${active ? 'ACTIVATED' : 'RESOLVED'}`, 
        { reason }
     );
  },

  isIncidentMode: (): boolean => {
     const config = getConfigDb();
     return config.incidentMode?.active || false;
  },

  getIncidentState: (): IncidentState | undefined => {
     const config = getConfigDb();
     return config.incidentMode;
  },

  // System Lock Check
  isSystemLocked: (): boolean => {
     const config = getConfigDb();
     return config.payoutProdEnabled === true;
  }
};
