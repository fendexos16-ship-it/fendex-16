
import { ComplianceLog, UserRole } from '../types';

const COMPLIANCE_LOG_KEY = 'fendex_compliance_logs_db';
const EXCEPTION_NOTES_KEY = 'fendex_exception_notes_db';

const getLogsDb = (): ComplianceLog[] => JSON.parse(localStorage.getItem(COMPLIANCE_LOG_KEY) || '[]');
const saveLogsDb = (logs: ComplianceLog[]) => localStorage.setItem(COMPLIANCE_LOG_KEY, JSON.stringify(logs));

export const complianceService = {
  
  logEvent: async (
    eventType: string,
    actor: { id: string, role: string },
    description: string,
    metadata: any = {},
    overrideReason?: string
  ) => {
    const logs = getLogsDb();
    
    const newLog: ComplianceLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      eventType,
      actorId: actor.id,
      actorRole: actor.role,
      description,
      metadata: JSON.stringify(metadata),
      integrityHash: 'WORM_LOCKED',
      override_reason: overrideReason
    };

    logs.unshift(newLog);
    saveLogsDb(logs);
  },

  authorizeOverride: async (user: { id: string, role: string }, action: string, reason: string): Promise<boolean> => {
     if (user.role !== 'FOUNDER') {
        throw new Error("SECURITY BLOCK: Overrides are restricted to Founder identity.");
     }
     if (!reason || reason.trim().length < 10) {
        throw new Error("AUDIT VIOLATION: Detailed override reason (min 10 chars) is mandatory.");
     }
     await complianceService.logEvent('SYSTEM_OVERRIDE', user, `CRITICAL OVERRIDE: ${action}`, {}, reason);
     return true;
  },

  /**
   * Added getLogs method
   */
  getLogs: async (role: string): Promise<ComplianceLog[]> => {
     return getLogsDb();
  },

  /**
   * Added getExceptionNote method
   */
  getExceptionNote: (id: string): string => {
     const notes = JSON.parse(localStorage.getItem(EXCEPTION_NOTES_KEY) || '{}');
     return notes[id] || '';
  },

  /**
   * Added addExceptionNote method
   */
  addExceptionNote: async (id: string, note: string, actor: { id: string, role: string }) => {
     const notes = JSON.parse(localStorage.getItem(EXCEPTION_NOTES_KEY) || '{}');
     notes[id] = note;
     localStorage.setItem(EXCEPTION_NOTES_KEY, JSON.stringify(notes));
     await complianceService.logEvent('EXCEPTION_NOTE', actor, `Added note to ${id}`, { note });
  }
};
