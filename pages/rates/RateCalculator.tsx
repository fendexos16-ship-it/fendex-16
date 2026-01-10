import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { masterDataService } from '../../services/masterDataService';
import { rateCardService } from '../../services/rateCardService';
import { 
  DistributionCenter, 
  LastMileDC, 
  UserRole, 
  GeoType, 
  LmdcShipmentType,
  RiderJobType,
  ShipmentStatus,
  RateCalculationResult
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Calculator, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

export const RateCalculator: React.FC = () => {
  const { user } = useAuth();
  
  // Data for Selects
  const [dcs, setDcs] = useState<DistributionCenter[]>([]);
  const [lmdcs, setLmdcs] = useState<LastMileDC[]>([]);
  const [availableLmdcs, setAvailableLmdcs] = useState<LastMileDC[]>([]);

  // Form State
  const [selectedRole, setSelectedRole] = useState<'LMDC' | 'RIDER'>('LMDC');
  const [dcId, setDcId] = useState('');
  const [lmdcId, setLmdcId] = useState('');
  const [geoType, setGeoType] = useState<GeoType>(GeoType.CITY);
  const [shipmentType, setShipmentType] = useState<string>(LmdcShipmentType.DELIVERY);
  const [status, setStatus] = useState<ShipmentStatus>(ShipmentStatus.DELIVERED);

  // Result State
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<RateCalculationResult | null>(null);

  // Security Check
  if (user?.role !== UserRole.FOUNDER) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    const loadData = async () => {
      const [dcData, lmdcData] = await Promise.all([
        masterDataService.getDCs(),
        masterDataService.getLMDCs()
      ]);
      setDcs(dcData);
      setLmdcs(lmdcData);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (dcId) {
      setAvailableLmdcs(lmdcs.filter(l => l.linkedDcId === dcId));
    } else {
      setAvailableLmdcs([]);
    }
    setLmdcId(''); // Reset LMDC when DC changes
  }, [dcId, lmdcs]);

  // Reset shipment type when role changes to ensure valid enum
  useEffect(() => {
    if (selectedRole === 'LMDC') {
      setShipmentType(LmdcShipmentType.DELIVERY);
    } else {
      setShipmentType(RiderJobType.DELIVERY);
    }
    setResult(null);
  }, [selectedRole]);

  const handleCalculate = async () => {
    if (!dcId) return;
    
    setIsCalculating(true);
    setResult(null);

    const calcResult = await rateCardService.calculatePreview({
      dcId,
      lmdcId,
      role: selectedRole,
      geoType,
      type: shipmentType,
      status
    });

    setResult(calcResult);
    setIsCalculating(false);
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Rate Calculator Preview</h1>
        <p className="text-sm text-gray-500 mt-1">Simulate payout logic without executing payments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Panel */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <div className="bg-brand-100 p-2 rounded-lg mr-3">
              <Calculator className="h-5 w-5 text-brand-600" />
            </div>
            Simulation Parameters
          </h3>

          <div className="space-y-6">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Target Role</label>
              <div className="flex space-x-4">
                <button
                  onClick={() => setSelectedRole('LMDC')}
                  className={`flex-1 py-3 px-4 border rounded-lg text-sm font-medium transition-all ${
                    selectedRole === 'LMDC' 
                      ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' 
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  LMDC Partner
                </button>
                <button
                  onClick={() => setSelectedRole('RIDER')}
                  className={`flex-1 py-3 px-4 border rounded-lg text-sm font-medium transition-all ${
                    selectedRole === 'RIDER' 
                      ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' 
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Rider Fleet
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Distribution Center</label>
                <select
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                  value={dcId}
                  onChange={(e) => setDcId(e.target.value)}
                >
                  <option value="">Select DC...</option>
                  {dcs.map(dc => (
                    <option key={dc.id} value={dc.id}>{dc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Mile DC (Optional)</label>
                <select
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                  value={lmdcId}
                  onChange={(e) => setLmdcId(e.target.value)}
                  disabled={!dcId}
                >
                  <option value="">Specific LMDC...</option>
                  {availableLmdcs.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Geography</label>
                <select
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                  value={geoType}
                  onChange={(e) => setGeoType(e.target.value as GeoType)}
                >
                  {Object.values(GeoType).map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {selectedRole === 'LMDC' ? 'Shipment Type' : 'Job Type'}
                </label>
                <select
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                  value={shipmentType}
                  onChange={(e) => setShipmentType(e.target.value)}
                >
                  {selectedRole === 'LMDC' 
                    ? Object.values(LmdcShipmentType).map(t => <option key={t} value={t}>{t}</option>)
                    : Object.values(RiderJobType).map(t => <option key={t} value={t}>{t}</option>)
                  }
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Shipment Outcome</label>
                <select
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
                >
                  {Object.values(ShipmentStatus).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Note: RTO and Undelivered statuses trigger zero payout logic.
                </p>
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={handleCalculate} isLoading={isCalculating} disabled={!dcId}>
                Calculate Payout
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Result Panel */}
        <div className="lg:col-span-1">
          <div className={`h-full bg-white rounded-lg border shadow-sm p-6 flex flex-col items-center justify-center text-center transition-all ${result ? 'border-brand-200 bg-brand-50' : 'border-gray-200'}`}>
            {!result ? (
              <>
                <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Calculator className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="text-gray-900 font-medium">No Calculation Yet</h4>
                <p className="text-sm text-gray-500 mt-1">Enter parameters and hit Calculate to see the preview.</p>
              </>
            ) : (
              <>
                <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 ${result.amount > 0 ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {result.amount > 0 ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-gray-500" />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Calculated Payout</p>
                <h2 className="text-4xl font-bold text-gray-900 mt-2">₹{result.amount}</h2>
                <div className="mt-6 w-full bg-white rounded border border-gray-200 p-4 text-left">
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Logic Applied</p>
                  <p className="text-sm text-gray-700">{result.reason}</p>
                  {result.appliedRateId && (
                    <p className="text-xs text-gray-400 mt-2 font-mono">ID: {result.appliedRateId}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};