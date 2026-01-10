
import { SOP, Runbook, User, UserRole, SOPStatus, IncidentSeverity, AcknowledgeLog } from '../types';
import { complianceService } from './complianceService';
import { authService } from './authService';

const SOPS_KEY = 'fendex_sops_db';
const RUNBOOKS_KEY = 'fendex_runbooks_db';
const ACKNOWLEDGE_KEY = 'fendex_kb_acks_db';

// SEED DATA: Mandatory SOPs & Runbooks
const SEED_SOPS: SOP[] = [
  // MMDC
  {
    id: 'SOP-MM-01', code: 'MM-INBOUND', title: 'MMDC Inbound Trip Receiving', version: 1, status: SOPStatus.APPROVED, category: 'MMDC',
    targetRoles: [UserRole.MMDC_MANAGER, UserRole.FOUNDER],
    content: {
      purpose: 'Standardize inbound vehicle processing at hubs.',
      scope: 'All MMDC Inbound Docks.',
      preconditions: ['Vehicle arrived at dock', 'Driver manifest available'],
      steps: [
        { order: 1, action: 'Verify Vehicle Number matches Manifest.' },
        { order: 2, action: 'Check Seal Integrity on vehicle lock.' },
        { order: 3, action: 'Scan each Bag Code into system.' },
        { order: 4, action: 'Mark Shortages/Damages immediately.' },
        { order: 5, action: 'Complete Inbound Trip in App.' }
      ],
      dos: ['Scan every bag individually', 'Photo evidence for damages'],
      donts: ['Do not accept broken seals without exception log', 'Do not manually override counts'],
      escalationRole: UserRole.FOUNDER,
      auditReference: 'TRIP_INBOUND'
    },
    createdBy: 'SYSTEM', createdAt: new Date().toISOString(), approvedBy: 'SYSTEM', approvedAt: new Date().toISOString()
  },
  {
    id: 'SOP-MM-02', code: 'MM-SORT', title: 'Hub Sorting & Connection', version: 1, status: SOPStatus.APPROVED, category: 'MMDC',
    targetRoles: [UserRole.MMDC_MANAGER],
    content: {
       purpose: 'Ensure bags are routed to correct destination.',
       scope: 'Sorting Floor',
       preconditions: ['Bags received in system'],
       steps: [
          { order: 1, action: 'Create Connection Sheet for Destination.' },
          { order: 2, action: 'Scan Bag to associate with Sheet.' },
          { order: 3, action: 'Verify Bag Status is RECEIVED.' },
          { order: 4, action: 'Close Sheet when full.' }
       ],
       dos: ['Segregate by Destination before scanning'],
       donts: ['Do not mix destinations in one sheet'],
       escalationRole: UserRole.FOUNDER,
       auditReference: 'MMDC_SORT'
    },
    createdBy: 'SYSTEM', createdAt: new Date().toISOString(), approvedBy: 'SYSTEM', approvedAt: new Date().toISOString()
  },
  // LMDC
  {
    id: 'SOP-LM-01', code: 'LM-CASH', title: 'COD Cash Handover', version: 1, status: SOPStatus.APPROVED, category: 'LMDC',
    targetRoles: [UserRole.LMDC_MANAGER, UserRole.RIDER],
    content: {
       purpose: 'Secure cash transfer from Rider to Station.',
       scope: 'End of Day Reconciliation',
       preconditions: ['Rider completed deliveries', 'Cash collected physically'],
       steps: [
          { order: 1, action: 'Rider initiates Handover in App.' },
          { order: 2, action: 'Manager counts physical cash.' },
          { order: 3, action: 'Manager verifies amount matches App.' },
          { order: 4, action: 'Manager accepts Handover.' }
       ],
       dos: ['Count notes in front of rider', 'Reject counterfeit notes'],
       donts: ['Do not accept partial handover without logging shortage'],
       escalationRole: UserRole.FINANCE_ADMIN,
       auditReference: 'COD_OP'
    },
    createdBy: 'SYSTEM', createdAt: new Date().toISOString(), approvedBy: 'SYSTEM', approvedAt: new Date().toISOString()
  },
  {
     id: 'SOP-LM-02', code: 'LM-RUNSHEET', title: 'Delivery Runsheet Creation', version: 1, status: SOPStatus.APPROVED, category: 'LMDC',
     targetRoles: [UserRole.LMDC_MANAGER],
     content: {
        purpose: 'Assign deliveries to riders efficiently.',
        scope: 'Morning Dispatch',
        preconditions: ['Shipments at Station', 'Riders marked Active'],
        steps: [
           { order: 1, action: 'Select Rider.' },
           { order: 2, action: 'Scan/Select Shipments for Route.' },
           { order: 3, action: 'Generate Runsheet.' },
           { order: 4, action: 'Handover physical packets.' }
        ],
        dos: ['Check rider capacity limits', 'Verify bag contents'],
        donts: ['Do not assign more than vehicle capacity'],
        escalationRole: UserRole.AREA_MANAGER,
        auditReference: 'RUNSHEET_OP'
     },
     createdBy: 'SYSTEM', createdAt: new Date().toISOString(), approvedBy: 'SYSTEM', approvedAt: new Date().toISOString()
  },
  // FINANCE
  {
    id: 'SOP-FIN-01', code: 'FIN-PAYOUT', title: 'Rider Payout Approval', version: 1, status: SOPStatus.APPROVED, category: 'FINANCE',
    targetRoles: [UserRole.FINANCE_ADMIN, UserRole.FOUNDER],
    content: {
       purpose: 'Authorize weekly rider earnings.',
       scope: 'Finance Dashboard',
       preconditions: ['Cycle Locked', 'COD Reconciled'],
       steps: [
          { order: 1, action: 'Review Pending Payouts.' },
          { order: 2, action: 'Check for COD Shortages.' },
          { order: 3, action: 'Approve eligible batches.' },
          { order: 4, action: 'Execute via Gateway.' }
       ],
       dos: ['Verify bank details exist', 'Check active alerts'],
       donts: ['Do not pay riders with open COD disputes'],
       escalationRole: UserRole.FOUNDER,
       auditReference: 'PAYOUT_OP'
    },
    createdBy: 'SYSTEM', createdAt: new Date().toISOString(), approvedBy: 'SYSTEM', approvedAt: new Date().toISOString()
  }
];

const SEED_RUNBOOKS: Runbook[] = [
  {
    id: 'RB-OPS-01', code: 'COD-MISMATCH', title: 'COD Mismatch Handling', severity: IncidentSeverity.P1, category: 'OPS',
    targetRoles: [UserRole.LMDC_MANAGER, UserRole.FINANCE_ADMIN],
    content: {
       immediateActions: ['Stop Rider Payouts', 'Freeze Rider Account if > ₹5000'],
       dataToCapture: ['Runsheet ID', 'Expected Amount', 'Physical Amount', 'Rider Statement'],
       communicationTemplate: 'Urgent: Cash Shortage of INR [AMOUNT] detected for Rider [NAME]. Account Frozen pending audit.',
       resolutionSteps: ['Recount cash', 'Check for calculation error', 'Log Debt if confirmed', 'Deduct from Payout if authorized'],
       closureCriteria: 'Shortage recovered or Debt Note issued.'
    },
    createdBy: 'SYSTEM', createdAt: new Date().toISOString(), approvedBy: 'SYSTEM', approvedAt: new Date().toISOString()
  },
  {
    id: 'RB-TECH-01', code: 'SYS-OUTAGE', title: 'System Outage / Incident Mode', severity: IncidentSeverity.P0, category: 'TECH',
    targetRoles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN],
    content: {
       immediateActions: ['Activate Incident Mode in Admin Panel', 'Notify Operations via SMS/WhatsApp'],
       dataToCapture: ['Error Logs', 'Affected Services', 'Time of Outage'],
       communicationTemplate: 'ALERT: System Maintenance/Outage. Offline Operations authorized for [DURATION]. Do not sync until further notice.',
       resolutionSteps: ['Identify root cause', 'Deploy fix', 'Verify stability', 'Disable Incident Mode'],
       closureCriteria: 'System operational for 1 hour without errors.'
    },
    createdBy: 'SYSTEM', createdAt: new Date().toISOString(), approvedBy: 'SYSTEM', approvedAt: new Date().toISOString()
  },
  {
     id: 'RB-FIN-01', code: 'PAY-FAIL', title: 'Payment Gateway Failure', severity: IncidentSeverity.P1, category: 'FINANCE',
     targetRoles: [UserRole.FINANCE_ADMIN, UserRole.FOUNDER],
     content: {
        immediateActions: ['Check Gateway Dashboard', 'Pause pending batches'],
        dataToCapture: ['Batch ID', 'Gateway Error Code', 'Reference ID'],
        communicationTemplate: 'Payout Delay: Banking partner experiencing downtime. Transfers will be retried in 2 hours.',
        resolutionSteps: ['Retry batch after 1 hour', 'If fail, switch Gateway (Razorpay/Cashfree)', 'Manual transfer for critical cases'],
        closureCriteria: 'All beneficiaries in batch marked PAID.'
     },
     createdBy: 'SYSTEM', createdAt: new Date().toISOString(), approvedBy: 'SYSTEM', approvedAt: new Date().toISOString()
  }
];

const getSopsDb = (): SOP[] => {
   const stored = localStorage.getItem(SOPS_KEY);
   return stored ? JSON.parse(stored) : SEED_SOPS; // Fallback to seed if empty
};

const saveSopsDb = (data: SOP[]) => {
   localStorage.setItem(SOPS_KEY, JSON.stringify(data));
};

const getRunbooksDb = (): Runbook[] => {
   const stored = localStorage.getItem(RUNBOOKS_KEY);
   return stored ? JSON.parse(stored) : SEED_RUNBOOKS;
};

const saveRunbooksDb = (data: Runbook[]) => {
   localStorage.setItem(RUNBOOKS_KEY, JSON.stringify(data));
};

const getAcksDb = (): AcknowledgeLog[] => {
   const stored = localStorage.getItem(ACKNOWLEDGE_KEY);
   return stored ? JSON.parse(stored) : [];
};

const saveAcksDb = (data: AcknowledgeLog[]) => {
   localStorage.setItem(ACKNOWLEDGE_KEY, JSON.stringify(data));
};

// Init Logic
if (!localStorage.getItem(SOPS_KEY)) localStorage.setItem(SOPS_KEY, JSON.stringify(SEED_SOPS));
if (!localStorage.getItem(RUNBOOKS_KEY)) localStorage.setItem(RUNBOOKS_KEY, JSON.stringify(SEED_RUNBOOKS));

export const knowledgeBaseService = {
   
   getSOPs: async (user: User): Promise<SOP[]> => {
      await new Promise(r => setTimeout(r, 200));
      const all = getSopsDb();
      // Filter based on role (or show all if Founder)
      if (user.role === UserRole.FOUNDER) return all;
      return all.filter(s => s.status === SOPStatus.APPROVED && s.targetRoles.includes(user.role));
   },

   getRunbooks: async (user: User): Promise<Runbook[]> => {
      await new Promise(r => setTimeout(r, 200));
      const all = getRunbooksDb();
      if (user.role === UserRole.FOUNDER) return all;
      return all.filter(r => r.targetRoles.includes(user.role));
   },

   createSOP: async (user: User, sop: Omit<SOP, 'id' | 'createdAt' | 'createdBy'>): Promise<void> => {
      authService.requireRole(user, UserRole.FOUNDER);
      const db = getSopsDb();
      const newSop: SOP = {
         ...sop,
         id: `SOP-${Date.now()}`,
         createdBy: user.id,
         createdAt: new Date().toISOString()
      };
      db.push(newSop);
      saveSopsDb(db);
      await complianceService.logEvent('KB_OP', user, `Created SOP ${newSop.code}`, {});
   },

   createRunbook: async (user: User, rb: Omit<Runbook, 'id' | 'createdAt' | 'createdBy'>): Promise<void> => {
      authService.requireRole(user, UserRole.FOUNDER);
      const db = getRunbooksDb();
      const newRb: Runbook = {
         ...rb,
         id: `RB-${Date.now()}`,
         createdBy: user.id,
         createdAt: new Date().toISOString()
      };
      db.push(newRb);
      saveRunbooksDb(db);
      await complianceService.logEvent('KB_OP', user, `Created Runbook ${newRb.code}`, {});
   },

   acknowledgeDoc: async (user: User, docId: string, version: number): Promise<void> => {
      const db = getAcksDb();
      if (db.some(a => a.userId === user.id && a.docId === docId && a.docVersion === version)) return;
      
      db.push({
         userId: user.id,
         docId,
         docVersion: version,
         timestamp: new Date().toISOString()
      });
      saveAcksDb(db);
      await complianceService.logEvent('KB_ACK', user, `Acknowledged Doc ${docId} v${version}`, {});
   },

   getAcknowledgements: async (user: User): Promise<string[]> => {
      const db = getAcksDb();
      return db.filter(a => a.userId === user.id).map(a => a.docId);
   }
};
