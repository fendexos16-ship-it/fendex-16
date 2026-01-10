
import { AtlasServiceArea, AtlasStatus, AtlasAuditLog, User, UserRole, PincodeMaster, GeoPoint } from '../types';
import { complianceService } from './complianceService';
import { pincodeService } from './pincodeService';
import { authService } from './authService';

const ATLAS_AREAS_KEY = 'fendex_atlas_areas_db';
const ATLAS_AUDIT_KEY = 'fendex_atlas_audit_db';

const getAreasDb = (): AtlasServiceArea[] => {
  const stored = localStorage.getItem(ATLAS_AREAS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveAreasDb = (data: AtlasServiceArea[]) => {
  localStorage.setItem(ATLAS_AREAS_KEY, JSON.stringify(data));
};

const getAuditDb = (): AtlasAuditLog[] => {
  const stored = localStorage.getItem(ATLAS_AUDIT_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveAuditDb = (data: AtlasAuditLog[]) => {
  localStorage.setItem(ATLAS_AUDIT_KEY, JSON.stringify(data));
};

// --- GEOSPATIAL ALGORITHMS ---

/**
 * Ray-Casting Algorithm to check if a point is inside a polygon
 */
const isPointInPolygon = (point: GeoPoint, polygon: GeoPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;

    const intersect = ((yi > point.lng) !== (yj > point.lng))
        && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export const atlasService = {
  
  // 1. READ OPERATIONS
  
  getServiceAreas: async (lmdcId?: string): Promise<AtlasServiceArea[]> => {
    await new Promise(r => setTimeout(r, 200));
    const all = getAreasDb();
    if (lmdcId) {
      return all.filter(a => a.lmdcId === lmdcId);
    }
    return all;
  },

  getAllPendingApprovals: async (): Promise<AtlasServiceArea[]> => {
    const all = getAreasDb();
    return all.filter(a => a.status === AtlasStatus.PENDING_APPROVAL);
  },

  getActiveArea: async (lmdcId: string): Promise<AtlasServiceArea | undefined> => {
    const all = getAreasDb();
    return all.find(a => a.lmdcId === lmdcId && (a.status === AtlasStatus.ACTIVE || a.status === AtlasStatus.LOCKED));
  },

  getAuditLogs: async (lmdcId?: string): Promise<AtlasAuditLog[]> => {
    const logs = getAuditDb();
    if (lmdcId) return logs.filter(l => l.lmdcId === lmdcId);
    return logs;
  },

  // 2. WRITE OPERATIONS (DRAFT)

  saveDraft: async (user: User, area: Omit<AtlasServiceArea, 'id' | 'status' | 'version' | 'createdAt' | 'createdBy'>): Promise<AtlasServiceArea> => {
    // Permission Check: Founder OR Area Manager
    authService.requireRole(user, [UserRole.FOUNDER, UserRole.AREA_MANAGER]);

    const all = getAreasDb();
    
    // Check if Draft exists
    let draft = all.find(a => a.lmdcId === area.lmdcId && a.status === AtlasStatus.DRAFT);
    
    // Check locked state of current active
    const locked = all.find(a => a.lmdcId === area.lmdcId && a.status === AtlasStatus.LOCKED);
    if (locked && user.role !== UserRole.FOUNDER) {
      throw new Error('This Area is LOCKED. Contact Founder to unlock before editing.');
    }

    // Versioning Logic
    const active = all.find(a => a.lmdcId === area.lmdcId && (a.status === AtlasStatus.ACTIVE || a.status === AtlasStatus.LOCKED));
    const nextVersion = active ? active.version + 1 : 1;

    if (draft) {
      // Update existing Draft
      draft.polygon = area.polygon;
      draft.pincodes = area.pincodes;
      draft.name = area.name;
      draft.city = area.city;
      draft.state = area.state;
      draft.createdBy = user.id; 
      draft.createdAt = new Date().toISOString(); 
      // Keep version consistent with next expected
      draft.version = nextVersion;
    } else {
      // Create new Draft
      draft = {
        id: `ATLAS-${Date.now()}`,
        lmdcId: area.lmdcId,
        name: area.name,
        city: area.city,
        state: area.state,
        status: AtlasStatus.DRAFT,
        version: nextVersion,
        polygon: area.polygon,
        pincodes: area.pincodes,
        createdBy: user.id,
        createdAt: new Date().toISOString()
      };
      all.push(draft);
    }

    saveAreasDb(all);
    await atlasService.logAudit('DRAW', user, draft.lmdcId, draft.id, `Draft v${nextVersion} saved with ${area.pincodes.length} pincodes`);
    
    return draft;
  },

  // 3. STATE TRANSITIONS

  submitForApproval: async (user: User, draftId: string): Promise<void> => {
    authService.requireRole(user, [UserRole.FOUNDER, UserRole.AREA_MANAGER]);
    
    const all = getAreasDb();
    const area = all.find(a => a.id === draftId);
    if (!area || area.status !== AtlasStatus.DRAFT) throw new Error('Invalid Draft');

    if (area.pincodes.length === 0) throw new Error('Cannot submit Atlas without Pincodes');

    area.status = AtlasStatus.PENDING_APPROVAL;
    saveAreasDb(all);
    await atlasService.logAudit('SUBMIT', user, area.lmdcId, area.id, `v${area.version} submitted for approval`);
  },

  approveArea: async (user: User, draftId: string, forceOverlap: boolean = false): Promise<void> => {
    // STRICT CHECK: Founder Only
    authService.requireRole(user, UserRole.FOUNDER);

    const all = getAreasDb();
    const draftIndex = all.findIndex(a => a.id === draftId);
    if (draftIndex === -1) throw new Error('Draft not found');
    
    const draft = all[draftIndex];
    if (draft.status !== AtlasStatus.PENDING_APPROVAL) throw new Error('Area is not in Pending state');

    // CONFLICT CHECK: Pincode Overlap
    if (!forceOverlap) {
      const allActive = all.filter(a => (a.status === AtlasStatus.ACTIVE || a.status === AtlasStatus.LOCKED) && a.lmdcId !== draft.lmdcId);
      for (const activeArea of allActive) {
        const overlap = draft.pincodes.find(p => activeArea.pincodes.includes(p));
        if (overlap) {
          throw new Error(`CONFLICT: Pincode ${overlap} is already served by active area ${activeArea.name} (LMDC: ${activeArea.lmdcId}). Enable 'Force Overlap' to override.`);
        }
      }
    }

    // ARCHIVE current active for this LMDC
    const currentActiveIndex = all.findIndex(a => a.lmdcId === draft.lmdcId && (a.status === AtlasStatus.ACTIVE || a.status === AtlasStatus.LOCKED));
    if (currentActiveIndex !== -1) {
      all[currentActiveIndex].status = AtlasStatus.DISABLED;
    }

    // ACTIVATE Draft
    draft.status = AtlasStatus.ACTIVE;
    draft.approvedBy = user.id;
    draft.approvedAt = new Date().toISOString();
    
    all[draftIndex] = draft;
    saveAreasDb(all);

    // SYNC to Pincode Master (Routing Table)
    await atlasService.syncToPincodeMaster(draft);

    await atlasService.logAudit('APPROVE', user, draft.lmdcId, draft.id, `Version ${draft.version} Activated`);
    await complianceService.logEvent('ATLAS_OP', user, `Atlas Version ${draft.version} Approved for LMDC ${draft.lmdcId}`, { draftId, pincodes: draft.pincodes.length });
  },

  rejectArea: async (user: User, draftId: string, reason: string): Promise<void> => {
    authService.requireRole(user, UserRole.FOUNDER);
    
    const all = getAreasDb();
    const area = all.find(a => a.id === draftId);
    if (!area) throw new Error('Area not found');

    area.status = AtlasStatus.DRAFT; // Revert to Draft
    saveAreasDb(all);
    await atlasService.logAudit('REJECT', user, area.lmdcId, area.id, `Rejected: ${reason}`);
  },

  lockArea: async (user: User, areaId: string): Promise<void> => {
    authService.requireRole(user, UserRole.FOUNDER);
    const all = getAreasDb();
    const area = all.find(a => a.id === areaId);
    if (!area || area.status !== AtlasStatus.ACTIVE) throw new Error('Only Active areas can be locked');

    area.status = AtlasStatus.LOCKED;
    area.lockedBy = user.id;
    area.lockedAt = new Date().toISOString();
    
    saveAreasDb(all);
    await atlasService.logAudit('LOCK', user, area.lmdcId, area.id, `Area Locked by Founder`);
  },

  unlockArea: async (user: User, areaId: string): Promise<void> => {
    authService.requireRole(user, UserRole.FOUNDER);
    const all = getAreasDb();
    const area = all.find(a => a.id === areaId);
    if (!area || area.status !== AtlasStatus.LOCKED) throw new Error('Area not locked');

    area.status = AtlasStatus.ACTIVE;
    area.lockedBy = undefined;
    area.lockedAt = undefined;
    
    saveAreasDb(all);
    await atlasService.logAudit('UNLOCK', user, area.lmdcId, area.id, `Area Unlocked by Founder`);
  },

  // 4. SYNC HELPER (MANDATORY ROUTING UPDATE)
  syncToPincodeMaster: async (area: AtlasServiceArea) => {
    // This updates the flat PincodeMaster table for O(1) routing
    const allPincodes = await pincodeService.getAll();
    
    for (const p of area.pincodes) {
      const existing = allPincodes.find(pm => pm.pincode === p);
      if (existing) {
        // Re-assign existing pincode
        existing.linkedLmdcId = area.lmdcId;
        existing.serviceable = true;
        // Keep existing city/state if available
        await pincodeService.update(existing);
      } else {
        // Auto-create new pincode entry
        const newPin: PincodeMaster = {
          pincode: p,
          city: area.city || 'Atlas Mapped', 
          state: area.state || 'Atlas Mapped',
          zone: 'Local' as any,
          serviceable: true,
          linkedLmdcId: area.lmdcId
        };
        await pincodeService.create(newPin);
      }
    }
  },

  // 5. AUDIT LOGGING
  logAudit: async (
    action: AtlasAuditLog['action'], 
    user: User, 
    lmdcId: string, 
    entityId: string, 
    details: string
  ) => {
    const logs = getAuditDb();
    logs.unshift({
      id: `AT-LOG-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
      action,
      lmdcId,
      entityId,
      actorId: user.id,
      role: user.role,
      timestamp: new Date().toISOString(),
      details
    });
    saveAuditDb(logs);
  }
};