
import { FMPickup, FmStatus, User, UserRole, LmdcShipmentType, GeoType, PaymentMode, ShipmentStatus } from '../types';
import { complianceService } from './complianceService';
import { shipmentService } from './shipmentService';

const FM_DB_KEY = 'fendex_fm_db_v1';
const getFmDb = (): FMPickup[] => JSON.parse(localStorage.getItem(FM_DB_KEY) || '[]');
const saveFmDb = (db: FMPickup[]) => localStorage.setItem(FM_DB_KEY, JSON.stringify(db));

const getTodayIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset).toISOString().split('T')[0];
};

export const fmService = {
  // ... (Other methods remain unchanged as per Master Rule)

  /**
   * FM CLOSE - HANDOVER PROTOCOL
   * 1️⃣ Explicitly marks shipment for DRS eligibility.
   * ❌ Immutable after closure.
   */
  closeFmPickup: async (actor: User, fmId: string): Promise<void> => {
    const db = getFmDb();
    const idx = db.findIndex(fm => fm.fm_id === fmId);
    if (idx === -1) throw new Error('FM record missing.');
    
    const fm = db[idx];
    
    // IMMUTABILITY GUARANTEE
    if (fm.status === FmStatus.CLOSED) {
      throw new Error("IMMUTABILITY VIOLATION: FM Pickup is already closed and locked.");
    }
    
    if (fm.status !== FmStatus.INBOUND_RECEIVED_LMDC) {
      throw new Error('Verification required before closing FM cycle.');
    }

    // 1. UPDATE FM STATE
    fm.status = FmStatus.CLOSED;
    db[idx] = fm;
    saveFmDb(db);

    // 2. BIRTH/UPDATE SHIPMENT WITH DRS ELIGIBILITY
    // REQUIRED STATE CHANGE: status = FM_CLOSED, eligible_for_drs = true
    await shipmentService.createShipment({
      awb: fm.awb,
      linkedDcId: '', 
      destinationPincode: '000000', 
      shipmentType: LmdcShipmentType.DELIVERY,
      geoType: GeoType.CITY,
      paymentMode: PaymentMode.PREPAID,
      codAmount: 0,
      status: ShipmentStatus.FM_CLOSED, // Final FM status
      eligible_for_drs: true,           // ENABLES DRS ACCESS
    } as any, actor);

    await complianceService.logEvent('FM_CLOSED', actor, `FM Cycle Closed: ${fm.fm_id}`, { 
      awb: fm.awb, 
      drs_enabled: true 
    });
  }
};
