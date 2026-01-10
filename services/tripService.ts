
import { Trip, TripStatus, Bag, BagStatus, User, ConnectionSheet, TripSource, VehicleType } from '../types';
import { complianceService } from './complianceService';
import { bagService } from './bagService';
import { connectionSheetService } from './connectionSheetService';

const TRIPS_KEY = 'fendex_trips_db';
const BAGS_KEY = 'fendex_bags_db'; 

const getTripsDb = (): Trip[] => {
  const stored = localStorage.getItem(TRIPS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveTripsDb = (data: Trip[]) => {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(data));
};

const updateBagsStatus = (bagIds: string[], status: BagStatus, tripId?: string) => {
  const stored = localStorage.getItem(BAGS_KEY);
  const bags: Bag[] = stored ? JSON.parse(stored) : [];
  let updated = false;
  
  bags.forEach(b => {
    if (bagIds.includes(b.id)) {
      b.status = status;
      if (tripId) b.currentTripId = tripId;
      updated = true;
    }
  });
  
  if (updated) localStorage.setItem(BAGS_KEY, JSON.stringify(bags));
};

export const tripService = {
  
  getTrips: async (entityId: string): Promise<Trip[]> => {
    await new Promise(r => setTimeout(r, 200));
    const all = getTripsDb();
    return all.filter(t => t.originEntityId === entityId || t.destinationEntityId === entityId);
  },

  createTrip: async (user: User, data: Omit<Trip, 'id' | 'tripCode' | 'status' | 'bagIds' | 'createdBy' | 'createdAt'>): Promise<Trip> => {
    const db = getTripsDb();
    const tripCode = `TRIP-${Date.now().toString().slice(-6)}`;
    
    const source = data.tripSource || TripSource.INTERNAL_TRANSFER;

    const newTrip: Trip = {
      id: `TR-${Date.now()}`,
      tripCode,
      ...data,
      tripSource: source,
      bagIds: [],
      status: TripStatus.CREATED,
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };

    db.unshift(newTrip);
    saveTripsDb(db);
    
    await complianceService.logEvent('TRIP_OP', user, `Created Trip ${tripCode}`, { origin: data.originEntityId, dest: data.destinationEntityId, source });
    return newTrip;
  },

  // MMDC OUTBOUND DISPATCH (HARD CONTROL MODE)
  createAndDispatchOutbound: async (
    user: User, 
    data: {
      originMmdcId: string;
      destinationId: string;
      sheetIds: string[];
      vehicle: { number: string, type: VehicleType, transporter?: string };
      driver: { name: string, phone: string };
    }
  ): Promise<Trip> => {
    
    const db = getTripsDb();
    const sheets = await connectionSheetService.getSheets(data.originMmdcId);
    
    // 1. Validation Pre-Flight (Hard Stop)
    if (data.sheetIds.length === 0) throw new Error("No Connection Sheets selected for dispatch.");
    if (!data.vehicle.number || !data.vehicle.type) throw new Error("Vehicle details incomplete.");
    if (!data.driver.name || !data.driver.phone) throw new Error("Driver details incomplete.");

    const targetSheets = sheets.filter(s => data.sheetIds.includes(s.id));
    
    if (targetSheets.length !== data.sheetIds.length) throw new Error("Some Sheets not found.");
    
    // Check all sheets match destination
    const invalidDest = targetSheets.find(s => s.destinationId !== data.destinationId);
    if (invalidDest) throw new Error(`Routing Conflict: Sheet ${invalidDest.code} has different destination.`);

    // Check all sheets are CLOSED
    const openSheet = targetSheets.find(s => s.status !== 'CLOSED');
    if (openSheet) throw new Error(`Protocol Violation: Sheet ${openSheet.code} is not CLOSED.`);

    // Collect all Bags
    const allBagIds: string[] = [];
    targetSheets.forEach(s => allBagIds.push(...s.bagIds));

    // 2. Create Outbound Trip (ATOMIC Creation in IN_TRANSIT state)
    const tripCode = `OUT-TRIP-${Date.now().toString().slice(-6)}`;
    const newTrip: Trip = {
      id: `TR-${Date.now()}`,
      tripCode,
      originEntityId: data.originMmdcId,
      destinationEntityId: data.destinationId,
      tripSource: TripSource.INTERNAL_TRANSFER,
      
      // Mandatory Hard Mode Fields
      vehicleNumber: data.vehicle.number,
      vehicleType: data.vehicle.type,
      transporterName: data.vehicle.transporter,
      driverName: data.driver.name,
      driverPhone: data.driver.phone,
      
      bagIds: allBagIds,
      connectionSheetIds: data.sheetIds,
      status: TripStatus.IN_TRANSIT, // Direct to In Transit (No draft)
      
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      dispatchedAt: new Date().toISOString()
    };

    db.unshift(newTrip);
    saveTripsDb(db);

    // 3. Update Sheets to DISPATCHED
    for (const sheetId of data.sheetIds) {
       await connectionSheetService.markDispatched(sheetId);
    }

    // 4. Update Bags to DISPATCHED
    updateBagsStatus(allBagIds, BagStatus.DISPATCHED, newTrip.id);

    // 5. Immutable Audit
    await complianceService.logEvent(
       'TRIP_DISPATCH', 
       user, 
       `Outbound Dispatch ${tripCode}`, 
       { 
          vehicle: data.vehicle, 
          driver: data.driver, 
          sheets: data.sheetIds.length,
          bags: allBagIds.length
       }
    );

    return newTrip;
  },

  addBagToTrip: async (tripId: string, bagCode: string): Promise<void> => {
    const db = getTripsDb();
    const trip = db.find(t => t.id === tripId);
    if (!trip) throw new Error('Trip not found');

    if (trip.status !== TripStatus.CREATED) throw new Error('Cannot add bags to dispatched/closed trip.');

    const bag = await bagService.getBagByCode(bagCode);
    if (!bag) throw new Error('Bag not found');

    if (!trip.bagIds.includes(bag.id)) {
      trip.bagIds.push(bag.id);
      saveTripsDb(db);
      if (bag.status === BagStatus.SEALED) {
         updateBagsStatus([bag.id], BagStatus.SEALED, tripId);
      }
    }
  },

  dispatchConnectionSheet: async (user: User, tripId: string, sheetIds: string[]): Promise<void> => {
     // Legacy wrapper maintained for backward compatibility if needed, 
     // but MMDCOutbound now uses createAndDispatchOutbound.
     // Implementing as alias to strict logic? No, this was for pre-created trips.
     // To support legacy flow:
     const db = getTripsDb();
     const trip = db.find(t => t.id === tripId);
     if (!trip) throw new Error('Trip not found');
     
     // Delegate update logic same as above
     const sheets = await connectionSheetService.getSheets(trip.originEntityId);
     const targetSheets = sheets.filter(s => sheetIds.includes(s.id));

     for (const sheet of targetSheets) {
        if (sheet.status !== 'CLOSED') throw new Error(`Sheet ${sheet.code} must be CLOSED`);
        
        for (const bagId of sheet.bagIds) {
           if (!trip.bagIds.includes(bagId)) trip.bagIds.push(bagId);
           await bagService.updateStatus(bagId, BagStatus.DISPATCHED, undefined, tripId);
        }
        await connectionSheetService.markDispatched(sheet.id);
     }
     
     trip.status = TripStatus.IN_TRANSIT;
     trip.dispatchedAt = new Date().toISOString();
     trip.connectionSheetIds = sheetIds;
     saveTripsDb(db);

     await complianceService.logEvent('TRIP_OP', user, `Dispatched Trip ${trip.tripCode} with Sheets`, {});
  },

  dispatchTrip: async (user: User, tripId: string): Promise<void> => {
    const db = getTripsDb();
    const trip = db.find(t => t.id === tripId);
    if (!trip) throw new Error('Trip not found');

    if (trip.bagIds.length === 0) throw new Error('Cannot dispatch empty trip.');
    if (trip.status !== TripStatus.CREATED) throw new Error('Trip already dispatched.');

    trip.status = TripStatus.IN_TRANSIT; 
    trip.dispatchedAt = new Date().toISOString();
    
    saveTripsDb(db);
    updateBagsStatus(trip.bagIds, BagStatus.IN_TRANSIT, tripId);

    await complianceService.logEvent('TRIP_OP', user, `Dispatched Trip ${trip.tripCode}`, { bags: trip.bagIds.length });
  },

  markArrived: async (user: User, tripId: string) => {
     const db = getTripsDb();
     const trip = db.find(t => t.id === tripId);
     if (!trip) throw new Error('Trip not found');
     
     if (trip.status !== TripStatus.IN_TRANSIT) throw new Error(`Trip must be IN_TRANSIT to arrive. Current: ${trip.status}`);
     
     trip.status = TripStatus.ARRIVED;
     trip.arrivedAt = new Date().toISOString();
     saveTripsDb(db);
     
     await complianceService.logEvent('TRIP_INBOUND', user, `Vehicle Arrived for Trip ${trip.tripCode}`, { source: trip.tripSource });
  },

  startUnloading: async (user: User, tripId: string) => {
     const db = getTripsDb();
     const trip = db.find(t => t.id === tripId);
     if (!trip) throw new Error('Trip not found');

     if (trip.status !== TripStatus.ARRIVED) throw new Error(`Trip must be ARRIVED to unload. Current: ${trip.status}`);

     trip.status = TripStatus.UNLOADING;
     saveTripsDb(db);

     await complianceService.logEvent('TRIP_INBOUND', user, `Started Unloading Trip ${trip.tripCode}`, { source: trip.tripSource });
  },

  receiveTrip: async (user: User, tripId: string): Promise<void> => {
    const db = getTripsDb();
    const trip = db.find(t => t.id === tripId);
    if (!trip) throw new Error('Trip not found');

    trip.status = TripStatus.RECEIVED;
    trip.receivedAt = new Date().toISOString();
    saveTripsDb(db);
    
    updateBagsStatus(trip.bagIds, BagStatus.RECEIVED, tripId);
    
    await complianceService.logEvent('TRIP_OP', user, `Received Trip ${trip.tripCode}`, { at: user.linkedEntityId });
  },
  
  completeInbound: async (user: User, tripId: string) => {
     const db = getTripsDb();
     const trip = db.find(t => t.id === tripId);
     if (!trip) throw new Error('Trip not found');
     
     if (trip.status !== TripStatus.UNLOADING) throw new Error(`Trip must be UNLOADING to complete. Current: ${trip.status}`);

     const bagsDb = JSON.parse(localStorage.getItem(BAGS_KEY) || '[]');
     const tripBags = bagsDb.filter((b: Bag) => trip.bagIds.includes(b.id));
     
     const unverified = tripBags.filter((b: Bag) => 
        b.status !== BagStatus.INBOUND_RECEIVED && 
        b.status !== BagStatus.SHORTAGE_MARKED && 
        b.status !== BagStatus.DAMAGE_MARKED
     );

     if (unverified.length > 0) {
        throw new Error(`INBOUND BLOCKED: ${unverified.length} bags not verified or flagged. Cannot complete.`);
     }
     
     trip.status = TripStatus.INBOUND_COMPLETED;
     trip.receivedAt = new Date().toISOString();
     saveTripsDb(db);
     
     await complianceService.logEvent('TRIP_INBOUND', user, `Completed Inbound Trip ${trip.tripCode}`, { source: trip.tripSource, bags: trip.bagIds.length });
  },

  closeTrip: async (user: User, tripId: string) => {
     const db = getTripsDb();
     const trip = db.find(t => t.id === tripId);
     if(trip) {
        trip.status = TripStatus.CLOSED;
        trip.closedAt = new Date().toISOString();
        saveTripsDb(db);
     }
  }
};
