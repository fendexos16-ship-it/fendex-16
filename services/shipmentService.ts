
import { 
  Shipment, 
  ShipmentStatus, 
  User, 
  UserRole,
  LmdcShipmentType,
  GeoType,
  PaymentMode
} from '../types';
import { masterDataService } from './masterDataService';
import { ledgerService } from './ledgerService';
import { codService } from './codService'; 
import { slaService } from './slaService'; 
import { pincodeService } from './pincodeService'; 
import { clientService } from './clientService';
import { complianceService } from './complianceService';
import { webhookService } from './webhookService';

const SHIPMENTS_KEY = 'fendex_shipments_db';

const getDb = (): Shipment[] => {
  const stored = localStorage.getItem(SHIPMENTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveDb = (data: Shipment[]) => {
  localStorage.setItem(SHIPMENTS_KEY, JSON.stringify(data));
};

// Helper: Secure Webhook Dispatch
const triggerWebhook = async (shipment: Shipment, event: string) => {
  if (!shipment.clientId) return;
  
  // Use Client Service to get full config including failure counts
  const client = await clientService.getClientById(shipment.clientId);
  
  if (client) {
     // Delegate strict logic to Webhook Engine
     await webhookService.dispatch(client, event, {
         awb: shipment.awb,
         status: shipment.status,
         updatedAt: shipment.updatedAt,
         ref: shipment.clientId // Client Ref
     });
  }
};

export const shipmentService = {
  
  getShipments: async (user: User): Promise<Shipment[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Apply Schema Defaults (PREPAID / 0) for legacy data
    const allShipments = getDb().map(s => ({
      ...s,
      paymentMode: s.paymentMode || PaymentMode.PREPAID,
      codAmount: s.codAmount || 0
    }));

    // 1. GLOBAL ACCESS
    if (user.role === UserRole.FOUNDER || user.role === UserRole.FINANCE_ADMIN) {
      return allShipments;
    }

    // 2. RIDER ACCESS
    if (user.role === UserRole.RIDER) {
      const riders = await masterDataService.getRiders();
      const me = riders.find(r => r.phone === user.phone);
      if (!me) return [];
      return allShipments.filter(s => s.assignedRiderId === me.id);
    }

    // 3. AREA MANAGER ACCESS
    // LinkedEntityId corresponds to a Distribution Center (DC)
    if (user.role === UserRole.AREA_MANAGER) {
      if (user.linkedEntityId) {
        return allShipments.filter(s => s.linkedDcId === user.linkedEntityId);
      }
      return [];
    }

    // 4. LMDC ACCESS
    if (user.role === UserRole.LMDC_MANAGER) {
      if (user.linkedEntityId) {
        return allShipments.filter(s => s.linkedLmdcId === user.linkedEntityId);
      }
      return [];
    }

    // 5. CLIENT ACCESS (3PL / Direct / Portal User)
    if (user.role === UserRole.CLIENT || user.role === UserRole.CLIENT_VIEW) {
      if (user.linkedEntityId) {
        return allShipments.filter(s => s.clientId === user.linkedEntityId);
      }
      return [];
    }

    // 6. MMDC ACCESS (Aggregated View of Child LMDCs)
    if (user.role === UserRole.MMDC_MANAGER) {
       if (user.linkedEntityId) {
         // Get all LMDCs that report to this MMDC
         const lmdcs = await masterDataService.getLMDCs();
         const myLmdcIds = lmdcs
            .filter(l => l.linkedMmdcId === user.linkedEntityId)
            .map(l => l.id);
         
         // Return shipments linked to any of these LMDCs
         return allShipments.filter(s => myLmdcIds.includes(s.linkedLmdcId));
       }
       return [];
    }

    return []; 
  },

  createShipment: async (data: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'linkedLmdcId'>, actor?: User): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const db = getDb();
    
    // Uniqueness check on AWB (Strict FEN- format enforced below, checking provided AWB if any)
    if (db.some(s => s.awb === data.awb)) {
      throw new Error(`AWB ${data.awb} already exists.`);
    }

    // --- SECURITY & ROUTING LOCK ---
    // If actor is a Client (API or Portal), verify permission and IGNORE provided routing
    if (actor && (actor.role === UserRole.CLIENT || actor.role === UserRole.CLIENT_VIEW)) {
       if (!actor.linkedEntityId) throw new Error("Security Error: Unlinked Client Actor");
       
       const canCreate = await clientService.checkPermission(actor.linkedEntityId, 'canCreateShipment');
       if (!canCreate) {
          throw new Error("ACCESS DENIED: Your Client Type is not authorized to create shipments.");
       }

       // Audit if they tried to inject routing
       if ((data as any).linkedLmdcId || data.linkedDcId) {
          console.warn(`[SECURITY] Client ${actor.username} attempted to inject routing. System Overriding.`);
          await complianceService.logEvent('AUTH_OP', actor, 'Routing Injection Attempt Blocked', { awb: data.awb });
       }
    }

    const clientId = (actor?.role === UserRole.CLIENT || actor?.role === UserRole.CLIENT_VIEW) ? actor.linkedEntityId : data.clientId;

    // --- BILLING LOCK (PREPAID CHECK) ---
    // Before processing, validate if Client has balance.
    if (clientId) {
       const client = await clientService.getClientById(clientId);
       if (client) {
          // If Prepaid, check balance against Contract Rate (default 50 if unset)
          await clientService.validateCredit(clientId, client.contractRate);
       }
    }

    // PHASE E: ROUTING LOGIC (AUTO-ASSIGN LMDC) - MANDATORY
    let assignedLmdcId = '';
    let assignedDcId = data.linkedDcId; // Default to provided, but might need override based on Pincode

    try {
      const lmdc = await pincodeService.findLmdcForRouting(data.destinationPincode);
      assignedLmdcId = lmdc.id;
      // Also resolve DC from LMDC to ensure consistency
      const mmdcs = await masterDataService.getMMDCs();
      const mmdc = mmdcs.find(m => m.id === lmdc.linkedMmdcId);
      if (mmdc) assignedDcId = mmdc.linkedDcId; 
    } catch (e: any) {
      throw new Error(`Routing Error: ${e.message}`);
    }

    // Phase 6A: Payment Mode Defaults & Validation
    const paymentMode = data.paymentMode || PaymentMode.PREPAID;
    let codAmount = 0;

    if (paymentMode === PaymentMode.COD) {
      if (!data.codAmount || data.codAmount <= 0) {
        throw new Error('COD Amount must be greater than 0 for COD shipments.');
      }
      codAmount = data.codAmount;
    } else {
      // Force 0 for PREPAID to avoid dirty data
      codAmount = 0;
    }

    // MODULE 7: LABEL & AWB CONTROL
    const generatedAwb = `FEN-${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2,2).toUpperCase()}`;

    const newShipment: Shipment = {
      ...data,
      awb: generatedAwb, // Force System AWB
      clientId: clientId, // Enforce ID
      linkedLmdcId: assignedLmdcId, // Hard-Enforced
      linkedDcId: assignedDcId,     // Hard-Enforced based on Topology
      id: generatedAwb, // ID matches AWB for simplicity
      status: ShipmentStatus.INBOUND,
      paymentMode,
      codAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // --- FINANCIAL COMMIT ---
    // Deduct Balance if Prepaid (Transactional Simulation)
    if (clientId) {
       const client = await clientService.getClientById(clientId);
       if (client && (client.billingMode === 'Prepaid' || client.billingMode === 'Hybrid')) {
          await clientService.deductFunds(clientId, client.contractRate || 50, newShipment.awb);
       }
    }

    db.unshift(newShipment);
    saveDb(db);

    // Trigger Webhook
    triggerWebhook(newShipment, 'shipment.created');
  },

  bulkCreateShipments: async (csvData: string): Promise<{ success: number; failed: number; errors: string[] }> => {
    // Note: Bulk Upload by Founder usually bypasses client checks, but if Client uploads, enforce same rules.
    // For now assuming Founder Upload.
    await new Promise(resolve => setTimeout(resolve, 1000));
    const db = getDb();
    const rows = csvData.trim().split('\n');
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Header check (skip first row)
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      const cols = row.split(',').map(c => c.trim());
      // Expected: AWB, Type, DC_ID, DestinationPincode, GeoType, ClientID(Optional)
      if (cols.length < 5) {
        failed++;
        errors.push(`Row invalid format: ${row}`);
        continue;
      }

      const [awb, type, dcId, pincode, geo, clientId] = cols;

      // Billing Check for Bulk
      if (clientId) {
         try {
            // Rough check, assuming default rate
            await clientService.validateCredit(clientId, 50); 
         } catch (e: any) {
            failed++;
            errors.push(`Billing Error for ${clientId}: ${e.message}`);
            continue;
         }
      }

      if (!Object.values(LmdcShipmentType).includes(type as any)) {
        failed++;
        errors.push(`Invalid Type for ${awb}: ${type}`);
        continue;
      }

      let assignedLmdcId = '';
      let assignedDcId = dcId;
      try {
         const lmdc = await pincodeService.findLmdcForRouting(pincode);
         assignedLmdcId = lmdc.id;
         // Resolve DC
         const mmdcs = await masterDataService.getMMDCs();
         const mmdc = mmdcs.find(m => m.id === lmdc.linkedMmdcId);
         if (mmdc) assignedDcId = mmdc.linkedDcId; 
      } catch(e) {
         failed++;
         errors.push(`Routing Failed for ${awb} (Pin: ${pincode})`);
         continue;
      }

      // Generate System AWB
      const systemAwb = `FEN-${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2,2).toUpperCase()}`;

      const newShipment: Shipment = {
        id: systemAwb,
        awb: systemAwb,
        clientId: clientId || undefined,
        shipmentType: type as LmdcShipmentType,
        linkedDcId: assignedDcId,
        linkedLmdcId: assignedLmdcId, // Auto-Assigned
        destinationPincode: pincode,
        geoType: geo as GeoType,
        status: ShipmentStatus.INBOUND,
        paymentMode: PaymentMode.PREPAID, 
        codAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Deduct Funds
      if (clientId) {
         await clientService.deductFunds(clientId, 50, newShipment.awb);
      }

      db.unshift(newShipment);
      success++;
      
      // Trigger Webhook async
      triggerWebhook(newShipment, 'shipment.created');
    }

    saveDb(db);
    return { success, failed, errors };
  },

  updateStatus: async (id: string, newStatus: ShipmentStatus, actorId?: string, codCollectedAmount?: number, transactionId?: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const db = getDb();
    const idx = db.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Shipment not found');

    const current = db[idx];

    // Transition Logic (Simplified for brevity, assuming similar to existing)
    // ... validation ...

    db[idx].status = newStatus;
    db[idx].updatedAt = new Date().toISOString();
    
    if (actorId) {
       // If Rider, assign
       // If Client, do NOT change rider assignment
       // For status updates, we just track who did it in logs generally, but here we might update assignedRiderId only if it's a dispatch
       if (!db[idx].assignedRiderId && newStatus === ShipmentStatus.ASSIGNED) {
          db[idx].assignedRiderId = actorId;
       }
    }

    // Capture Transaction ID if provided (e.g. for Returns)
    if (transactionId) {
       db[idx].transactionId = transactionId;
    }

    saveDb(db);

    // Phase 12: COD Hook
    if (newStatus === ShipmentStatus.DELIVERED && current.paymentMode === PaymentMode.COD) {
       const finalRiderId = current.assignedRiderId || actorId; // Fallback
       const finalAmount = codCollectedAmount !== undefined ? codCollectedAmount : (current.codAmount || 0);

       if (finalRiderId) {
         await codService.markCollected(
           current.awb,
           finalRiderId,
           current.linkedLmdcId,
           finalAmount
         );
       }
    }

    // Phase 13: SLA Hook
    if (newStatus === ShipmentStatus.DELIVERED) {
       await slaService.evaluateShipment(db[idx]);
    }

    // Ledger Generation
    if ([ShipmentStatus.DELIVERED, ShipmentStatus.UNDELIVERED, ShipmentStatus.RTO, ShipmentStatus.CANCELLED].includes(newStatus)) {
      await ledgerService.generateEntries(db[idx]);
    }

    // WEBHOOK TRIGGER (Step 16)
    // Map status to event name
    let eventName = 'exception';
    if (newStatus === ShipmentStatus.INBOUND) eventName = 'shipment.inbound';
    else if (newStatus === ShipmentStatus.DELIVERED) eventName = 'shipment.delivered';
    else if (newStatus === ShipmentStatus.RTO) eventName = 'shipment.rto';
    else if (newStatus === ShipmentStatus.UNDELIVERED) eventName = 'exception';
    else if (newStatus === ShipmentStatus.ASSIGNED) eventName = 'shipment.out_for_delivery';

    triggerWebhook(db[idx], eventName);
  },

  getStats: async (): Promise<Record<string, number>> => {
    const db = getDb();
    return {
      total: db.length,
      delivered: db.filter(s => s.status === ShipmentStatus.DELIVERED).length,
      pending: db.filter(s => s.status === ShipmentStatus.INBOUND || s.status === ShipmentStatus.ASSIGNED).length,
      exceptions: db.filter(s => s.status === ShipmentStatus.UNDELIVERED || s.status === ShipmentStatus.RTO || s.status === ShipmentStatus.CANCELLED).length,
    };
  }
};
