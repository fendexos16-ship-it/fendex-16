import { IdempotencyRecord, ExecutionLock, CircuitBreakerState, User } from '../types';
import { complianceService } from './complianceService';

const IDEMPOTENCY_KEY = 'fendex_idempotency_db';
const LOCKS_KEY = 'fendex_locks_db';
const BREAKER_KEY = 'fendex_circuit_breakers_db';

// Constants
const LOCK_TTL_MS = 60 * 1000; // 1 Minute Lock
const BREAKER_THRESHOLD = 3;   // 3 Failures to Trip
const BREAKER_RESET_MS = 30 * 1000; // 30s Cool-down

// DB Accessors
const getDb = <T>(key: string): Record<string, T> => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : {};
};

const saveDb = <T>(key: string, data: Record<string, T>) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const resilienceService = {

  // --- 1. Idempotency ---
  
  checkIdempotency: (key: string): IdempotencyRecord | null => {
    const db = getDb<IdempotencyRecord>(IDEMPOTENCY_KEY);
    return db[key] || null;
  },

  recordIdempotency: (key: string, status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED', resultHash?: string) => {
    const db = getDb<IdempotencyRecord>(IDEMPOTENCY_KEY);
    db[key] = {
      key,
      status,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24hr Retention
      resultHash
    };
    saveDb(IDEMPOTENCY_KEY, db);
  },

  // --- 2. Execution Locks ---

  acquireLock: async (lockKey: string, owner: string): Promise<boolean> => {
    const db = getDb<ExecutionLock>(LOCKS_KEY);
    const existing = db[lockKey];
    
    // Check if locked and valid
    if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
      return false; // Locked by someone else
    }

    // Set Lock
    db[lockKey] = {
      key: lockKey,
      owner,
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString()
    };
    saveDb(LOCKS_KEY, db);
    return true;
  },

  releaseLock: async (lockKey: string, owner: string) => {
    const db = getDb<ExecutionLock>(LOCKS_KEY);
    if (db[lockKey] && db[lockKey].owner === owner) {
      delete db[lockKey];
      saveDb(LOCKS_KEY, db);
    }
  },

  // --- 3. Circuit Breaker ---

  getBreakerStatus: (gateway: string): CircuitBreakerState => {
    const db = getDb<CircuitBreakerState>(BREAKER_KEY);
    if (!db[gateway]) {
      // Init Default
      db[gateway] = { gateway, status: 'CLOSED', failCount: 0 };
      saveDb(BREAKER_KEY, db);
    }
    
    const state = db[gateway];

    // Check Auto-Reset (Half-Open logic simulation)
    if (state.status === 'OPEN' && state.lastFailureAt) {
      if (Date.now() - new Date(state.lastFailureAt).getTime() > BREAKER_RESET_MS) {
        state.status = 'HALF_OPEN';
        saveDb(BREAKER_KEY, db);
      }
    }

    return state;
  },

  recordGatewayFailure: async (gateway: string, user: User) => {
    const db = getDb<CircuitBreakerState>(BREAKER_KEY);
    const state = db[gateway] || { gateway, status: 'CLOSED', failCount: 0 };
    
    state.failCount++;
    state.lastFailureAt = new Date().toISOString();

    if (state.failCount >= BREAKER_THRESHOLD) {
      if (state.status !== 'OPEN') {
        state.status = 'OPEN';
        await complianceService.logEvent('CIRCUIT_TRIP', user, `Circuit Breaker TRIPPED for ${gateway}`, { failures: state.failCount });
      }
    }
    
    db[gateway] = state;
    saveDb(BREAKER_KEY, db);
  },

  recordGatewaySuccess: (gateway: string) => {
    const db = getDb<CircuitBreakerState>(BREAKER_KEY);
    const state = db[gateway];
    if (state) {
      if (state.status !== 'CLOSED' || state.failCount > 0) {
        state.status = 'CLOSED';
        state.failCount = 0;
        state.lastSuccessAt = new Date().toISOString();
        saveDb(BREAKER_KEY, db);
      }
    }
  },

  manualResetBreaker: async (gateway: string, user: User) => {
    const db = getDb<CircuitBreakerState>(BREAKER_KEY);
    db[gateway] = { gateway, status: 'CLOSED', failCount: 0, lastSuccessAt: new Date().toISOString() };
    saveDb(BREAKER_KEY, db);
    
    await complianceService.logEvent('INFRA_OP', user, `Manual Reset of Circuit Breaker: ${gateway}`, {});
  },

  // --- 4. Rate Limiting (Memory Only for Session) ---
  // In a real app, this uses Redis. Here we use a session-scoped map or LocalStorage for simplicity.
  
  checkRateLimit: (action: string, limitPerMinute: number): boolean => {
    const key = `ratelimit_${action}`;
    const now = Date.now();
    const storage = sessionStorage.getItem(key);
    
    let record = storage ? JSON.parse(storage) : { count: 0, windowStart: now };
    
    if (now - record.windowStart > 60000) {
      // Reset Window
      record = { count: 1, windowStart: now };
    } else {
      record.count++;
    }

    sessionStorage.setItem(key, JSON.stringify(record));

    return record.count <= limitPerMinute;
  }
};