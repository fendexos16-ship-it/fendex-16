
import { City, CityStatus, CityOpsConfig, User, UserRole } from '../types';
import { complianceService } from './complianceService';
import { masterDataService } from './masterDataService';
import { authService } from './authService';

const CITIES_KEY = 'fendex_cities_db';

const getCitiesDb = (): City[] => {
  const stored = localStorage.getItem(CITIES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveCitiesDb = (data: City[]) => {
  localStorage.setItem(CITIES_KEY, JSON.stringify(data));
};

const DEFAULT_OPS_CONFIG: CityOpsConfig = {
  enableFm: false,
  enableRvp: false,
  enableCod: false,
  enableAggregators: false,
  enableEnterprise: false
};

export const cityService = {
  
  getAllCities: async (): Promise<City[]> => {
    await new Promise(r => setTimeout(r, 200));
    return getCitiesDb();
  },

  getCityById: async (id: string): Promise<City | undefined> => {
    const db = getCitiesDb();
    return db.find(c => c.id === id);
  },

  // 1. CREATE (Start as PLANNED)
  createCity: async (user: User, data: { name: string, code: string, state: string, region: string }): Promise<City> => {
    authService.requireRole(user, UserRole.FOUNDER);
    
    const db = getCitiesDb();
    if (db.some(c => c.code === data.code)) throw new Error(`City Code ${data.code} already exists.`);

    const newCity: City = {
      id: `CTY-${Date.now()}`,
      ...data,
      status: CityStatus.PLANNED,
      opsConfig: DEFAULT_OPS_CONFIG,
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };

    db.push(newCity);
    saveCitiesDb(db);

    await complianceService.logEvent('CITY_OP', user, `Created City ${data.name} (${data.code})`, { status: CityStatus.PLANNED });
    return newCity;
  },

  // 2. CONFIG UPDATE (Ops Switches, MMDC Link)
  updateConfig: async (user: User, cityId: string, updates: Partial<City>): Promise<void> => {
    authService.requireRole(user, UserRole.FOUNDER);
    
    const db = getCitiesDb();
    const idx = db.findIndex(c => c.id === cityId);
    if (idx === -1) throw new Error('City not found');

    // Prevent code change
    if (updates.code && updates.code !== db[idx].code) throw new Error('City Code cannot be changed');

    const oldConfig = { ...db[idx] };
    const updatedCity = { ...db[idx], ...updates };
    
    db[idx] = updatedCity;
    saveCitiesDb(db);

    await complianceService.logEvent(
       'CITY_OP', 
       user, 
       `Updated Config for ${updatedCity.name}`, 
       { changes: Object.keys(updates) }
    );
  },

  // 3. GO-LIVE (Strict Checklist)
  activateCity: async (user: User, cityId: string): Promise<void> => {
    authService.requireRole(user, UserRole.FOUNDER);
    
    const db = getCitiesDb();
    const idx = db.findIndex(c => c.id === cityId);
    if (idx === -1) throw new Error('City not found');
    const city = db[idx];

    // CHECKLIST
    const errors = [];
    
    // 1. MMDC Linked
    if (!city.primaryMmdcId) errors.push("Primary Hub (MMDC) not linked.");
    
    // 2. Active LMDC Existence
    const lmdcs = await masterDataService.getLMDCs();
    const cityLmdcs = lmdcs.filter(l => l.linkedCityId === city.id && l.status === 'Active');
    if (cityLmdcs.length === 0) errors.push("No Active LMDC mapped to this City.");

    if (errors.length > 0) {
       throw new Error(`GO-LIVE BLOCKED:\n- ${errors.join('\n- ')}`);
    }

    city.status = CityStatus.LIVE;
    city.goLiveAt = new Date().toISOString();
    city.approvedBy = user.id;
    
    saveCitiesDb(db);
    
    await complianceService.logEvent('CITY_LIFECYCLE', user, `ACTIVATED CITY: ${city.name} (${city.code})`, { lmdcs: cityLmdcs.length });
  },

  // 4. PAUSE (Emergency Stop)
  pauseCity: async (user: User, cityId: string, reason: string): Promise<void> => {
    authService.requireRole(user, UserRole.FOUNDER);
    
    const db = getCitiesDb();
    const idx = db.findIndex(c => c.id === cityId);
    if (idx === -1) throw new Error('City not found');
    
    const city = db[idx];
    city.status = CityStatus.PAUSED;
    
    saveCitiesDb(db);
    
    await complianceService.logEvent('CITY_LIFECYCLE', user, `PAUSED CITY: ${city.name}`, { reason });
  }
};
