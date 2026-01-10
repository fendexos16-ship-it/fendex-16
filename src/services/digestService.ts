
import { 
   User, 
   UserRole, 
   DigestConfig, 
   DigestLog 
} from '../types';
import { founderService } from './founderService';
import { complianceService } from './complianceService';
import { performanceService } from './performanceService';
import { authService } from './authService';

const DIGEST_CONFIG_KEY = 'fendex_digest_config';
const DIGEST_LOG_KEY = 'fendex_digest_logs_db';

const DEFAULT_CONFIG: DigestConfig = {
   daily: { enabled: true, time: "09:00" },
   weekly: { enabled: true, day: "Monday", time: "09:30" },
   monthly: { enabled: true, day: 1, time: "10:00" },
   channels: { email: true, whatsapp: false, slack: false },
   recipients: [] // To be filled by founder email
};

const getConfigDb = (): DigestConfig => {
   const stored = localStorage.getItem(DIGEST_CONFIG_KEY);
   return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
};

const saveConfigDb = (config: DigestConfig) => {
   localStorage.setItem(DIGEST_CONFIG_KEY, JSON.stringify(config));
};

const getLogsDb = (): DigestLog[] => {
   const stored = localStorage.getItem(DIGEST_LOG_KEY);
   return stored ? JSON.parse(stored) : [];
};

const saveLogsDb = (logs: DigestLog[]) => {
   localStorage.setItem(DIGEST_LOG_KEY, JSON.stringify(logs));
};

export const digestService = {
   
   getConfig: async (user: User): Promise<DigestConfig> => {
      authService.requireRole(user, UserRole.FOUNDER);
      const config = getConfigDb();
      // Ensure current user is in recipients if empty
      if (config.recipients.length === 0 && user.email) {
         config.recipients.push(user.email);
      }
      return config;
   },

   updateConfig: async (user: User, config: DigestConfig): Promise<void> => {
      authService.requireRole(user, UserRole.FOUNDER);
      saveConfigDb(config);
      await complianceService.logEvent('DIGEST_CONFIG', user, 'Updated Digest Settings', { channels: config.channels });
   },

   getLogs: async (user: User): Promise<DigestLog[]> => {
      authService.requireRole(user, UserRole.FOUNDER);
      return getLogsDb();
   },

   // GENERATORS

   generateDailyDigest: async (user: User): Promise<string> => {
      // 1. Get Dates
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      const yStr = yesterday.toISOString().split('T')[0];
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      // 2. Fetch Metrics (Yesterday vs MTD)
      const [yMetrics, mtdMetrics, flags] = await Promise.all([
         founderService.getSnapshot(user, { start: yStr, end: yStr }),
         founderService.getSnapshot(user, { start: monthStart, end: todayStr }),
         founderService.analyzeRisks(user)
      ]);

      // 3. Format Content (Plain Text / HTML Simulation)
      let content = `
      ** FENDEX FOUNDER DAILY BRIEF **
      Date: ${today.toLocaleDateString()}
      
      [ OPERATIONS ]
      Yesterday: ${yMetrics.shipments.total} Shipments | ${yMetrics.shipments.delivered} Delivered | ${yMetrics.sla.d0Percent.toFixed(1)}% D0
      MTD:       ${mtdMetrics.shipments.total} Shipments | ${mtdMetrics.shipments.delivered} Delivered | ${mtdMetrics.sla.d0Percent.toFixed(1)}% D0
      Exceptions (Y): ${yMetrics.shipments.rto} RTO | ${yMetrics.shipments.undelivered} Undelivered

      [ CASH & COD ]
      Verified: ₹${mtdMetrics.cod.verified.toLocaleString()} (Safe)
      Pending:  ₹${mtdMetrics.cod.pending.toLocaleString()} (Risk)

      [ FINANCE ]
      Invoiced (MTD): ₹${mtdMetrics.finance.receivablesOutstanding.toLocaleString()}
      Pending Payouts: Rider ₹${mtdMetrics.payouts.riderPending.toLocaleString()} | LMDC ₹${mtdMetrics.payouts.lmdcPending.toLocaleString()}

      [ RED FLAGS ]
      ${flags.length === 0 ? "No critical alerts." : flags.map(f => `- ${f.metric}: ${f.message} (${f.value})`).join('\n')}

      [ LINKS ]
      > Dashboard: /founder/dashboard
      > Finance: /finance/payouts
      `;

      return content;
   },

   generateWeeklyDigest: async (user: User): Promise<string> => {
      // Logic for weekly comparison
      const today = new Date();
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - 7);
      
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - 6); // Last 7 days

      const tStr = today.toISOString().split('T')[0];
      const sStr = thisWeekStart.toISOString().split('T')[0];

      // Fetch
      const metrics = await founderService.getSnapshot(user, { start: sStr, end: tStr });
      const leaders = await founderService.getLeaderboards(user);

      let content = `
      ** FENDEX WEEKLY PERFORMANCE **
      Period: ${sStr} to ${tStr}

      [ VOLUME ]
      Total: ${metrics.shipments.total}
      Delivered: ${metrics.shipments.delivered} (${((metrics.shipments.delivered/metrics.shipments.total)*100).toFixed(1)}%)
      
      [ QUALITY ]
      D0 SLA: ${metrics.sla.d0Percent.toFixed(1)}%
      
      [ TOP CLIENTS (Vol) ]
      ${leaders.topClients.slice(0, 3).map(c => `- ${c.name}: ${c.volume}`).join('\n')}

      [ CASH CYCLE ]
      Verified COD: ₹${metrics.cod.verified.toLocaleString()}
      `;
      return content;
   },

   // DELIVERY ENGINE
   sendDigest: async (user: User, type: 'DAILY' | 'WEEKLY' | 'MONTHLY'): Promise<void> => {
      authService.requireRole(user, UserRole.FOUNDER);
      
      const config = getConfigDb();
      let content = '';

      try {
         if (type === 'DAILY') content = await digestService.generateDailyDigest(user);
         else if (type === 'WEEKLY') content = await digestService.generateWeeklyDigest(user);
         else content = "Monthly Digest Content Placeholder"; // Similar logic

         // Simulate Send
         const channels = [];
         if (config.channels.email) {
            console.log(`[EMAIL] Sending Digest to ${config.recipients.join(', ')}`);
            channels.push('Email');
         }
         if (config.channels.whatsapp) {
            console.log(`[WHATSAPP] Sending Digest Summary...`);
            channels.push('WhatsApp');
         }
         if (config.channels.slack) {
            console.log(`[SLACK] Posting to #founder-updates...`);
            channels.push('Slack');
         }

         if (channels.length === 0) {
            throw new Error("No channels enabled.");
         }

         // Log Success
         const logs = getLogsDb();
         logs.unshift({
            id: `DIG-${Date.now()}`,
            type,
            generatedAt: new Date().toISOString(),
            status: 'SENT',
            channel: channels.join(', '),
            contentSummary: content.substring(0, 50) + '...',
            generatedBy: user.id
         });
         saveLogsDb(logs);

      } catch (e: any) {
         // Log Failure
         const logs = getLogsDb();
         logs.unshift({
            id: `DIG-FAIL-${Date.now()}`,
            type,
            generatedAt: new Date().toISOString(),
            status: 'FAILED',
            channel: 'ALL',
            contentSummary: e.message,
            generatedBy: user.id
         });
         saveLogsDb(logs);
         throw e;
      }
   }
};
