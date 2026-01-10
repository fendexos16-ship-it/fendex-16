

import { Client, ClientType, User, UserRole, LabelAuthority, ClientApiCredentials, ClientPermissions, BillingMode, ClientLedgerEntry, ClientStatus, OnboardingChecklist, TechnicalReadiness } from '../types';
import { complianceService } from './complianceService';
import { authService } from './authService';

const CLIENT_KEY = 'fendex_client_db';
const CREDENTIALS_KEY = 'fendex_client_credentials_db';
const PERMISSIONS_KEY = 'fendex_client_permissions_db';
const CLIENT_LEDGER_KEY = 'fendex_client_ledger_db';

const DEFAULT_CHECKLIST: OnboardingChecklist = {
   legalNameVerified: false,
   contactPersonVerified: false,
   billingCycleSet: false,
   taxDetailsVerified: false,
   rateCardBound: false
};

const DEFAULT_READINESS: TechnicalReadiness = {
   webhookSignatureVerified: false,
   testShipmentLifecyclePassed: false,
   billingPreviewGenerated: false,
   invoiceSampleApproved: false
};

const getClientsDb = (): Client[] => {
  const stored = localStorage.getItem(CLIENT_KEY);
  if (stored) return JSON.parse(stored);
  
  // Fix: Used ClientType.ENTERPRISE_DIRECT instead of DIRECT_CLIENT
  // Fix: Used ClientStatus.LIVE instead of 'Active'
  return [
    { 
      id: 'C001', 
      clientCode: 'C0001',
      name: 'Amazon Direct', 
      type: ClientType.ENTERPRISE_DIRECT, 
      billingMode: BillingMode.PREPAID, 
      status: ClientStatus.LIVE, 
      phone: '9000000001',
      defaultEnv: 'LIVE',
      labelAuthority: LabelAuthority.FENDEX_ONLY,
      contractRate: 50,
      walletBalance: 1000,
      portalEnabled: false,
      createdBy: 'SYSTEM',
      createdAt: new Date().toISOString(),
      onboardingChecklist: { legalNameVerified: true, contactPersonVerified: true, billingCycleSet: true, taxDetailsVerified: true, rateCardBound: true },
      technicalReadiness: { webhookSignatureVerified: true, testShipmentLifecyclePassed: true, billingPreviewGenerated: true, invoiceSampleApproved: true },
      documentsSigned: []
    },
    { 
      id: 'C002', 
      clientCode: 'C0002',
      name: 'ShipRocket Aggregator', 
      type: ClientType.AGGREGATOR, 
      billingMode: BillingMode.POSTPAID, 
      status: ClientStatus.LIVE, 
      phone: '9000000002',
      defaultEnv: 'TEST',
      labelAuthority: LabelAuthority.CLIENT_ALLOWED,
      contractRate: 45,
      portalEnabled: false,
      createdBy: 'SYSTEM',
      createdAt: new Date().toISOString(),
      onboardingChecklist: { legalNameVerified: true, contactPersonVerified: true, billingCycleSet: true, taxDetailsVerified: true, rateCardBound: true },
      technicalReadiness: { webhookSignatureVerified: true, testShipmentLifecyclePassed: true, billingPreviewGenerated: true, invoiceSampleApproved: true },
      documentsSigned: []
    }
  ];
};

const getClientLedgerDb = (): ClientLedgerEntry[] => {
  const stored = localStorage.getItem(CLIENT_LEDGER_KEY);
  return stored ? JSON.parse(stored) : [];
};

const getCredentialsDb = (): ClientApiCredentials[] => {
  const stored = localStorage.getItem(CREDENTIALS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const getPermissionsDb = (): ClientPermissions[] => {
  const stored = localStorage.getItem(PERMISSIONS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveClientsDb = (data: Client[]) => localStorage.setItem(CLIENT_KEY, JSON.stringify(data));
const saveClientLedgerDb = (data: ClientLedgerEntry[]) => localStorage.setItem(CLIENT_LEDGER_KEY, JSON.stringify(data));
const saveCredentialsDb = (data: ClientApiCredentials[]) => localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(data));
const savePermissionsDb = (data: ClientPermissions[]) => localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(data));

// MOCK GENERATORS
const generateApiKey = () => `sk_live_${Math.random().toString(36).substr(2, 24)}`;
const generateSecret = () => `whsec_${Math.random().toString(36).substr(2, 32)}`;

// STEP 3 - DEFAULT PERMISSION MATRIX
// Fix: Updated keys to match ClientType enum (ENTERPRISE_DIRECT, SME_LOCAL)
const DEFAULT_PERMISSIONS: Record<ClientType, Omit<ClientPermissions, 'clientId'>> = {
  [ClientType.AGGREGATOR]: {
    canCreateShipment: false, // Strict Rule: Aggregator never creates
    canPullOrders: true,
    canPushStatus: false,
    canReceiveWebhooks: true,
    canGenerateLabel: false
  },
  [ClientType.COURIER]: {
    canCreateShipment: false,
    canPullOrders: false,
    canPushStatus: true, // Courier pushes status
    canReceiveWebhooks: false,
    canGenerateLabel: false
  },
  [ClientType.ENTERPRISE_DIRECT]: {
    canCreateShipment: true,
    canPullOrders: false,
    canPushStatus: false,
    canReceiveWebhooks: true,
    canGenerateLabel: false
  },
  [ClientType.SME_LOCAL]: {
    canCreateShipment: true, // Via UI mostly
    canPullOrders: false,
    canPushStatus: false,
    canReceiveWebhooks: false,
    canGenerateLabel: false
  }
};

export const clientService = {
  
  getClients: async (): Promise<Client[]> => {
    await new Promise(r => setTimeout(r, 200));
    return getClientsDb();
  },
  
  getClientById: async (id: string): Promise<Client | undefined> => {
    const db = getClientsDb();
    const client = db.find(c => c.id === id);
    if (!client) return undefined;

    // Attach credentials and permissions
    const cred = getCredentialsDb().find(c => c.clientId === id);
    const perms = getPermissionsDb().find(p => p.clientId === id);
    
    return { ...client, credentials: cred, permissions: perms };
  },

  // --- STATE TRANSITIONS ---

  updateChecklist: async (user: User, clientId: string, updates: Partial<OnboardingChecklist>) => {
     authService.requireRole(user, UserRole.FOUNDER);
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx === -1) throw new Error('Client not found');

     const client = db[idx];
     client.onboardingChecklist = { ...(client.onboardingChecklist || DEFAULT_CHECKLIST), ...updates };
     saveClientsDb(db);
     
     await complianceService.logEvent('CLIENT_ONBOARDING', user, `Updated Checklist for ${client.name}`, updates);
  },

  updateReadiness: async (user: User, clientId: string, updates: Partial<TechnicalReadiness>) => {
     authService.requireRole(user, UserRole.FOUNDER);
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx === -1) throw new Error('Client not found');

     const client = db[idx];
     client.technicalReadiness = { ...(client.technicalReadiness || DEFAULT_READINESS), ...updates };
     saveClientsDb(db);
     
     await complianceService.logEvent('CLIENT_ONBOARDING', user, `Updated Tech Readiness for ${client.name}`, updates);
  },

  submitForReview: async (user: User, clientId: string) => {
     authService.requireRole(user, UserRole.FOUNDER);
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx === -1) throw new Error('Client not found');
     
     const client = db[idx];
     if (client.status !== ClientStatus.DRAFT) throw new Error('Client must be DRAFT to submit');

     const c = client.onboardingChecklist || DEFAULT_CHECKLIST;
     if (!c.legalNameVerified || !c.contactPersonVerified || !c.taxDetailsVerified) {
        throw new Error('Mandatory Legal & Contact checks missing.');
     }

     client.status = ClientStatus.UNDER_REVIEW;
     saveClientsDb(db);
     await complianceService.logEvent('CLIENT_LIFECYCLE', user, `Submitted ${client.name} for Review`, {});
  },

  startTesting: async (user: User, clientId: string) => {
     authService.requireRole(user, UserRole.FOUNDER);
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx === -1) throw new Error('Client not found');

     const client = db[idx];
     const checklist = client.onboardingChecklist || DEFAULT_CHECKLIST;
     if (!checklist.rateCardBound || !checklist.billingCycleSet) {
        throw new Error('Commercials (Rate Card & Billing Cycle) must be configured first.');
     }

     client.status = ClientStatus.TESTING;
     saveClientsDb(db);
     await complianceService.logEvent('CLIENT_LIFECYCLE', user, `Started Testing Phase for ${client.name}`, {});
  },

  activateLive: async (user: User, clientId: string) => {
     authService.requireRole(user, UserRole.FOUNDER);
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx === -1) throw new Error('Client not found');

     const client = db[idx];
     
     if (!client.documentsSigned || client.documentsSigned.length === 0) {
        throw new Error('No signed documents found. MSA is mandatory.');
     }

     const tr = client.technicalReadiness || DEFAULT_READINESS;
     if (client.type === ClientType.AGGREGATOR || client.type === ClientType.COURIER || client.type === ClientType.ENTERPRISE_DIRECT) {
        if (!tr.webhookSignatureVerified || !tr.testShipmentLifecyclePassed) {
           throw new Error('Technical Readiness Failed. Webhooks and Test Shipments must pass.');
        }
     }
     
     if (!tr.invoiceSampleApproved) {
        throw new Error('Billing/Invoice Sample must be approved.');
     }

     client.status = ClientStatus.LIVE;
     client.defaultEnv = 'LIVE'; 
     saveClientsDb(db);
     
     await complianceService.logEvent('CLIENT_LIFECYCLE', user, `ACTIVATED CLIENT ${client.name} (LIVE)`, { type: client.type });
  },

  pauseClient: async (user: User, clientId: string, reason: string) => {
     authService.requireRole(user, UserRole.FOUNDER);
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx === -1) throw new Error('Client not found');
     
     if (!reason) throw new Error("Pause reason mandatory.");

     const client = db[idx];
     client.status = ClientStatus.PAUSED;
     saveClientsDb(db);
     
     await complianceService.logEvent('CLIENT_LIFECYCLE', user, `PAUSED CLIENT ${client.name}`, { reason });
  },

  recordDocumentSign: async (user: User, clientId: string, docCode: string) => {
     authService.requireRole(user, UserRole.FOUNDER);
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx === -1) throw new Error('Client not found');

     if (!db[idx].documentsSigned) db[idx].documentsSigned = [];
     if (!db[idx].documentsSigned!.includes(docCode)) {
        db[idx].documentsSigned!.push(docCode);
        saveClientsDb(db);
        await complianceService.logEvent('CLIENT_OP', user, `Document Signed: ${docCode}`, { clientId });
     }
  },

  // --- BILLING & WALLET MANAGEMENT (STRICT) ---

  // 1. ADD FUNDS (Credit)
  addFunds: async (user: User, clientId: string, amount: number, ref: string): Promise<number> => {
    authService.requireRole(user, UserRole.FOUNDER); // Only Founder can credit wallet
    
    const db = getClientsDb();
    const idx = db.findIndex(c => c.id === clientId);
    if (idx === -1) throw new Error('Client not found');
    
    const client = db[idx];
    if (client.billingMode !== 'Prepaid' && client.billingMode !== 'Hybrid') {
       throw new Error(`Cannot add funds. Client billing mode is ${client.billingMode}.`);
    }

    client.walletBalance = (client.walletBalance || 0) + amount;
    
    // Log Ledger
    const ledger = getClientLedgerDb();
    ledger.push({
       id: `CL-LED-${Date.now()}`,
       clientId,
       type: 'CREDIT',
       amount,
       balanceAfter: client.walletBalance,
       reason: 'Manual Fund Addition',
       referenceId: ref,
       timestamp: new Date().toISOString(),
       actorId: user.id
    });

    saveClientsDb(db);
    saveClientLedgerDb(ledger);

    await complianceService.logEvent('BILLING_OP', user, `Credited ₹${amount} to Client ${client.name}`, { ref, newBalance: client.walletBalance });
    
    return client.walletBalance;
  },

  // 2. DEDUCT FUNDS (Debit) - Called by Shipment Engine
  deductFunds: async (clientId: string, amount: number, ref: string, actorId: string = 'SYSTEM'): Promise<void> => {
    const db = getClientsDb();
    const idx = db.findIndex(c => c.id === clientId);
    if (idx === -1) throw new Error('Client not found');
    
    const client = db[idx];
    
    // Safety check (redundant if validateCredit called, but good for data integrity)
    if ((client.walletBalance || 0) < amount) {
       throw new Error(`Insufficient Balance. Required: ${amount}, Available: ${client.walletBalance}`);
    }

    client.walletBalance = (client.walletBalance || 0) - amount;

    // Log Ledger
    const ledger = getClientLedgerDb();
    ledger.push({
       id: `CL-LED-${Date.now()}`,
       clientId,
       type: 'DEBIT',
       amount,
       balanceAfter: client.walletBalance,
       reason: 'Shipment Creation Charge',
       referenceId: ref,
       timestamp: new Date().toISOString(),
       actorId
    });

    saveClientsDb(db);
    saveClientLedgerDb(ledger);
  },

  // 3. VALIDATE CREDIT (Read-Only Check)
  validateCredit: async (clientId: string, estimatedCost?: number): Promise<void> => {
     const client = (await clientService.getClients()).find(c => c.id === clientId);
     if (!client) throw new Error('Client not found');

     if (client.billingMode === 'Prepaid' || client.billingMode === 'Hybrid') {
        const cost = estimatedCost || client.contractRate || 50; // Default fallback
        if ((client.walletBalance || 0) < cost) {
           throw new Error(`PREPAID LOCK: Insufficient Wallet Balance. Current: ₹${client.walletBalance || 0}, Required: ₹${cost}`);
        }
     }
     // Postpaid / COD models pass through (billed later or handled separately)
  },

  // 4. UPDATE BILLING MODE (Founder Only + Audit)
  updateBillingMode: async (user: User, clientId: string, newMode: BillingMode, reason: string): Promise<void> => {
     authService.requireRole(user, UserRole.FOUNDER);
     if (!reason) throw new Error('Audit Reason is mandatory for Billing Mode change.');

     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx === -1) throw new Error('Client not found');

     const oldMode = db[idx].billingMode;
     if (oldMode === newMode) return;

     db[idx].billingMode = newMode;
     saveClientsDb(db);

     await complianceService.logEvent('BILLING_OP', user, `Changed Billing Mode: ${oldMode} -> ${newMode}`, { clientId, reason });
  },

  // --- CREDENTIAL MANAGEMENT ---

  rotateKeys: async (user: User, clientId: string) => {
    authService.requireRole(user, UserRole.FOUNDER);

    const credsDb = getCredentialsDb();
    let cred = credsDb.find(c => c.clientId === clientId);
    const clientsDb = getClientsDb();
    const client = clientsDb.find(c => c.id === clientId);

    if (!client) throw new Error("Client not found");

    if (!cred) {
      // Create if missing
      cred = {
        id: crypto.randomUUID(),
        clientId,
        provider: 'CUSTOM', // Default
        environment: client.defaultEnv,
        authType: 'API_KEY',
        apiKey: generateApiKey(),
        apiSecret: generateSecret(),
        webhookSecret: generateSecret(),
        status: 'ACTIVE',
        createdBy: user.id,
        createdAt: new Date().toISOString()
      };
      credsDb.push(cred);
    } else {
      // Rotate
      cred.apiKey = generateApiKey();
      cred.apiSecret = generateSecret();
      cred.webhookSecret = generateSecret();
      cred.createdAt = new Date().toISOString(); // Update timestamp on rotate per schema rule
    }

    saveCredentialsDb(credsDb);

    await complianceService.logEvent(
      'CREDENTIAL_OP',
      user,
      `Rotated API Keys for Client ${clientId}`,
      { provider: cred.provider }
    );
  },

  // --- PERMISSION CHECKER (Core Security) ---

  checkPermission: async (clientId: string, action: keyof ClientPermissions): Promise<boolean> => {
    const client = await clientService.getClientById(clientId);
    if (!client) return false;
    // Fix: Used ClientStatus.LIVE instead of 'Active' literal
    if (client.status !== ClientStatus.LIVE) return false;

    // Load permissions or default
    let perms = client.permissions;
    if (!perms) {
      // If not explicitly set, use default matrix
      perms = { clientId, ...DEFAULT_PERMISSIONS[client.type] };
    }

    // Special Override for Label Authority
    if (action === 'canGenerateLabel' && client.labelAuthority === LabelAuthority.FENDEX_ONLY) {
      return false; 
    }

    return !!perms[action];
  },

  // --- WEBHOOK MANAGEMENT ---

  recordWebhookFailure: async (clientId: string) => {
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx !== -1 && db[idx].webhookConfig) {
        db[idx].webhookConfig!.failureCount = (db[idx].webhookConfig!.failureCount || 0) + 1;
        db[idx].webhookConfig!.lastFailureAt = new Date().toISOString();
        saveClientsDb(db);
     }
  },

  resetWebhookStats: async (clientId: string) => {
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx !== -1 && db[idx].webhookConfig) {
        db[idx].webhookConfig!.failureCount = 0;
        saveClientsDb(db);
     }
  },

  disableWebhooks: async (clientId: string) => {
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx !== -1 && db[idx].webhookConfig) {
        db[idx].webhookConfig!.enabled = false;
        saveClientsDb(db);
     }
  },

  // --- SETUP / SAVE ---

  saveClient: async (user: User, clientData: Client): Promise<Client> => {
    authService.requireRole(user, UserRole.FOUNDER);

    const db = getClientsDb();
    let finalClient = clientData;
    let isNew = false;

    if (clientData.id) {
      const idx = db.findIndex(c => c.id === clientData.id);
      if (idx !== -1) {
        // Prevent implicit billing mode change here. Must use specific method.
        if (db[idx].billingMode !== clientData.billingMode) {
           console.warn("Attempt to change Billing Mode via generic save. Ignoring.");
           clientData.billingMode = db[idx].billingMode; 
        }
        finalClient = { ...db[idx], ...clientData }; 
        db[idx] = finalClient;
      }
    } else {
      isNew = true;
      // GENERATE CLIENT CODE C000X
      const nextId = db.length + 1;
      const code = `C${nextId.toString().padStart(4, '0')}`;

      // Fix: Used ClientStatus.LIVE instead of 'Active' literal
      finalClient = { 
        ...clientData, 
        id: `CL-${Date.now()}`,
        clientCode: code,
        status: ClientStatus.LIVE,
        labelAuthority: LabelAuthority.FENDEX_ONLY,
        walletBalance: clientData.billingMode === 'Prepaid' ? 0 : undefined,
        contractRate: 50, // Default
        portalEnabled: false, // Default Locked
        webhookConfig: {
           id: crypto.randomUUID(),
           url: '',
           secret: generateSecret(),
           events: ['shipment.delivered', 'exception'],
           enabled: false,
           failureCount: 0
        },
        createdBy: user.id,
        createdAt: new Date().toISOString()
      };
      db.push(finalClient);
      
      // Auto-provision default permissions
      const permDb = getPermissionsDb();
      permDb.push({
        clientId: finalClient.id,
        ...DEFAULT_PERMISSIONS[finalClient.type]
      });
      savePermissionsDb(permDb);
    }
    
    saveClientsDb(db);

    await complianceService.logEvent(
      'CLIENT_OP', 
      user,
      `${isNew ? 'Created' : 'Updated'} Client: ${finalClient.name}`,
      { clientId: finalClient.id, type: finalClient.type, code: finalClient.clientCode }
    );

    return finalClient;
  },

  toggleEnv: async (user: User, clientId: string) => {
    authService.requireRole(user, UserRole.FOUNDER);
    const db = getClientsDb();
    const idx = db.findIndex(c => c.id === clientId);
    if (idx === -1) throw new Error('Client not found');

    const newEnv = db[idx].defaultEnv === 'TEST' ? 'LIVE' : 'TEST';
    db[idx].defaultEnv = newEnv;
    
    // Update credentials too if they exist
    const credsDb = getCredentialsDb();
    const cred = credsDb.find(c => c.clientId === clientId);
    if (cred) {
      cred.environment = newEnv;
      saveCredentialsDb(credsDb);
    }
    
    saveClientsDb(db);
    
    await complianceService.logEvent(
      'CLIENT_OP',
      user,
      `Switched Client ${clientId} Environment to ${newEnv}`,
      {}
    );
  },

  togglePortal: async (user: User, clientId: string) => {
     authService.requireRole(user, UserRole.FOUNDER);
     const db = getClientsDb();
     const idx = db.findIndex(c => c.id === clientId);
     if (idx === -1) throw new Error('Client not found');

     db[idx].portalEnabled = !db[idx].portalEnabled;
     saveClientsDb(db);

     await complianceService.logEvent(
        'CLIENT_OP',
        user,
        `Toggled Portal Access for ${db[idx].name} to ${db[idx].portalEnabled}`,
        { portalEnabled: db[idx].portalEnabled }
     );
  }
};
