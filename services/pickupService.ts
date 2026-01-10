
import { PickupRequest, PickupStatus, User, UserRole, ShipmentStatus } from '../types';
import { complianceService } from './complianceService';
import { shipmentService } from './shipmentService';

const PICKUPS_KEY = 'fendex_pickups_db';

const getDb = (): PickupRequest[] => {
  const stored = localStorage.getItem(PICKUPS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveDb = (data: PickupRequest[]) => {
  localStorage.setItem(PICKUPS_KEY, JSON.stringify(data));
};

export const pickupService = {
  
  getPickups: async (lmdcId: string): Promise<PickupRequest[]> => {
    await new Promise(r => setTimeout(r, 200));
    const all = getDb();
    return all.filter(p => p.lmdcId === lmdcId);
  },

  createPickup: async (user: User, data: { lmdcId: string, clientId: string, address: string, expectedCount: number }): Promise<PickupRequest> => {
    const db = getDb();
    
    const newPickup: PickupRequest = {
      id: `PKP-${Date.now().toString().slice(-6)}`,
      ...data,
      status: PickupStatus.SCHEDULED,
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };

    db.unshift(newPickup);
    saveDb(db);

    await complianceService.logEvent('PICKUP_OP', user, `Created Pickup Request ${newPickup.id}`, { client: data.clientId });
    return newPickup;
  },

  assignRider: async (user: User, pickupId: string, riderId: string) => {
    const db = getDb();
    const pickup = db.find(p => p.id === pickupId);
    if (!pickup) throw new Error('Pickup not found');

    if (pickup.status !== PickupStatus.SCHEDULED && pickup.status !== PickupStatus.ASSIGNED) {
      throw new Error(`Cannot assign rider to ${pickup.status} pickup.`);
    }

    pickup.assignedRiderId = riderId;
    pickup.status = PickupStatus.ASSIGNED;
    saveDb(db);

    await complianceService.logEvent('PICKUP_OP', user, `Assigned Rider ${riderId} to Pickup ${pickupId}`, {});
  },

  markPicked: async (user: User, pickupId: string) => {
    const db = getDb();
    const pickup = db.find(p => p.id === pickupId);
    if (!pickup) throw new Error('Pickup not found');

    if (pickup.status !== PickupStatus.ASSIGNED) throw new Error('Pickup must be Assigned first.');

    pickup.status = PickupStatus.PICKED;
    pickup.pickedAt = new Date().toISOString();
    saveDb(db);

    await complianceService.logEvent('PICKUP_OP', user, `Marked Pickup ${pickupId} as PICKED`, {});
  }
};
