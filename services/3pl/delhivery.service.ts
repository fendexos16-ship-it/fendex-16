
import { Client, ShipmentStatus } from '../../types';
import { shipmentService } from '../shipmentService';

export const delhiveryService = {
  
  // Handle Incoming Webhook
  handleWebhook: async (client: Client, payload: any) => {
    // 1. Signature Verification (Simulated)
    // In real code: crypto.createHmac...
    if (!payload.signature) throw new Error('Missing Signature');
    
    console.log(`[DELHIVERY] Webhook received for ${client.name}`, payload);

    // 2. Map Status
    // Delhivery Status -> Fendex Status
    const statusMap: Record<string, ShipmentStatus> = {
       'In Transit': ShipmentStatus.INBOUND,
       'Out for Delivery': ShipmentStatus.ASSIGNED,
       'Delivered': ShipmentStatus.DELIVERED,
       'RTO': ShipmentStatus.RTO
    };

    const newStatus = statusMap[payload.status];
    if (!newStatus) throw new Error(`Unknown Status: ${payload.status}`);

    // 3. Update Fendex
    // Search for shipment by AWB (Assuming payload has ref_awb or similar)
    // If we pushed to Delhivery, we likely stored their AWB or mapped ours.
    // For simulation, assume payload.awb matches our ID.
    
    // Note: shipmentService.updateStatus requires an Actor ID. 
    // We use a system bot ID for courier updates.
    await shipmentService.updateStatus(
       payload.awb, 
       newStatus, 
       'COURIER_BOT', 
       payload.cod_amount // Only relevant if delivered
    );

    return { processed: true, status: newStatus };
  },

  // Push Order to Delhivery (Outbound)
  pushOrder: async (client: Client, shipmentData: any) => {
     console.log(`[DELHIVERY] Pushing Order ${shipmentData.awb}`);
     // Simulate API
     return { 
        tracking_id: `DEL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        estimated_delivery: new Date(Date.now() + 86400000).toISOString()
     };
  }
};
