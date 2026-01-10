
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { tripService } from '../../services/tripService';
import { bagService } from '../../services/bagService';
import { useAuth } from '../../context/AuthContext';
import { Trip, TripStatus, Bag, BagStatus, TripSource, ExceptionType } from '../../types';
import { Truck, Lock, Scan, CheckCircle, AlertOctagon, Info, ArrowRight, ShieldCheck, Box, AlertTriangle } from 'lucide-react';

export const MMDCInbound: React.FC = () => {
  const { user } = useAuth();
  const [inboundTrips, setInboundTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  
  // Validation State
  const [bagScan, setBagScan] = useState('');
  const [sealScan, setSealScan] = useState('');
  const [scannedBags, setScannedBags] = useState<Bag[]>([]);
  const [error, setError] = useState('');

  // Exception State
  const [showException, setShowException] = useState(false);
  const [exceptionBag, setExceptionBag] = useState<string>(''); // Bag ID
  const [exceptionType, setExceptionType] = useState<ExceptionType>(ExceptionType.SHORTAGE);
  const [exceptionDesc, setExceptionDesc] = useState('');

  const currentMmdcId = user?.linkedEntityId || 'M1';

  useEffect(() => {
    loadTrips();
  }, [user]);

  const loadTrips = async () => {
    const all = await tripService.getTrips(currentMmdcId);
    // Filter for Trips destined here
    setInboundTrips(all.filter(t => 
       t.destinationEntityId === currentMmdcId && 
       (t.status === TripStatus.IN_TRANSIT || t.status === TripStatus.ARRIVED || t.status === TripStatus.UNLOADING)
    ));
  };

  const handleArrive = async (trip: Trip) => {
     if (trip.status === TripStatus.IN_TRANSIT) {
        if (!confirm(`Confirm Vehicle Arrival for ${trip.tripCode}?`)) return;
        try {
           await tripService.markArrived(user!, trip.id);
           loadTrips();
        } catch(e:any) { alert(e.message); }
     } else {
        setActiveTrip(trip);
        // Pre-load verified bags (status check)
        const bags = await bagService.getBags(currentMmdcId);
        // We consider 'verified' if they are linked to this trip and status is INBOUND_RECEIVED or EXCEPTION marked
        const processed = bags.filter(b => 
           trip.bagIds.includes(b.id) && 
           (b.status === BagStatus.INBOUND_RECEIVED || b.status === BagStatus.SHORTAGE_MARKED || b.status === BagStatus.DAMAGE_MARKED)
        );
        setScannedBags(processed);
     }
  };

  const handleStartUnloading = async () => {
     if (!activeTrip) return;
     if (activeTrip.status !== TripStatus.ARRIVED) return;
     try {
        await tripService.startUnloading(user!, activeTrip.id);
        const updatedTrips = await tripService.getTrips(currentMmdcId);
        setActiveTrip(updatedTrips.find(t => t.id === activeTrip.id) || null);
        loadTrips();
     } catch(e:any) { alert(e.message); }
  };

  const handleVerifyBag = async (e: React.FormEvent) => {
     e.preventDefault();
     setError('');
     if (!activeTrip) return;
     if (activeTrip.status !== TripStatus.UNLOADING) return setError("Trip must be in UNLOADING state to scan.");
     if (!bagScan || !sealScan) return setError("Both Bag Code and Seal are required.");

     const bag = await bagService.getBagByCode(bagScan);
     
     if (!bag) return setError("Bag not found in system.");
     if (!activeTrip.bagIds.includes(bag.id)) return setError("Bag not listed in this Trip Manifest.");
     
     // Check if already scanned
     if (scannedBags.find(b => b.id === bag.id)) return setError("Bag already verified.");

     try {
        const verifiedBag = await bagService.validateInboundBag(user!, bagScan, sealScan);
        setScannedBags([...scannedBags, verifiedBag]);
        setBagScan('');
        setSealScan('');
     } catch(e:any) {
        setError(e.message);
     }
  };

  const handleReportException = async () => {
     if (!exceptionBag || !exceptionDesc) return;
     try {
        await bagService.recordException(user!, {
           bagId: exceptionBag,
           type: exceptionType,
           description: exceptionDesc
        });
        
        // Refresh local state
        const updatedBag = (await bagService.getBags(currentMmdcId)).find(b => b.id === exceptionBag);
        if (updatedBag) {
           // Remove from scanned if there (to update status display) and re-add
           setScannedBags(prev => [...prev.filter(b => b.id !== exceptionBag), updatedBag]);
        }
        
        setShowException(false);
        setExceptionDesc('');
     } catch(e:any) { alert(e.message); }
  };

  const openExceptionModal = (bagId: string) => {
     setExceptionBag(bagId);
     setShowException(true);
  };

  const handleCompleteInbound = async () => {
     if (!activeTrip) return;
     
     if (scannedBags.length !== activeTrip.bagIds.length) {
        setError(`Cannot complete. Verified ${scannedBags.length} / ${activeTrip.bagIds.length} bags.`);
        return;
     }
     
     try {
        await tripService.completeInbound(user!, activeTrip.id);
        setActiveTrip(null);
        setScannedBags([]);
        loadTrips();
     } catch(e:any) { setError(e.message); }
  };

  const getSourceBadge = (source?: TripSource) => {
     switch(source) {
        case TripSource.COURIER_3PL: return <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded border border-purple-200">3PL COURIER</span>;
        case TripSource.AGGREGATOR: return <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded border border-orange-200">AGGREGATOR</span>;
        case TripSource.ENTERPRISE_DIRECT: return <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded border border-blue-200">ENTERPRISE</span>;
        default: return <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded border border-gray-200">INTERNAL</span>;
     }
  };

  return (
    <Layout>
      <div className="mb-6">
         <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Truck className="mr-3 h-8 w-8 text-brand-600" />
            Inbound Dock (Safe Mode)
         </h1>
         <p className="text-sm text-gray-500 mt-1 flex items-center">
            <ShieldCheck className="h-4 w-4 mr-1 text-green-600" />
            Strict Custody Enforcement Active.
         </p>
      </div>

      {!activeTrip ? (
         <div className="grid gap-4">
            <h3 className="font-bold text-gray-700">Incoming Trips</h3>
            {inboundTrips.length === 0 ? <p className="text-gray-500 italic bg-gray-50 p-4 rounded border border-gray-200">No inbound trips pending.</p> : (
               inboundTrips.map(t => (
                  <div key={t.id} className="bg-white p-4 rounded border border-gray-200 flex justify-between items-center shadow-sm hover:border-blue-300 transition-colors">
                     <div>
                        <div className="flex items-center gap-3 mb-1">
                           <span className="font-mono font-bold text-lg text-brand-900">{t.tripCode}</span>
                           {getSourceBadge(t.tripSource)}
                           {t.externalProvider && <span className="text-xs text-gray-500">({t.externalProvider})</span>}
                        </div>
                        <p className="text-sm text-gray-600 flex items-center">
                           <Truck className="h-4 w-4 mr-1" /> {t.vehicleNumber} 
                           <span className="mx-2 text-gray-300">|</span> 
                           <Box className="h-4 w-4 mr-1" /> {t.bagIds.length} Bags
                           <span className="mx-2 text-gray-300">|</span>
                           Status: <span className="font-bold text-brand-600 ml-1">{t.status}</span>
                        </p>
                     </div>
                     <Button onClick={() => handleArrive(t)} className="w-auto">
                        {t.status === TripStatus.IN_TRANSIT ? 'Mark Arrival' : 'Manage'}
                     </Button>
                  </div>
               ))
            )}
         </div>
      ) : (
         <div className="space-y-6">
            {/* Header / Context */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded flex justify-between items-center">
               <div>
                  <div className="flex items-center gap-2 mb-1">
                     <h3 className="font-bold text-blue-900 text-lg">{activeTrip.tripCode}</h3>
                     {getSourceBadge(activeTrip.tripSource)}
                  </div>
                  <p className="text-sm text-blue-700">
                     Status: <strong>{activeTrip.status}</strong> | Progress: {scannedBags.length} / {activeTrip.bagIds.length} Bags
                  </p>
               </div>
               <button onClick={() => setActiveTrip(null)} className="text-sm text-blue-600 underline font-medium">Back to List</button>
            </div>

            {/* UNLOADING GATE */}
            {activeTrip.status === TripStatus.ARRIVED && (
               <div className="bg-white p-8 rounded border border-gray-200 text-center shadow-sm">
                  <Truck className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Vehicle at Dock</h3>
                  <p className="text-gray-500 mb-6">Verify vehicle identity and driver before unloading.</p>
                  <Button onClick={handleStartUnloading} className="w-auto h-12 text-lg bg-brand-600">
                     <ArrowRight className="h-5 w-5 mr-2" /> Start Unloading
                  </Button>
               </div>
            )}

            {/* SCANNING INTERFACE */}
            {activeTrip.status === TripStatus.UNLOADING && (
               <>
                  <div className="bg-white p-6 rounded border border-gray-200 shadow-sm">
                     <h4 className="font-bold mb-4 flex items-center text-gray-800"><Scan className="h-5 w-5 mr-2" /> Verify Custody</h4>
                     
                     <form onSubmit={handleVerifyBag} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <Input 
                           label="1. Scan Bag Code" 
                           value={bagScan} 
                           onChange={e => setBagScan(e.target.value)} 
                           placeholder="BAG-..."
                           autoFocus
                        />
                        <Input 
                           label="2. Verify Seal No" 
                           value={sealScan} 
                           onChange={e => setSealScan(e.target.value)} 
                           placeholder="Scan Seal"
                        />
                        <div className="pb-4">
                           <Button type="submit">Verify & Accept</Button>
                        </div>
                     </form>
                     
                     {error && (
                        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded border border-red-200 flex items-center animate-pulse">
                           <AlertOctagon className="h-5 w-5 mr-2" /> {error}
                        </div>
                     )}
                  </div>

                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                     <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-gray-700">Verified Manifest</h4>
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">{scannedBags.length} of {activeTrip.bagIds.length}</span>
                     </div>
                     <div className="flex flex-wrap gap-2">
                        {scannedBags.map(b => (
                           <div key={b.id} className={`px-3 py-1 rounded-full text-xs font-bold flex items-center border ${
                              b.status === BagStatus.SHORTAGE_MARKED || b.status === BagStatus.DAMAGE_MARKED ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'
                           }`}>
                              {b.status === BagStatus.INBOUND_RECEIVED ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                              {b.bagCode}
                              
                              {/* Exception Trigger for Verified Bags */}
                              {b.status === BagStatus.INBOUND_RECEIVED && (
                                 <button 
                                    onClick={() => openExceptionModal(b.id)} 
                                    className="ml-2 pl-2 border-l border-green-300 text-red-600 hover:text-red-800 text-[10px]"
                                    title="Report Issue"
                                 >
                                    Report
                                 </button>
                              )}
                           </div>
                        ))}
                        {scannedBags.length === 0 && <span className="text-gray-400 text-sm italic">No bags scanned yet.</span>}
                     </div>
                  </div>

                  <div className="pt-2">
                     <Button 
                        onClick={handleCompleteInbound} 
                        disabled={scannedBags.length !== activeTrip.bagIds.length} 
                        className="w-full h-14 text-lg font-bold"
                     >
                        {scannedBags.length !== activeTrip.bagIds.length ? `Scan Remaining ${activeTrip.bagIds.length - scannedBags.length} Bags` : 'Complete Inbound Trip'}
                     </Button>
                     {scannedBags.length !== activeTrip.bagIds.length && (
                        <p className="text-center text-xs text-red-500 mt-2 font-medium">
                           <AlertOctagon className="h-3 w-3 inline mr-1" /> 
                           Strict Mode: All bags must be verified to complete.
                        </p>
                     )}
                  </div>
               </>
            )}
         </div>
      )}

      {/* EXCEPTION MODAL */}
      <Modal isOpen={showException} onClose={() => setShowException(false)} title="Report Bag Exception">
         <div className="space-y-4">
            <div className="bg-red-50 p-3 rounded text-sm text-red-800">
               <strong>Warning:</strong> Marking an exception is permanent. The bag will be flagged for investigation.
            </div>
            
            <div>
               <label className="block text-sm font-medium mb-1">Issue Type</label>
               <select className="w-full border rounded p-2" value={exceptionType} onChange={e => setExceptionType(e.target.value as ExceptionType)}>
                  <option value={ExceptionType.SHORTAGE}>Shortage (Seal Intact, Items Missing)</option>
                  <option value={ExceptionType.DAMAGE}>Damage (Physical Damage)</option>
                  <option value={ExceptionType.EXCESS}>Excess (Extra Items)</option>
               </select>
            </div>
            
            <Input 
               label="Description / Reason" 
               value={exceptionDesc} 
               onChange={e => setExceptionDesc(e.target.value)} 
               placeholder="Details of discrepancy..."
               required
            />
            
            <div className="flex gap-2 justify-end pt-2">
               <Button variant="secondary" onClick={() => setShowException(false)}>Cancel</Button>
               <Button onClick={handleReportException} variant="danger">Confirm Exception</Button>
            </div>
         </div>
      </Modal>
    </Layout>
  );
};
