
import { 
  ReminderConfig, 
  ReminderLog, 
  ReminderChannel, 
  User, 
  UserRole, 
  ReceivableStatus,
  Receivable,
  NoteType
} from '../types';
import { complianceService } from './complianceService';
import { billingService } from './billingService';
import { clientService } from './clientService';
import { authService } from './authService';

const REMINDER_CONFIG_KEY = 'fendex_reminder_config_db';
const REMINDER_LOGS_KEY = 'fendex_reminder_logs_db';
const REMINDER_HISTORY_KEY = 'fendex_reminder_history_map'; // Tracks sent reminders per receivable to avoid duplicates

const DEFAULT_CONFIG: ReminderConfig = {
  enabled: false,
  schedule: {
    beforeDueDays: 2,
    overdueDays1: 1,
    overdueDays2: 7,
    escalationDays: 15
  },
  channels: [ReminderChannel.EMAIL],
  penalty: {
    enabled: false,
    type: 'FLAT',
    value: 500,
    frequency: 'ONE_TIME'
  }
};

const getConfigDb = (): ReminderConfig => {
  const stored = localStorage.getItem(REMINDER_CONFIG_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
};

const saveConfigDb = (config: ReminderConfig) => {
  localStorage.setItem(REMINDER_CONFIG_KEY, JSON.stringify(config));
};

const getLogsDb = (): ReminderLog[] => {
  const stored = localStorage.getItem(REMINDER_LOGS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveLogsDb = (logs: ReminderLog[]) => {
  localStorage.setItem(REMINDER_LOGS_KEY, JSON.stringify(logs));
};

const getHistoryDb = (): Record<string, string[]> => {
  const stored = localStorage.getItem(REMINDER_HISTORY_KEY);
  return stored ? JSON.parse(stored) : {};
};

const saveHistoryDb = (history: Record<string, string[]>) => {
  localStorage.setItem(REMINDER_HISTORY_KEY, JSON.stringify(history));
};

export const reminderService = {
  
  getConfig: async (): Promise<ReminderConfig> => {
    await new Promise(r => setTimeout(r, 200));
    return getConfigDb();
  },

  updateConfig: async (user: User, config: ReminderConfig): Promise<void> => {
    authService.requireRole(user, UserRole.FOUNDER);
    saveConfigDb(config);
    await complianceService.logEvent('REMINDER_OP', user, 'Updated Reminder Automation Config', { enabled: config.enabled });
  },

  getLogs: async (user: User): Promise<ReminderLog[]> => {
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) return [];
    await new Promise(r => setTimeout(r, 300));
    return getLogsDb().sort((a,b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  },

  // CORE ENGINE
  runDailyChecks: async (user: User): Promise<{ remindersSent: number, penaltiesApplied: number }> => {
    // Only Founder/Finance/System can trigger this
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) throw new Error('Unauthorized');

    const config = getConfigDb();
    if (!config.enabled) return { remindersSent: 0, penaltiesApplied: 0 };

    const receivables = await billingService.getReceivables();
    const history = getHistoryDb();
    let sentCount = 0;
    let penaltyCount = 0;

    const today = new Date();
    today.setHours(0,0,0,0);

    for (const rec of receivables) {
       // Skip if Paid or Disputed
       if (rec.status === ReceivableStatus.PAID || rec.status === ReceivableStatus.DISPUTED) continue;

       const dueDate = new Date(rec.dueDate);
       dueDate.setHours(0,0,0,0);
       
       const diffTime = today.getTime() - dueDate.getTime();
       const diffDays = Math.round(diffTime / (1000 * 3600 * 24)); // Positive = Overdue, Negative = Before Due

       const sentTags = history[rec.id] || [];
       let tagToSend = '';
       let template = '';

       // 1. Check Schedule
       if (diffDays === -config.schedule.beforeDueDays) {
          tagToSend = 'BEFORE_DUE';
          template = `Reminder: Invoice ${rec.invoiceNumber} due in ${config.schedule.beforeDueDays} days.`;
       } else if (diffDays === config.schedule.overdueDays1) {
          tagToSend = 'OVERDUE_1';
          template = `URGENT: Invoice ${rec.invoiceNumber} is Overdue. Please pay immediately.`;
       } else if (diffDays === config.schedule.overdueDays2) {
          tagToSend = 'OVERDUE_2';
          template = `NOTICE: Invoice ${rec.invoiceNumber} overdue by ${config.schedule.overdueDays2} days. Penalties may apply.`;
       } else if (diffDays === config.schedule.escalationDays) {
          tagToSend = 'ESCALATION';
          template = `FINAL NOTICE: Invoice ${rec.invoiceNumber} escalated to Risk Management. Account functionality restricted.`;
       }

       // 2. Send Reminder
       if (tagToSend && !sentTags.includes(tagToSend)) {
          // Check Client Prefs (Mocked fetch)
          const client = await clientService.getClientById(rec.clientId);
          if (client) {
             const channels = client.reminderChannels || config.channels;
             
             for (const ch of channels) {
                await reminderService.simulateSend(ch, client, rec, template);
                
                const logs = getLogsDb();
                logs.push({
                   id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
                   clientId: client.id,
                   invoiceId: rec.invoiceId,
                   channel: ch,
                   template,
                   sentAt: new Date().toISOString(),
                   status: 'SENT'
                });
                saveLogsDb(logs);
             }

             if (!history[rec.id]) history[rec.id] = [];
             history[rec.id].push(tagToSend);
             saveHistoryDb(history);
             sentCount++;
          }
       }

       // 3. Apply Penalties
       if (config.penalty.enabled && diffDays === config.schedule.overdueDays2) {
          // Only apply once per invoice for ONE_TIME
          // We check if a Debit Note for "Overdue Penalty" exists for this invoice
          const notes = await billingService.getNotes(rec.clientId);
          const hasPenalty = notes.some(n => n.invoiceId === rec.invoiceId && n.reason.includes('Overdue Penalty'));
          
          if (!hasPenalty) {
             let amount = 0;
             if (config.penalty.type === 'FLAT') amount = config.penalty.value;
             else amount = (rec.totalAmount * config.penalty.value) / 100;

             // Auto-Issue Debit Note
             // Note: createNote validates balance, etc.
             // We bypass UI validation and call service. Service will log event.
             try {
                // Founder privilege used for automation
                await billingService.createNote(user, {
                   type: NoteType.DEBIT_NOTE,
                   invoiceId: rec.invoiceId,
                   amount,
                   reason: `System Overdue Penalty (${diffDays} days)`
                });
                
                // If founder, it auto-issues. If finance admin triggered check, it might be pending.
                // Assuming automation runs with high privilege or creates pending note.
                // Based on billingService, if founder creates -> ISSUED.
                // If this is triggered by System/Founder, penalty is live.
                penaltyCount++;
             } catch (e) {
                console.error("Failed to apply penalty", e);
             }
          }
       }
    }

    return { remindersSent: sentCount, penaltiesApplied: penaltyCount };
  },

  simulateSend: async (channel: ReminderChannel, client: any, rec: Receivable, msg: string) => {
     console.log(`[${channel}] Sending to ${client.name} (${client.phone}): ${msg} | Link: https://pay.fendex.com/${rec.invoiceNumber}`);
     // Simulate Network
     await new Promise(r => setTimeout(r, 100));
  }
};
