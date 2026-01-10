
import { User, UserRole, UserStatus, AuthResponse } from '../types';
import { complianceService } from './complianceService';
import { securityService } from './securityService';
import api from './api';

// UI Session only stores User Metadata, NOT the Token
const SESSION_KEY = 'fendex_session_v2';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

interface SessionData {
  user: User;
  // token: string; // REMOVED - Token is now in HttpOnly Cookie
  expiresAt: number;
  loginTime: string;
}

export const authService = {
  
  isInitialized: () => true,

  requireRole: (user: User | null, allowedRoles: UserRole | UserRole[]) => {
    if (!user) {
      throw new Error("Security Exception: Authentication required.");
    }
    
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (sessionStr) {
       const session: SessionData = JSON.parse(sessionStr);
       if (Date.now() > session.expiresAt) {
          authService.logout();
          throw new Error("Security Exception: Session Expired.");
       }
    } else {
       throw new Error("Security Exception: No active session.");
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(user.role)) {
      console.error(`[SECURITY] Access Denied. User: ${user.role}, Required: ${roles.join(' or ')}`);
      throw new Error(`Access Denied: Requires ${roles.join(' or ')} privileges.`);
    }
  },

  // 1. LOGIN API
  login: async (username: string, password: string): Promise<AuthResponse> => {
    
    if (!securityService.checkRateLimit('auth_login', 5, 60000)) {
       await securityService.logWafBlock('/auth/login', 'Rate Limit Exceeded', 'CLIENT_IP');
       return { success: false, message: 'Too many login attempts. Please wait.' };
    }

    try {
      // Calls backend which sets the HttpOnly Cookie
      const response = await api.post('/auth/login', { 
        email: username, 
        password 
      });

      if (response.data.success) {
        const { user } = response.data;
        
        // Persist UI State Only
        const session: SessionData = {
          user,
          expiresAt: Date.now() + SESSION_DURATION_MS,
          loginTime: new Date().toISOString()
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));

        await complianceService.logEvent('AUTH_LOGIN', user, 'Login Successful', { method: 'COOKIE' });
        return { success: true, user };
      }

      return { success: false, message: 'Unknown error occurred.' };

    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Login failed';
      await complianceService.logEvent('AUTH_FAILURE', { id: 'UNKNOWN', role: 'UNKNOWN' }, `Failed login: ${msg}`, { username });
      return { success: false, message: msg };
    }
  },

  // Fix: Added missing User properties 'username' and 'failedLoginAttempts'
  registerFounder: async (name: string, phone: string, password: string): Promise<AuthResponse> => {
    const founderEmail = 'fendexlogistics@gmail.com';
    const founderUser: User = {
      id: founderEmail,
      username: 'founder',
      email: founderEmail,
      name,
      phone,
      role: UserRole.FOUNDER,
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString()
    };
    // Bootstrap logic simulated for local persistence check
    const session: SessionData = {
      user: founderUser,
      expiresAt: Date.now() + SESSION_DURATION_MS,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, user: founderUser };
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout'); // Clear cookie on server
    } catch (e) {
      console.warn("Logout API call failed, clearing local state anyway.");
    }
    localStorage.removeItem(SESSION_KEY);
    window.location.href = '/#/login';
  },

  getCurrentUser: (): User | null => {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (!sessionStr) return null;
    
    try {
      const parsed = JSON.parse(sessionStr);
      const session = parsed as SessionData;

      if (Date.now() > session.expiresAt) {
         console.warn("[AUTH] Session expired. Logging out.");
         localStorage.removeItem(SESSION_KEY);
         return null;
      }

      return session.user;
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  },

  // USER MANAGEMENT STUBS (Assume handled by Admin API)
  createUser: async (founder: User, data: any): Promise<AuthResponse> => {
    authService.requireRole(founder, UserRole.FOUNDER);
    throw new Error("User creation via UI is disabled in Hardened Production Mode. Use Admin Console.");
  },

  // Fix: Added createClientUser to resolve missing property error in ClientManager.tsx
  createClientUser: async (founder: User, data: any): Promise<AuthResponse> => {
    authService.requireRole(founder, UserRole.FOUNDER);
    throw new Error("Client User creation disabled in Production Mode.");
  },

  updateUserStatus: async (founder: User, userId: string, status: UserStatus): Promise<void> => {
    authService.requireRole(founder, UserRole.FOUNDER);
    console.warn("User status update simulated locally.");
  },

  resetPassword: async (userId: string, newPassword: string): Promise<AuthResponse> => {
    return { success: false, message: "Password reset disabled in UI. Contact Admin." };
  },

  getAllUsers: async (): Promise<User[]> => {
    return [];
  },

  requestPasswordReset: async (identifier: string): Promise<AuthResponse> => {
    return { success: true, message: 'If account exists, OTP has been sent (Simulated).' };
  },

  confirmPasswordReset: async (identifier: string, otp: string, newPass: string): Promise<AuthResponse> => {
    return { success: false, message: 'Self-service reset disabled.' };
  }
};
