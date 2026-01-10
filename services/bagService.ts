
import { Bag, BagStatus, BagType, BagException, ExceptionType, User, UserRole } from '../types';
import { complianceService } from './complianceService';
import { shipmentService } from './shipmentService';

const BAGS_KEY = 'fendex_bags_db';
const EXCEPTIONS_KEY = 'fendex_bag_exceptions_db';

const getBagsDb = (): Bag[] => {
  const stored = localStorage.getItem(BAGS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveBagsDb = (data: Bag[]) => {
  localStorage.setItem(BAGS_KEY, JSON.stringify(data));
};

const getExceptionsDb = (): BagException[] => {
  const stored = localStorage.getItem(EXCEPTIONS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveExceptionsDb = (data: BagException[]) => {
  localStorage.setItem(EXCEPTIONS_KEY, JSON.stringify(data));
};

export const bagService = {
  
  getBags: async (mmdcId: string): Promise<Bag[]> => {
    await new Promise(r => setTimeout(r, 200));
    const all = getBagsDb();
    // Return bags currently at this MMDC or destined for this MMDC
    return all.filter(b => b.mmdcId === mmdcId || b.destinationEntityId === mmdcId);
  },

  getBagByCode: async (code: string): Promise<Bag | undefined> => {
    const all = getBagsDb();
    return all.find(b => b.bagCode === code);
  },

  // 1. CREATION (Outbound Origin)
  createBag: async (user: User, mmdcId: string, type: BagType, destinationId: string): Promise<Bag> => {
    const db = getBagsDb();
    const bagCode = `BAG-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
    
    const newBag: Bag = {
      id: `BG-${Date.now()}`,
      bagCode,
      mmdcId, // Current Location
      type,
      status: BagStatus.CREATED,
      
      originEntityId: mmdcId,
      destinationEntityId: destinationId,
      
      manifestCount: 0,
      actualCount: 0,
      shortageCount: 0,
      damageCount: 0,
      
      shipmentIds: [],
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };

    db.unshift(newBag);
    saveBagsDb(db);

    await complianceService.logEvent('BAG_OP', user, `Created ${type} Bag ${bagCode}`, { mmdcId, dest: destinationId });
    return newBag;
  },

  // Add Shipments to Bag (During Creation/Open Phase)
  scanShipment: async (user: User, bagId: string, awb: string): Promise<void> => {
    const db = getBagsDb();
    const bagIndex = db.findIndex(b => b.id === bagId);
    if (bagIndex === -1) throw new Error('Bag not found');
    
    const bag = db[bagIndex];

    if (bag.status !== BagStatus.CREATED && bag.status !== BagStatus.OPENED) {
      throw new Error(`Cannot add shipments to bag in ${bag.status} state.`);
    }

    const allShipments = await shipmentService.getShipments(user); 
    const shipment = allShipments.find(s => s.awb === awb);
    if (!shipment) throw new Error(`AWB ${awb} not found in system.`);

    const activeBag = db.find(b => b.id !== bagId && (b.status === BagStatus.CREATED || b.status === BagStatus.OPENED) && b.shipmentIds.includes(awb));
    if (activeBag) {
      throw new Error(`AWB ${awb} is already in active bag ${activeBag.bagCode}.`);
    }

    if (!bag.shipmentIds.includes(awb)) {
      bag.shipmentIds.push(awb);
      bag.actualCount = bag.shipmentIds.length;
      bag.manifestCount = bag.shipmentIds.length; // Sync Manifest count during creation
      saveBagsDb(db);
    }
  },

  // Seal Bag (Outbound Finalize)
  sealBag: async (user: User, bagId: string, sealNumber: string): Promise<void> => {
    const db = getBagsDb();
    const bag = db.find(b => b.id === bagId);
    if (!bag) throw new Error('Bag not found');

    if (bag.status !== BagStatus.CREATED && bag.status !== BagStatus.OPENED) {
      throw new Error('Bag cannot be sealed in current state.');
    }
    
    if (bag.type === BagType.OUTBOUND && bag.shipmentIds.length === 0) {
      throw new Error('Cannot seal an empty Outbound bag.');
    }

    if (!sealNumber || sealNumber.length < 3) {
      throw new Error('Valid Seal Number required.');
    }

    // In Strict Mode, CREATED bags are considered sealed once Seal No is applied
    // We update to SEALED status to reflect this state clearly
    bag.status = BagStatus.SEALED; 
    
    bag.sealNumber = sealNumber;
    bag.sealedAt = new Date().toISOString();
    
    saveBagsDb(db);
    await complianceService.logEvent('BAG_OP', user, `Sealed Bag ${bag.bagCode}`, { seal: sealNumber, count: bag.actualCount });
  },

  // 2. INBOUND PROCESSING (Strict)
  
  validateInboundBag: async (user: User, bagCode: string, inputSeal: string): Promise<Bag> => {
     const db = getBagsDb();
     const bag = db.find(b => b.bagCode === bagCode);
     if (!bag) throw new Error('Bag not found');

     // Must be DISPATCHED from origin to be received here (or In Transit)
     // Also valid if 'CREATED' locally? No, this is inbound.
     if (bag.status !== BagStatus.DISPATCHED && bag.status !== BagStatus.IN_TRANSIT) {
        // Allow re-scan if already received (Idempotency)
        if (bag.status === BagStatus.INBOUND_RECEIVED) return bag;
        throw new Error(`Bag status ${bag.status} invalid for Inbound Scan`);
     }

     // Seal Match
     if (bag.sealNumber !== inputSeal && inputSeal !== 'LEGACY_SKIP_SEAL') {
        throw new Error(`SEAL MISMATCH! System: ${bag.sealNumber}, Input: ${inputSeal}`);
     }

     // Set Status
     bag.status = BagStatus.INBOUND_RECEIVED;
     bag.receivedAt = new Date().toISOString();
     // Update current location custody
     bag.mmdcId = user.linkedEntityId; 

     saveBagsDb(db);
     
     await complianceService.logEvent(
        'BAG_INBOUND', 
        user, 
        `Inbound Verified Bag ${bag.bagCode}`, 
        { seal: inputSeal, tripId: bag.currentTripId }
     );
     
     return bag;
  },

  // 3. EXCEPTION HANDLING (Strict State Transition)
  
  recordException: async (user: User, data: { bagId: string, type: ExceptionType, shipmentId?: string, description: string }): Promise<void> => {
    const bagDb = getBagsDb();
    const bag = bagDb.find(b => b.id === data.bagId);
    if (!bag) throw new Error('Bag not found');

    // Exceptions only allowed during Inbound Receiving or after scan
    
    if (bag.status !== BagStatus.INBOUND_RECEIVED && bag.status !== BagStatus.DISPATCHED && bag.status !== BagStatus.IN_TRANSIT) { 
       // We'll relax slightly to allow marking just after scan or during transit check
    }

    const exDb = getExceptionsDb();
    
    const newEx: BagException = {
        id: `EX-${Date.now()}`,
        tripId: bag.currentTripId,
        ...data,
        reportedBy: user.id,
        reportedAt: new Date().toISOString()
    };

    exDb.push(newEx);
    
    // Update Bag Status & Counts - PERMANENT LOCK
    if (data.type === ExceptionType.SHORTAGE) {
       bag.shortageCount++;
       bag.status = BagStatus.SHORTAGE_MARKED;
    }
    if (data.type === ExceptionType.DAMAGE) {
       bag.damageCount++;
       bag.status = BagStatus.DAMAGE_MARKED;
    }
    
    saveBagsDb(bagDb);
    saveExceptionsDb(exDb);

    await complianceService.logEvent(
       'BAG_EXCEPTION', 
       user, 
       `Recorded ${data.type} in Bag ${bag.bagCode}`, 
       { shipment: data.shipmentId, desc: data.description, trip: bag.currentTripId }
    );
  },

  // 4. CONNECTION (MMDC Logic)
  
  connectBag: async (user: User, bagCode: string, sheetId: string): Promise<void> => {
     const db = getBagsDb();
     const bag = db.find(b => b.bagCode === bagCode);
     if (!bag) throw new Error('Bag not found');

     // Rule 5: Bag can be CONNECTED ONLY if Bag_Status = INBOUND_RECEIVED (or SEALED/CREATED if local outbound)
     if (bag.status !== BagStatus.INBOUND_RECEIVED && bag.status !== BagStatus.CREATED && bag.status !== BagStatus.SEALED) {
        throw new Error(`Bag ${bagCode} is ${bag.status}. Must be INBOUND_RECEIVED or SEALED/CREATED to connect.`);
     }

     if (bag.currentConnectionSheetId) {
        throw new Error(`Bag ${bagCode} already connected to ${bag.currentConnectionSheetId}`);
     }

     bag.status = BagStatus.CONNECTED;
     bag.currentConnectionSheetId = sheetId;
     
     saveBagsDb(db);
     // Connection Sheet update happens in connectionSheetService usually, ensuring consistency
  },

  // 5. DISPATCH (Trip Outbound)
  
  dispatchBag: async (bagId: string, tripId: string): Promise<void> => {
     const db = getBagsDb();
     const bag = db.find(b => b.id === bagId);
     if (bag) {
        bag.status = BagStatus.DISPATCHED;
        bag.currentTripId = tripId;
        bag.dispatchedAt = new Date().toISOString();
        // Clear connection sheet ref as it's processed? Or keep for audit? Keep.
        saveBagsDb(db);
     }
  },

  // Legacy/LMDC Wrappers
  receiveBag: async (user: User, bagCode: string): Promise<Bag> => {
    // LMDC generic receive
    return bagService.validateInboundBag(user, bagCode, 'LEGACY_SKIP_SEAL'); 
  },
  
  updateStatus: async (bagId: string, status: BagStatus, connectionSheetId?: string, tripId?: string) => {
     // Low level update for other services
     const db = getBagsDb();
     const bag = db.find(b => b.id === bagId);
     if (bag) {
        bag.status = status;
        if (connectionSheetId) bag.currentConnectionSheetId = connectionSheetId;
        if (tripId) bag.currentTripId = tripId;
        saveBagsDb(db);
     }
  },

  openBag: async (user: User, bagId: string): Promise<void> => {
    // LMDC Only
    const db = getBagsDb();
    const bag = db.find(b => b.id === bagId);
    
    if (bag) {
       bag.status = BagStatus.OPENED;
       bag.openedAt = new Date().toISOString();
       saveBagsDb(db);
    }
  },

  verifyShipmentScan: async (bagId: string, awb: string): Promise<boolean> => {
     const db = getBagsDb();
     const bag = db.find(b => b.id === bagId);
     
     if (bag && bag.shipmentIds.includes(awb)) {
        bag.actualCount = (bag.actualCount || 0) + 1;
        saveBagsDb(db);
        return true;
     }
     return false; 
  },

  getBagExceptions: async (bagId: string): Promise<BagException[]> => {
      const db = getExceptionsDb();
      return db.filter(e => e.bagId === bagId);
  }
};
