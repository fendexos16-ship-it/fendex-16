
import { CapacityOverride, RiderTier, User, UserRole, RiderProfile, RiderCapacityStatus } from '../types';
import { complianceService } from './complianceService';
import { authService } from './authService';
import { masterDataService } from './masterDataService';

const OVERRIDES_KEY = 'fendex_capacity_overrides_db';

const getOverridesDb = (): CapacityOverride[] => {
  const stored = localStorage.getItem(OVERRIDES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveOverridesDb = (data: CapacityOverride[]) => {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(data));
};

// HARDCODED TIER DEFAULTS (As per Policy)
const TIER_DEFAULTS = {
  [RiderTier.TIER_1]: { fwd: 1, fm: 1, rvp: 1 },
  [RiderTier.TIER_2]: { fwd: 2, fm: 2, rvp: 1 },
  [RiderTier.TIER_3]: { fwd: 3, fm: 2, rvp: 1 }
};

export const capacityService = {
  
  /**
   * Core Engine: Determines what a rider can do on a specific date.
   * Priority: Active Override > Tier Default.
   */
  getEffectiveCapacity: async (rider: RiderProfile, date: string): Promise<{ fwd: number, fm: number, rvp: number, source: 'OVERRIDE' | 'TIER' }> => {
    // 1. Check for Active Override
    const overrides = getOverridesDb();
    
    // Find latest override that covers this date and is ACTIVE
    // We sort by createdAt desc to get the most recently applied rule if overlaps exist (though saving should handle superseding)
    const activeOverride = overrides
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .find(o => 
        o.riderId === rider.id &&
        o.status === 'ACTIVE' &&
        date >= o.effectiveFrom &&
        date <= o.effectiveTo
      );

    if (activeOverride) {
      return {
        fwd: activeOverride.fwdLimit,
        fm: activeOverride.fmLimit,
        rvp: activeOverride.rvpLimit,
        source: 'OVERRIDE'
      };
    }

    // 2. Fallback to Tier Default
    const tier = rider.tier || RiderTier.TIER_1;
    const defaults = TIER_DEFAULTS[tier] || TIER_DEFAULTS[RiderTier.TIER_1];
    
    return {
      fwd: defaults.fwd,
      fm: defaults.fm,
      rvp: defaults.rvp,
      source: 'TIER'
    };
  },

  getAllOverrides: async (user: User): Promise<CapacityOverride[]> => {
    authService.requireRole(user, UserRole.FOUNDER);
    return getOverridesDb();
  },

  getActiveOverridesForDc: async (user: User, dcId: string, date: string): Promise<CapacityOverride[]> => {
    authService.requireRole(user, UserRole.FOUNDER);
    const all = getOverridesDb();
    return all.filter(o => 
      o.dcId === dcId && 
      o.status === 'ACTIVE' &&
      date >= o.effectiveFrom &&
      date <= o.effectiveTo
    );
  },

  // API 1 Implementation: Aggregated Data for Founder View
  getRidersForDc: async (user: User, dcId: string, date: string): Promise<RiderCapacityStatus[]> => {
    authService.requireRole(user, UserRole.FOUNDER);
    
    // 1. Get Riders in this DC (via LMDC linkage)
    // Hierarchy: DC -> MMDC -> LMDC -> Rider
    const mmdcs = await masterDataService.getMMDCs();
    const dcMmdcIds = mmdcs.filter(m => m.linkedDcId === dcId).map(m => m.id);
    
    const lmdcs = await masterDataService.getLMDCs();
    // Filter LMDCs belonging to the identified MMDCs
    const dcLmdcIds = lmdcs.filter(l => dcMmdcIds.includes(l.linkedMmdcId)).map(l => l.id);
    
    const allRiders = await masterDataService.getRiders();
    const dcRiders = allRiders.filter(r => dcLmdcIds.includes(r.linkedLmdcId) && r.status === 'Active');

    // 2. Resolve Capacity for each
    const results = await Promise.all(dcRiders.map(async (r) => {
        const resolution = await capacityService.getEffectiveCapacity(r, date);
        const tier = r.tier || RiderTier.TIER_1;
        const defaults = TIER_DEFAULTS[tier] || TIER_DEFAULTS[RiderTier.TIER_1];

        // Check specifically if an override was used
        const overrides = getOverridesDb();
        const activeOverride = overrides
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .find(o => 
                o.riderId === r.id &&
                o.status === 'ACTIVE' &&
                date >= o.effectiveFrom &&
                date <= o.effectiveTo
            );

        return {
            riderId: r.id,
            name: r.name,
            tier: tier,
            defaultCapacity: defaults,
            activeOverride: activeOverride ? {
                fwd: activeOverride.fwdLimit,
                fm: activeOverride.fmLimit,
                rvp: activeOverride.rvpLimit,
                effectiveFrom: activeOverride.effectiveFrom,
                effectiveTo: activeOverride.effectiveTo
            } : undefined,
            effectiveCapacity: {
                fwd: resolution.fwd,
                fm: resolution.fm,
                rvp: resolution.rvp,
                source: resolution.source
            }
        };
    }));

    return results;
  },

  saveOverride: async (
    user: User, 
    data: { 
      riderId: string, 
      dcId: string, 
      fwd: number, 
      fm: number, 
      rvp: number, 
      start: string, 
      end: string, 
      reason: string 
    }
  ): Promise<void> => {
    
    // 1. Security Check
    authService.requireRole(user, UserRole.FOUNDER);

    // 2. Validation
    if (data.rvp > 1) throw new Error('RVP Capacity Hard Limit is 1. Cannot exceed.');
    if (data.fwd > 3) throw new Error('FWD Capacity Hard Limit is 3.');
    if (data.fm > 2) throw new Error('FM Capacity Hard Limit is 2.');
    if (!data.reason) throw new Error('Audit Reason is mandatory.');
    if (data.start > data.end) throw new Error('Invalid Date Range');

    // 3. Backend Verification: Rider Belongs to DC
    const riders = await masterDataService.getRiders();
    const rider = riders.find(r => r.id === data.riderId);
    if (!rider) throw new Error("Rider not found");
    
    // Resolve Rider's DC Hierarchy
    const lmdcs = await masterDataService.getLMDCs();
    const lmdc = lmdcs.find(l => l.id === rider.linkedLmdcId);
    if (!lmdc) throw new Error("Rider's Station (LMDC) not found");
    
    const mmdcs = await masterDataService.getMMDCs();
    const mmdc = mmdcs.find(m => m.id === lmdc.linkedMmdcId);
    if (!mmdc) throw new Error("Station's Hub (MMDC) not found");
    
    if (mmdc.linkedDcId !== data.dcId) {
        throw new Error(`Rider ${rider.name} does not belong to DC ${data.dcId}`);
    }

    const db = getOverridesDb();

    // 4. Supersede Overlap
    // Any existing ACTIVE override for this rider that overlaps the new range is marked SUPERSEDED
    let supersededCount = 0;
    db.forEach(o => {
      if (o.riderId === data.riderId && o.status === 'ACTIVE') {
         // Check overlap: (StartA <= EndB) and (EndA >= StartB)
         if ((data.start <= o.effectiveTo) && (data.end >= o.effectiveFrom)) {
            o.status = 'SUPERSEDED';
            supersededCount++;
         }
      }
    });

    // 5. Create New
    const newOverride: CapacityOverride = {
      id: `CAP-${Date.now()}-${Math.random().toString(36).substr(2,4)}`,
      riderId: data.riderId,
      dcId: data.dcId,
      fwdLimit: data.fwd,
      fmLimit: data.fm,
      rvpLimit: data.rvp,
      effectiveFrom: data.start,
      effectiveTo: data.end,
      reason: data.reason,
      status: 'ACTIVE',
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };

    db.unshift(newOverride);
    saveOverridesDb(db);

    // 6. Audit Log
    await complianceService.logEvent(
      'CAPACITY_OP',
      user,
      `Capacity Override Applied for Rider ${data.riderId}`,
      { 
        limits: { fwd: data.fwd, fm: data.fm, rvp: data.rvp },
        range: `${data.start} to ${data.end}`,
        reason: data.reason,
        superseded: supersededCount
      }
    );
  }
};
