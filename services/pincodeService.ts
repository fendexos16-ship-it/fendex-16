import { PincodeMaster, ZoneType, LastMileDC } from '../types';
import { masterDataService } from './masterDataService';

const PINCODE_KEY = 'fendex_pincode_db';

const getDb = (): PincodeMaster[] => {
  const stored = localStorage.getItem(PINCODE_KEY);
  if (stored) return JSON.parse(stored);
  
  // Default Seed Data
  return [
    { pincode: '110001', city: 'New Delhi', state: 'Delhi', zone: ZoneType.METRO, serviceable: true, linkedLmdcId: '1' }, // Mapped to LM001
    { pincode: '400050', city: 'Mumbai', state: 'Maharashtra', zone: ZoneType.METRO, serviceable: true, linkedLmdcId: '2' }, // Mapped to LM002
    { pincode: '560001', city: 'Bangalore', state: 'Karnataka', zone: ZoneType.METRO, serviceable: false }, // Unserviceable
  ];
};

const saveDb = (data: PincodeMaster[]) => {
  localStorage.setItem(PINCODE_KEY, JSON.stringify(data));
};

export const pincodeService = {
  getAll: async (): Promise<PincodeMaster[]> => {
    await new Promise(r => setTimeout(r, 200));
    return getDb();
  },

  create: async (data: PincodeMaster): Promise<void> => {
    const db = getDb();
    if (db.some(p => p.pincode === data.pincode)) {
      throw new Error(`Pincode ${data.pincode} already exists`);
    }
    db.push(data);
    saveDb(db);
  },

  update: async (data: PincodeMaster): Promise<void> => {
    const db = getDb();
    const idx = db.findIndex(p => p.pincode === data.pincode);
    if (idx === -1) throw new Error('Pincode not found');
    db[idx] = data;
    saveDb(db);
  },

  // Map LMDC to Pincode (Strict One-to-One for Active)
  assignLmdc: async (pincode: string, lmdcId: string): Promise<void> => {
    const db = getDb();
    const idx = db.findIndex(p => p.pincode === pincode);
    if (idx === -1) throw new Error('Pincode not found');
    
    // Check if serviceable. If assigning, assume we want it serviceable.
    db[idx].linkedLmdcId = lmdcId;
    db[idx].serviceable = true;
    saveDb(db);
  },

  // Find assigned LMDC for routing
  findLmdcForRouting: async (pincode: string): Promise<LastMileDC> => {
    await new Promise(r => setTimeout(r, 100)); // Latency
    const db = getDb();
    const mapping = db.find(p => p.pincode === pincode);
    
    if (!mapping) throw new Error(`Pincode ${pincode} is not defined in Master.`);
    if (!mapping.serviceable) throw new Error(`Pincode ${pincode} is marked Unserviceable.`);
    if (!mapping.linkedLmdcId) throw new Error(`No LMDC assigned to Pincode ${pincode}. Routing failed.`);

    const lmdcs = await masterDataService.getLMDCs();
    const lmdc = lmdcs.find(l => l.id === mapping.linkedLmdcId);
    
    if (!lmdc || lmdc.status !== 'Active') throw new Error(`Assigned LMDC for ${pincode} is Inactive or Missing.`);
    
    return lmdc;
  }
};
