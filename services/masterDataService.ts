
import { DistributionCenter, MMDC, LastMileDC, RiderProfile, UserRole, RiderCapacityProfile, SYSTEM_HARD_CAPS, User, RiderTier } from '../types';
import { authService } from './authService';
import { complianceService } from './complianceService';
import api from './api';

const DC_KEY = 'fendex_dcs_db';
const MMDC_KEY = 'fendex_mmdcs_db';
const LMDC_KEY = 'fendex_lmdcs_db';
const RIDER_KEY = 'fendex_riders_db';
const RIDER_CAPACITY_KEY = 'fendex_rider_capacity_db';

const getDb = <T>(key: string): T[] => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

const saveDb = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const masterDataService = {
  getDCs: async (): Promise<DistributionCenter[]> => {
    return getDb(DC_KEY);
  },
  
  saveDC: async (dc: DistributionCenter): Promise<void> => {
    const dcs = getDb<DistributionCenter>(DC_KEY);
    if (dc.id) {
      const idx = dcs.findIndex(d => d.id === dc.id);
      if (idx !== -1) dcs[idx] = dc;
    } else {
      dc.id = 'DC-' + Date.now();
      dcs.push(dc);
    }
    saveDb(DC_KEY, dcs);
  },

  toggleDCStatus: async (id: string): Promise<void> => {
    const dcs = getDb<DistributionCenter>(DC_KEY);
    const dc = dcs.find(d => d.id === id);
    if (dc) {
      dc.status = dc.status === 'Active' ? 'Inactive' : 'Active';
      saveDb(DC_KEY, dcs);
    }
  },
  
  getMMDCs: async (): Promise<MMDC[]> => {
    return getDb(MMDC_KEY);
  },

  saveMMDC: async (mmdc: MMDC): Promise<void> => {
    const mmdcs = getDb<MMDC>(MMDC_KEY);
    if (mmdc.id) {
      const idx = mmdcs.findIndex(m => m.id === mmdc.id);
      if (idx !== -1) mmdcs[idx] = mmdc;
    } else {
      mmdc.id = 'MM-' + Date.now();
      mmdcs.push(mmdc);
    }
    saveDb(MMDC_KEY, mmdcs);
  },
  
  getLMDCs: async (): Promise<LastMileDC[]> => {
    return getDb(LMDC_KEY);
  },

  saveLMDC: async (lmdc: LastMileDC): Promise<void> => {
    const lmdcs = getDb<LastMileDC>(LMDC_KEY);
    if (lmdc.id) {
      const idx = lmdcs.findIndex(l => l.id === lmdc.id);
      if (idx !== -1) lmdcs[idx] = lmdc;
    } else {
      lmdc.id = 'LM-' + Date.now();
      lmdcs.push(lmdc);
    }
    saveDb(LMDC_KEY, lmdcs);
  },

  toggleLMDCStatus: async (id: string): Promise<void> => {
    const lmdcs = getDb<LastMileDC>(LMDC_KEY);
    const lmdc = lmdcs.find(l => l.id === id);
    if (lmdc) {
      lmdc.status = lmdc.status === 'Active' ? 'Inactive' : 'Active';
      saveDb(LMDC_KEY, lmdcs);
    }
  },

  getRiders: async (): Promise<RiderProfile[]> => {
    const riders = getDb<RiderProfile>(RIDER_KEY);
    const caps = getDb<RiderCapacityProfile>(RIDER_CAPACITY_KEY);
    return riders.map(r => ({
       ...r,
       capacityProfile: caps.find(c => c.riderId === r.id) || {
          riderId: r.id,
          maxFwd: SYSTEM_HARD_CAPS.FWD,
          maxFm: SYSTEM_HARD_CAPS.FM,
          maxRvp: SYSTEM_HARD_CAPS.RVP,
          isOverridden: false
       }
    }));
  },

  /**
   * PRODUCTION RIDER ONBOARDING
   * Calls the Backend Identity Core to ensure Rider App login compatibility.
   */
  saveRider: async (riderData: Partial<RiderProfile>, panImage?: File): Promise<void> => {
    // 1. Call Real Backend API for Onboarding Synchronization
    // This ensures rules like ACTIVE status and Standardized Phone are enforced at the DB level.
    const response = await api.post('/admin/onboard-rider', {
       name: riderData.name,
       phone: riderData.phone,
       lmdc_id: riderData.linkedLmdcId,
       pan_number: riderData.panNumber,
       pan_name: riderData.panName,
       bank_account: riderData.bankAccount,
       bank_ifsc: riderData.ifsc,
       bank_name: riderData.bankName
    });

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to sync rider with backend database.");
    }

    // 2. Synchronize Local Storage for Dashboard UI
    const riders = getDb<RiderProfile>(RIDER_KEY);
    const cleanPhone = response.data.phone; // Use normalized phone from backend
    const existingIdx = riders.findIndex(r => r.phone === cleanPhone);

    const finalRider: RiderProfile = {
      id: response.data.rider_id, // Use authoritative ID from backend
      name: riderData.name || '',
      phone: cleanPhone,
      altPhone: riderData.altPhone || '',
      address: riderData.address || '',
      linkedLmdcId: riderData.linkedLmdcId || '',
      status: 'Active',
      panNumber: riderData.panNumber,
      panName: riderData.panName,
      panProofUrl: riderData.panProofUrl || '',
      accountHolderName: riderData.accountHolderName || riderData.name,
      bankAccount: riderData.bankAccount,
      ifsc: riderData.ifsc,
      bankName: riderData.bankName,
      bankProofUrl: riderData.bankProofUrl,
      tier: riderData.tier || RiderTier.TIER_1
    };

    if (existingIdx !== -1) {
      riders[existingIdx] = finalRider;
    } else {
      riders.push(finalRider);
    }
    saveDb(RIDER_KEY, riders);

    // 3. Update Capacity Record
    const caps = getDb<RiderCapacityProfile>(RIDER_CAPACITY_KEY);
    if (!caps.some(c => c.riderId === finalRider.id)) {
      caps.push({
        riderId: finalRider.id,
        maxFwd: SYSTEM_HARD_CAPS.FWD,
        maxFm: SYSTEM_HARD_CAPS.FM,
        maxRvp: SYSTEM_HARD_CAPS.RVP,
        isOverridden: false
      });
      saveDb(RIDER_CAPACITY_KEY, caps);
    }

    console.log(`[ONBOARDING_SYNC] Authoritative Record Created: ${finalRider.id}`);
  },

  toggleRiderStatus: async (id: string): Promise<void> => {
    const riders = getDb<RiderProfile>(RIDER_KEY);
    const rider = riders.find(r => r.id === id);
    if (rider) {
      rider.status = rider.status === 'Active' ? 'Inactive' : 'Active';
      saveDb(RIDER_KEY, riders);
    }
  },

  getRiderCapacity: async (riderId: string): Promise<RiderCapacityProfile> => {
     const db = getDb<RiderCapacityProfile>(RIDER_CAPACITY_KEY);
     return db.find(p => p.riderId === riderId) || {
        riderId,
        maxFwd: SYSTEM_HARD_CAPS.FWD,
        maxFm: SYSTEM_HARD_CAPS.FM,
        maxRvp: SYSTEM_HARD_CAPS.RVP,
        isOverridden: false
     };
  },

  updateRiderCapacity: async (user: User, profile: RiderCapacityProfile): Promise<void> => {
     authService.requireRole(user, UserRole.FOUNDER);
     const db = getDb<RiderCapacityProfile>(RIDER_CAPACITY_KEY);
     const idx = db.findIndex(p => p.riderId === profile.riderId);
     const updatedProfile = { ...profile, isOverridden: true, updatedBy: user.id, updatedAt: new Date().toISOString() };
     if (idx !== -1) db[idx] = updatedProfile;
     else db.push(updatedProfile);
     saveDb(RIDER_CAPACITY_KEY, db);
     await complianceService.logEvent('CAPACITY_OP', user, `Updated Capacity for Rider ${profile.riderId}`, { fwd: profile.maxFwd });
  }
};
