
import { User } from '../types';
import { complianceService } from './complianceService';

const RATE_LIMIT_KEY = 'fendex_rate_limit_db';

interface RateLimitStore {
  [key: string]: { count: number; windowStart: number };
}

export const securityService = {
  // WAF: Input Sanitization & Threat Detection
  validateInput: (input: any): { valid: boolean; reason?: string } => {
    if (!input) return { valid: true };
    const str = JSON.stringify(input);
    
    // 1. SQL Injection (Basic Heuristics)
    // Checks for common SQL keywords combined with boundary characters or comments
    if (/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC)\b.+[';])|(--)/i.test(str)) {
       return { valid: false, reason: 'SQL Injection Pattern Detected' };
    }
    
    // 2. XSS (Basic)
    if (/<script\b[^>]*>([\s\S]*?)<\/script>/i.test(str) || /javascript:/i.test(str) || /onerror=/i.test(str)) {
       return { valid: false, reason: 'XSS Pattern Detected' };
    }

    // 3. Path Traversal
    if (/\.\.\//.test(str) || /%2e%2e%2f/i.test(str)) {
       return { valid: false, reason: 'Path Traversal Detected' };
    }

    return { valid: true };
  },

  // Password Policy: Min 12 chars, Upper, Lower, Number, Special
  validatePassword: (password: string): { valid: boolean; reason?: string } => {
    if (password.length < 12) return { valid: false, reason: 'Password must be at least 12 characters.' };
    if (!/[A-Z]/.test(password)) return { valid: false, reason: 'Password must contain uppercase letter.' };
    if (!/[a-z]/.test(password)) return { valid: false, reason: 'Password must contain lowercase letter.' };
    if (!/[0-9]/.test(password)) return { valid: false, reason: 'Password must contain a number.' };
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return { valid: false, reason: 'Password must contain a special character.' };
    return { valid: true };
  },

  // Rate Limiter
  checkRateLimit: (key: string, limit: number, windowMs: number): boolean => {
    const db: RateLimitStore = JSON.parse(sessionStorage.getItem(RATE_LIMIT_KEY) || '{}');
    const now = Date.now();
    
    let record = db[key];
    if (!record || (now - record.windowStart > windowMs)) {
      record = { count: 0, windowStart: now };
    }
    
    record.count++;
    db[key] = record;
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(db));

    return record.count <= limit;
  },

  // Audit WAF Block
  logWafBlock: async (path: string, reason: string, ip: string) => {
     console.error(`[WAF] Blocked request to ${path}: ${reason}`);
     await complianceService.logEvent(
        'SECURITY_EVENT',
        { id: 'WAF_BOT', role: 'SYSTEM' },
        `WAF Blocked Request to ${path}`,
        { reason, ip }
     );
  },

  // Secrets Management Simulation
  maskSecret: (secret: string): string => {
     if (!secret) return '';
     return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
  }
};
