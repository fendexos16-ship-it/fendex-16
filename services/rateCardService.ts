
import { 
  LmdcRateCard, 
  RiderRateCard, 
  GeoType, 
  LmdcShipmentType, 
  RiderJobType, 
  ShipmentStatus, 
  RateCalculationResult,
  ClientRateCard,
  FeeType,
  FeeCalculationResult,
  PaymentMode,
  User,
  UserRole,
  Runsheet,
  Shipment
} from '../types';
import { complianceService } from './complianceService';
import { authService } from './authService';

// Mock Storage
const LMDC_RATES_KEY = 'fendex_lmdc_rates';
const RIDER_RATES_KEY = 'fendex_rider_rates';
const CLIENT_RATES_KEY = 'fendex_client_rates_db';

const getLmdcRatesDb = (): LmdcRateCard[] => {
  const stored = localStorage.getItem(LMDC_RATES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveLmdcRatesDb = (rates: LmdcRateCard[]) => {
  localStorage.setItem(LMDC_RATES_KEY, JSON.stringify(rates));
};

const getRiderRatesDb = (): RiderRateCard[] => {
  const stored = localStorage.getItem(RIDER_RATES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveRiderRatesDb = (rates: RiderRateCard[]) => {
  localStorage.setItem(RIDER_RATES_KEY, JSON.stringify(rates));
};

const getClientRatesDb = (): ClientRateCard[] => {
  const stored = localStorage.getItem(CLIENT_RATES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveClientRatesDb = (rates: ClientRateCard[]) => {
  localStorage.setItem(CLIENT_RATES_KEY, JSON.stringify(rates));
};

export const rateCardService = {
  // --- LMDC Rates ---
  getLmdcRates: async (): Promise<LmdcRateCard[]> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return getLmdcRatesDb();
  },

  saveLmdcRate: async (rate: LmdcRateCard): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const rates = getLmdcRatesDb();
    if (rate.id) {
      const index = rates.findIndex(r => r.id === rate.id);
      if (index !== -1) rates[index] = rate;
    } else {
      rate.id = 'LRC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      rates.push(rate);
    }
    saveLmdcRatesDb(rates);
  },

  // --- Rider Rates ---
  getRiderRates: async (): Promise<RiderRateCard[]> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return getRiderRatesDb();
  },

  saveRiderRate: async (rate: RiderRateCard): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const rates = getRiderRatesDb();
    if (rate.id) {
      const index = rates.findIndex(r => r.id === rate.id);
      if (index !== -1) rates[index] = rate;
    } else {
      rate.id = 'RRC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      rates.push(rate);
    }
    saveRiderRatesDb(rates);
  },

  // --- Client Rate Cards (NEW) ---
  getClientRates: async (user: User): Promise<ClientRateCard[]> => {
    // Permission check
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN && user.role !== UserRole.CLIENT_VIEW) {
       throw new Error('Access Denied');
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    const all = getClientRatesDb();
    
    // Client view filter
    if (user.role === UserRole.CLIENT_VIEW) {
       return all.filter(c => c.clientId === user.linkedEntityId && c.status === 'ACTIVE');
    }
    
    return all;
  },

  saveClientRateCard: async (user: User, rateCard: ClientRateCard): Promise<void> => {
    authService.requireRole(user, UserRole.FOUNDER); // Only Founder can edit commercials
    
    const db = getClientRatesDb();
    let newCard = { ...rateCard };

    // Basic Validation
    if (!newCard.clientId || !newCard.effectiveDate) throw new Error("Missing required fields");

    if (newCard.id) {
       const idx = db.findIndex(c => c.id === newCard.id);
       if (idx !== -1) db[idx] = newCard;
    } else {
       newCard.id = `CRC-${Date.now()}`;
       newCard.createdAt = new Date().toISOString();
       newCard.createdBy = user.id;
       db.push(newCard);
    }

    saveClientRatesDb(db);
    
    await complianceService.logEvent(
       'RATE_CARD_OP', 
       user, 
       `Saved Client Rate Card for ${newCard.clientId}`, 
       { cardId: newCard.id, status: newCard.status }
    );
  },

  // --- FEE CALCULATION ENGINE ---
  calculateClientFees: async (params: {
    clientId: string;
    shipmentType: LmdcShipmentType;
    geoType: GeoType;
    status: ShipmentStatus;
    paymentMode: PaymentMode;
    codAmount: number;
    date: string; // Shipment update date (delivery date)
  }): Promise<FeeCalculationResult> => {
    
    const db = getClientRatesDb();
    
    // 1. Find Active Rate Card
    const card = db.find(c => 
       c.clientId === params.clientId && 
       c.status === 'ACTIVE' && 
       params.date >= c.effectiveDate && 
       (!c.expiryDate || params.date <= c.expiryDate)
    );

    // Default zero fees if no card found
    const result: FeeCalculationResult = {
       freightAmount: 0,
       codFee: 0,
       rtoFee: 0,
       platformFee: 0,
       totalDeductions: 0,
       appliedRateCardId: card?.id
    };

    if (!card) return result;

    // 2. Find Rule
    const rule = card.rules.find(r => r.geoType === params.geoType && r.shipmentType === params.shipmentType);
    
    if (!rule) return result;

    // 3. Calculate Freight
    result.freightAmount = rule.baseRate;

    // 4. Calculate COD Fee
    if (params.paymentMode === PaymentMode.COD && params.status === ShipmentStatus.DELIVERED) {
       if (rule.codFeeType === FeeType.PERCENTAGE) {
          result.codFee = (params.codAmount * rule.codFeeValue) / 100;
       } else {
          result.codFee = rule.codFeeValue;
       }
    }

    // 5. Calculate RTO Fee
    if (params.status === ShipmentStatus.RTO) {
       result.rtoFee = rule.rtoRate;
       result.codFee = 0; 
    }

    // 6. Platform Fee
    result.platformFee = 0;

    // Total
    result.totalDeductions = result.freightAmount + result.codFee + result.rtoFee + result.platformFee;

    return result;
  },

  // --- Runsheet Payout Calculator (One Runsheet = One Record) ---
  calculateRunsheetTotal: async (runsheet: Runsheet, shipments: Shipment[]): Promise<number> => {
     let totalAmount = 0;
     
     // Only process shipments belonging to this runsheet
     const targetShipments = shipments.filter(s => runsheet.shipmentIds.includes(s.id));
     
     for (const shipment of targetShipments) {
        // Only DELIVERED gets paid usually, or RTO depending on policy.
        // UNDELIVERED usually 0.
        // Assuming RTO is paid at reduced rate or 0.
        // Let's use calculatePreview for individual items and sum up.
        
        let jobType = RiderJobType.DELIVERY;
        if (runsheet.type === 'RVP') jobType = RiderJobType.REVERSE_PICKUP;
        if (runsheet.type === 'FM') jobType = RiderJobType.PICKUP;

        const rate = await rateCardService.calculatePreview({
           dcId: '', // Ideally needed but calculatePreview can fallback
           lmdcId: runsheet.lmdcId,
           role: 'RIDER',
           geoType: shipment.geoType,
           type: jobType,
           status: shipment.status,
           // We pass shipment directly for context if needed later
        });
        
        totalAmount += rate.amount;
     }
     
     return totalAmount;
  },

  // --- Internal Calc Engine (Existing) ---
  calculatePreview: async (params: {
    dcId?: string; // Optional now for flexibility
    lmdcId: string;
    clientId?: string; 
    role: 'LMDC' | 'RIDER';
    geoType: GeoType;
    type: string; 
    status: ShipmentStatus;
  }): Promise<RateCalculationResult> => {
    // Rule 1: RTO / Undelivered Logic for Rider
    // If Rider and Undelivered -> 0. 
    // If Rider and RTO -> usually 0 unless specific policy.
    
    if (params.role === 'RIDER') {
       if (params.status === ShipmentStatus.UNDELIVERED) return { amount: 0, reason: 'Undelivered (Zero Payout)' };
       if (params.status === ShipmentStatus.RTO) return { amount: 0, reason: 'RTO (Zero Payout)' };
       if (params.status !== ShipmentStatus.DELIVERED && params.status !== ShipmentStatus.RVP_PICKED) {
          // Assuming FM picked is different status, currently FM uses 'PICKED' in PickupRequest not Shipment.
          // For FWD/RVP:
          return { amount: 0, reason: `Status ${params.status} not payable` };
       }
    } else {
       // LMDC Logic
       if (params.status === ShipmentStatus.RTO) return { amount: 0, reason: 'RTO Policy Applied (Zero Payout)' };
       if (params.status === ShipmentStatus.UNDELIVERED) return { amount: 0, reason: 'Shipment Undelivered (Held)' };
    }

    // Lookup logic
    if (params.role === 'LMDC') {
      const rates = getLmdcRatesDb();
      
      const matches = rates.filter(r => 
        r.status === 'Active' &&
        (!r.linkedDcId || r.linkedDcId === params.dcId) && // Loose match if dcId missing
        r.geoType === params.geoType &&
        r.shipmentType === params.type
      );

      // 1. Client + LMDC
      if (params.clientId && params.lmdcId) {
        const match = matches.find(r => r.clientId === params.clientId && r.linkedLmdcId === params.lmdcId);
        if (match) return { amount: Number(match.amount), reason: `Applied Client (${params.clientId}) specific rate for LMDC`, appliedRateId: match.id };
      }

      // 2. Client + General DC
      if (params.clientId) {
        const match = matches.find(r => r.clientId === params.clientId && !r.linkedLmdcId);
        if (match) return { amount: Number(match.amount), reason: `Applied Client (${params.clientId}) specific base rate`, appliedRateId: match.id };
      }

      // 3. Specific LMDC (Generic)
      if (params.lmdcId) {
        const match = matches.find(r => !r.clientId && r.linkedLmdcId === params.lmdcId);
        if (match) return { amount: Number(match.amount), reason: `Applied Specific LMDC Rate: ${match.name}`, appliedRateId: match.id };
      }

      // 4. General DC (Generic)
      const general = matches.find(r => !r.clientId && !r.linkedLmdcId);
      if (general) {
        return { amount: Number(general.amount), reason: `Applied General DC Rate: ${general.name}`, appliedRateId: general.id };
      }

      return { amount: 0, reason: 'No matching active LMDC rate card found' };

    } else {
      // Rider Logic
      const rates = getRiderRatesDb();
      
      const matches = rates.filter(r => 
        r.status === 'Active' &&
        (!r.linkedDcId || r.linkedDcId === params.dcId) &&
        r.geoType === params.geoType &&
        r.jobType === params.type
      );

      // 1. Specific LMDC Scope
      if (params.lmdcId) {
        const match = matches.find(r => r.linkedLmdcId === params.lmdcId);
        if (match) return { amount: Number(match.amount), reason: `Applied Specific Rider Rate: ${match.name}`, appliedRateId: match.id };
      }

      // 2. General DC
      const general = matches.find(r => !r.linkedLmdcId);
      if (general) {
        return { amount: Number(general.amount), reason: `Applied General DC Rider Rate: ${general.name}`, appliedRateId: general.id };
      }

      return { amount: 0, reason: 'No matching active Rider rate card found' };
    }
  }
};
