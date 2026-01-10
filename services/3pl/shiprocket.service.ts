
import { Client } from '../../types';
import { shipmentService } from '../shipmentService';

// Mock Shiprocket Response
const MOCK_ORDERS = [
  { id: 101, customer_name: 'Rahul', address: 'Connaught Place', city: 'Delhi', pincode: '110001', payment_method: 'Prepaid', total: 500 },
  { id: 102, customer_name: 'Priya', address: 'Andheri West', city: 'Mumbai', pincode: '400050', payment_method: 'COD', total: 1200 }
];

export const shiprocketService = {
  
  pullOrders: async (client: Client) => {
    // 1. Auth with Shiprocket (Mock)
    if (!client.credentials?.apiKey) throw new Error('Missing Credentials');
    
    console.log(`[SHIPROCKET] Pulling orders for ${client.name}...`);
    
    // Simulate Network Call
    await new Promise(r => setTimeout(r, 800));
    
    // 2. Normalize Data to Fendex Schema
    const normalized = MOCK_ORDERS.map(order => ({
      awb: `SR-${order.id}-${Date.now()}`,
      destinationPincode: order.pincode,
      customerName: order.customer_name,
      customerAddress: order.address,
      paymentMode: order.payment_method.toUpperCase(),
      codAmount: order.payment_method === 'COD' ? order.total : 0,
      shipmentType: 'Delivery', // Default
      geoType: 'City', // Logic to determine geo based on pincode would be here
      clientId: client.id
    }));

    // 3. Inject into Fendex Core
    // We use shipmentService.createShipment which handles Routing Lock automatically.
    // We do NOT let Shiprocket decide LMDC.
    let successCount = 0;
    
    for (const order of normalized) {
       try {
          // Fendex System User acts as the importer
          await shipmentService.createShipment(order as any, { role: 'FOUNDER', id: 'SYSTEM', name: 'System' } as any);
          successCount++;
       } catch (e) {
          console.error(`[SHIPROCKET] Import Failed for ${order.awb}`, e);
       }
    }

    return { pulled: MOCK_ORDERS.length, created: successCount };
  }
};
