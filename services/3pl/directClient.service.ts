
import { Client } from '../../types';
import { shipmentService } from '../shipmentService';

export const directClientService = {
  
  createShipment: async (client: Client, payload: any) => {
    // 1. Validation
    if (!payload.destinationPincode) throw new Error('Missing Pincode');
    
    // 2. Block Routing Attempts
    if (payload.lmdcId || payload.dcId) {
       console.warn(`[SECURITY] Client ${client.name} attempted to set routing. Blocked.`);
       delete payload.lmdcId;
       delete payload.dcId;
    }

    // 3. Normalize
    const shipment = {
       ...payload,
       clientId: client.id,
       status: 'Inbound', // Force start status
       // Auto-generate AWB if not provided, or validate theirs
       awb: payload.awb || `FDX-${Date.now()}`
    };

    // 4. Execute Core Logic
    // createShipment inside shipmentService handles the Routing Engine logic (Pincode -> LMDC)
    await shipmentService.createShipment(shipment, { role: 'CLIENT_API', id: client.id, linkedEntityId: client.id } as any);

    return { awb: shipment.awb, status: 'ACCEPTED' };
  }
};
