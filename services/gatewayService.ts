
import { GatewayCredential, GatewayProvider, GatewayEnvironment, User, UserRole } from '../types';
import { complianceService } from './complianceService';
import { authService } from './authService';

const GATEWAY_CREDS_KEY = 'fendex_gateway_credentials_db';

const getDb = (): GatewayCredential[] => {
  const stored = localStorage.getItem(GATEWAY_CREDS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveDb = (data: GatewayCredential[]) => {
  localStorage.setItem(GATEWAY_CREDS_KEY, JSON.stringify(data));
};

// Simulate Encrypt/Decrypt
const mockEncrypt = (secret: string) => `ENC_${btoa(secret)}`;
const mockDecrypt = (enc: string) => atob(enc.replace('ENC_', ''));

export const gatewayService = {
  
  // 1. GET ALL (Filtered by security)
  getAllCredentials: async (user: User): Promise<GatewayCredential[]> => {
    // Implicit filter, return empty if not authorized
    if (user.role !== UserRole.FOUNDER) return [];
    await new Promise(r => setTimeout(r, 300));
    return getDb();
  },

  // 2. CREATE / ADD (Corresponds to Router POST)
  saveCredential: async (
    user: User, 
    provider: GatewayProvider, 
    environment: GatewayEnvironment, 
    clientId: string, 
    clientSecret: string
  ): Promise<GatewayCredential> => {
    
    // STRICT MIDDLEWARE CHECK: requireFounder
    authService.requireRole(user, UserRole.FOUNDER);

    const db = getDb();
    
    // Disable any existing active credentials for this provider/env tuple (Constraint Logic)
    // SQL: "is_active BOOLEAN DEFAULT TRUE" usually implies we might want only one active per tuple
    db.forEach(c => {
      if (c.provider === provider && c.environment === environment && c.isActive) {
        c.isActive = false;
      }
    });

    const newCred: GatewayCredential = {
      id: crypto.randomUUID(),
      provider,
      environment,
      clientId,
      clientSecretEnc: mockEncrypt(clientSecret),
      isActive: true,
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };

    db.unshift(newCred);
    saveDb(db);

    await complianceService.logEvent(
      'CREDENTIAL_OP', 
      user, 
      `Added ${provider} ${environment} Credential`, 
      { credId: newCred.id }
    );

    return newCred;
  },

  // 3. TOGGLE STATUS
  toggleActive: async (user: User, credId: string): Promise<void> => {
    authService.requireRole(user, UserRole.FOUNDER);
    
    const db = getDb();
    const cred = db.find(c => c.id === credId);
    if (!cred) throw new Error('Credential not found');

    // If activating, deactivate others of same tuple
    if (!cred.isActive) {
      db.forEach(c => {
        if (c.provider === cred.provider && c.environment === cred.environment && c.id !== credId) {
          c.isActive = false;
        }
      });
    }

    cred.isActive = !cred.isActive;
    saveDb(db);
    
    await complianceService.logEvent(
      'CREDENTIAL_OP', 
      user, 
      `${cred.isActive ? 'Activated' : 'Deactivated'} Credential ${cred.id}`, 
      {}
    );
  },

  // 4. RETRIEVE ACTIVE SECRET (Internal Use for Transfers)
  getActiveCredential: async (provider: GatewayProvider, environment: GatewayEnvironment): Promise<{ clientId: string, clientSecret: string } | null> => {
    const db = getDb();
    const cred = db.find(c => c.provider === provider && c.environment === environment && c.isActive);
    
    if (!cred) return null;

    return {
      clientId: cred.clientId,
      clientSecret: mockDecrypt(cred.clientSecretEnc)
    };
  }
};
