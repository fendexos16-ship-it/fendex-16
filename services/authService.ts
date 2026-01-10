
import { User, UserRole, UserStatus, AuthResponse } from '../types';

const SESSION_KEY = 'fendex_auth_session_production_v1';
const USERS_DB_KEY = 'fendex_users_production_v1';

/**
 * BOOTSTRAP (RUNS ON EVERY START)
 * Enforces the canonical Founder identity.
 * Rule: id === email === username === "fendexlogistics@gmail.com"
 */
const bootstrap = () => {
  const users = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');
  const canonicalId = "fendexlogistics@gmail.com";
  
  // DUPLICATE PREVENTION: Ensure exactly one Founder exists
  const existingFounder = users.find((u: any) => u.role === UserRole.FOUNDER);
  
  if (!existingFounder) {
    const founder: User & { password?: string } = {
      id: canonicalId,
      email: canonicalId,
      username: canonicalId,
      password: "Nithya1996@@",
      name: "Operations Founder",
      phone: "0000000000",
      role: UserRole.FOUNDER,
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      createdAt: new Date().toISOString()
    };
    users.push(founder);
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
  } else {
    // Standardize existing Founder if fields are mismatched
    const idx = users.findIndex((u: any) => u.role === UserRole.FOUNDER);
    if (users[idx].id !== canonicalId || users[idx].username !== canonicalId) {
      users[idx].id = canonicalId;
      users[idx].email = canonicalId;
      users[idx].username = canonicalId;
      users[idx].password = "Nithya1996@@"; // Reset to standardized password
      localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
    }
  }
};

// Auto-run bootstrap on module load
bootstrap();

export const authService = {
  /**
   * login method: Uses the standardized username/email field
   */
  login: async (username: string, password: string): Promise<AuthResponse> => {
    await new Promise(r => setTimeout(r, 1000));
    const users = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');
    // Identity check against standardized username or phone
    const user = users.find((u: any) => u.username === username || u.phone === username || u.email === username);
    
    if (!user) return { success: false, message: 'Invalid credentials' };
    if (user.password !== password) return { success: false, message: 'Invalid credentials' };
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return { success: true, user };
  },

  /**
   * registerFounder: Standardized to use fendexlogistics@gmail.com as primary identity
   */
  registerFounder: async (name: string, phone: string, pass: string): Promise<AuthResponse> => {
     const users = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');
     const canonicalId = "fendexlogistics@gmail.com";
     
     // Remove any partial or stale records
     const filteredUsers = users.filter((u: any) => u.role !== UserRole.FOUNDER && u.id !== canonicalId);
     
     const founder: User & { password?: string } = {
        id: canonicalId,
        email: canonicalId,
        username: canonicalId,
        name,
        phone,
        password: pass,
        role: UserRole.FOUNDER,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        createdAt: new Date().toISOString()
     };
     
     filteredUsers.push(founder);
     localStorage.setItem(USERS_DB_KEY, JSON.stringify(filteredUsers));
     localStorage.setItem(SESSION_KEY, JSON.stringify(founder));
     return { success: true, user: founder };
  },

  getCurrentUser: (): User | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  requireRole: (user: User, roles: UserRole | UserRole[]) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(user.role)) {
      throw new Error('UNAUTHORIZED: Access Denied');
    }
  },

  requestPasswordReset: async (identifier: string): Promise<AuthResponse> => {
     return { success: true, message: 'OTP sent to registered phone (Simulated)' };
  },

  confirmPasswordReset: async (identifier: string, otp: string, newPass: string): Promise<AuthResponse> => {
    await new Promise(r => setTimeout(r, 800));

    // Simulation: accept any 6-digit OTP
    const isOtpValid = otp.length === 6;

    if (!isOtpValid) {
       return { success: false, message: 'Invalid or Expired OTP. Verification Failed.' };
    }

    const users = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');
    const userIndex = users.findIndex((u: any) => u.email === identifier || u.username === identifier || u.phone === identifier);

    if (userIndex === -1) return { success: false, message: 'Account not found.' };
    
    const user = users[userIndex];
    user.password = newPass;
    user.status = UserStatus.ACTIVE;
    
    users[userIndex] = user;
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));

    return { success: true, message: 'Password Updated Successfully' };
  },

  getAllUsers: async (): Promise<User[]> => {
     return JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');
  },

  createUser: async (founder: User, data: any): Promise<AuthResponse> => {
     const users = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');
     const tempPass = Math.floor(1000 + Math.random() * 9000).toString() + '@Fx';
     const newUser: User = {
        ...data,
        id: 'U-' + Date.now(),
        username: data.phone,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        createdAt: new Date().toISOString()
     };
     (newUser as any).password = tempPass;
     users.push(newUser);
     localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
     return { success: true, user: newUser, credentials: { username: newUser.username, tempPass } };
  },

  createClientUser: async (founder: User, data: any): Promise<AuthResponse> => {
      return authService.createUser(founder, { ...data, role: UserRole.CLIENT_VIEW });
  },

  updateUserStatus: async (founder: User, userId: string, status: UserStatus): Promise<void> => {
     const users = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');
     const idx = users.findIndex((u: any) => u.id === userId);
     if (idx !== -1) {
        users[idx].status = status;
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
     }
  },

  resetPassword: async (userId: string, newPassword: string): Promise<AuthResponse> => {
     const users = JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]');
     const idx = users.findIndex((u: any) => u.id === userId);
     if (idx !== -1) {
        users[idx].password = newPassword;
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
        return { success: true };
     }
     return { success: false, message: 'User not found' };
  }
};
