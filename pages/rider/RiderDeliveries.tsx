
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { shipmentService } from '../../services/shipmentService';
import { runsheetService } from '../../services/runsheetService';
import { Shipment, ShipmentStatus, PaymentMode, Runsheet, RunsheetType } from '../../types';
import { Package, MapPin, IndianRupee, ArrowLeft, Camera, XCircle, CheckCircle, Lock, Scan, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

export const RiderDeliveries: React.FC = () => {
  const { user } = useAuth();
  const [activeRunsheet, setActiveRunsheet] = useState<Runsheet | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Delivery Form
  const [scanAwb, setScanAwb] = useState(''); // TC-TYPE-01
  const [otpInput, setOtpInput] = useState('');
  const [failReason, setFailReason] = useState('');
  const [actionType, setActionType] = useState<'DELIVER' | 'FAIL' | null>(null);
  const [photoProof, setPhotoProof] = useState(false); // Photo Mandatory

  useEffect(() => {
    loadRunsheet();
  }, [user]);

  const loadRunsheet = async () => {
    if (!user) return;
    setLoading(true);
    const sheets = await runsheetService.getRiderRunsheets(user.id);
    const fwdSheet = sheets.find(s => s.type === 'FWD');
    
    if (fwdSheet) {
       setActiveRunsheet(fwdSheet);
       const allShipments = await shipmentService.getShipments(user);
       // Filter shipments belonging to this runsheet
       setShipments(allShipments.filter(s => fwdSheet.shipmentIds.includes(s.id)));
    }
    setLoading(false);
  };

  // TC-TYPE-01: Cross-Type Scan Block
  const handleScan = (e: React.FormEvent) => {
     e.preventDefault();
     if (!scanAwb) return;
     
     const match = shipments.find(s => s.awb.toLowerCase() === scanAwb.toLowerCase());
     
     if (match) {
        if (match.status === ShipmentStatus.ASSIGNED) {
           setSelectedShipment(match);
           setScanAwb('');
           setPhotoProof(false); // Reset
        } else {
           alert(`Shipment ${match.awb} is already ${match.status}`);
           setScanAwb('');
        }
     } else {
        // Audit violation implied here - Scan rejected
        alert("CRITICAL: AWB not found in current FWD Runsheet.\n\nCross-type scanning is strictly prohibited.");
        setScanAwb('');
     }
  };

  const handleDelivery = async () => {
    if (!selectedShipment) return;
    
    // 1. Prepaid: OTP Check
    if (selectedShipment.paymentMode === PaymentMode.PREPAID) {
       if (otpInput.length < 4) return alert("OTP is MANDATORY for Prepaid.");
    } 

    // 2. COD: Cash Confirmation
    if (selectedShipment.paymentMode === PaymentMode.COD) {
       // STRICT: No edit allowed. Rider confirms displayed amount.
       if (!confirm(`CONFIRM: You have collected EXACTLY ₹${selectedShipment.codAmount} Cash?`)) return;
    }
    
    // 3. Proof: If no OTP (i.e. COD without OTP config, or just safety), Photo is needed? 
    // Prompt says: Delivered -> Photo OR OTP.
    // If Prepaid (OTP) -> OK.
    // If COD -> Need Proof? Let's mandate Photo if no OTP entered (COD flow usually doesn't have OTP in this spec).
    if (selectedShipment.paymentMode === PaymentMode.COD && !photoProof) {
        alert("Photo Proof is MANDATORY for COD Delivery.");
        return;
    }

    try {
       // Pass the system defined COD amount. Rider cannot edit.
       await shipmentService.updateStatus(selectedShipment.id, ShipmentStatus.DELIVERED, user!.id, selectedShipment.codAmount);
       setSelectedShipment(null);
       setActionType(null);
       setOtpInput('');
       loadRunsheet();
    } catch(e:any) { alert(e.message); }
  };

  const handleFailure = async () => {
     if (!selectedShipment || !failReason) return alert("Select a reason.");
     
     // Mandatory Photo for Failure
     if (!photoProof) return alert("Photo Proof is MANDATORY for Undelivered attempts.");

     try {
        await shipmentService.updateStatus(selectedShipment.id, ShipmentStatus.UNDELIVERED, user!.id);
        setSelectedShipment(null);
        setActionType(null);
        loadRunsheet();
     } catch(e:any) { alert(e.message); }
  };

  const handleCloseRunsheet = async () => {
     if (!activeRunsheet) return;
     if (!confirm("Close Runsheet? You cannot scan more items.")) return;
     try {
        await runsheetService.closeRunsheet(user!, activeRunsheet.id);
        setActiveRunsheet(null);
        alert("Runsheet Closed Successfully");
     } catch(e:any) { alert(e.message); }
  };

  if (loading) return <Layout><div className="p-4 text-center">Loading...</div></Layout>;

  if (!activeRunsheet) {
     return (
        <Layout>
           <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
              <Package className="h-16 w-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-bold text-gray-900">No Active Delivery Runsheet</h2>
              <p className="text-gray-500 mt-2">Ask DC Manager to assign a FWD runsheet.</p>
           </div>
        </Layout>
     );
  }

  if (selectedShipment) {
     // DELIVERY DETAIL VIEW
     return (
        <Layout>
           <div className="flex flex-col min-h-[calc(100vh-100px)]">
              <button onClick={() => { setSelectedShipment(null); setActionType(null); }} className="flex items-center text-gray-500 mb-4 font-medium">
                 <ArrowLeft className="h-5 w-5 mr-1" /> Back to List
              </button>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
                 <h2 className="text-2xl font-mono font-bold text-gray-900 mb-1">{selectedShipment.awb}</h2>
                 <div className="flex gap-2 mb-4">
                    {selectedShipment.paymentMode === PaymentMode.COD ? (
                       <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded flex items-center">
                          <IndianRupee className="h-3 w-3 mr-1" /> COD: ₹{selectedShipment.codAmount}
                       </span>
                    ) : (
                       <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">PREPAID</span>
                    )}
                 </div>
                 <p className="text-gray-600 flex items-start text-sm">
                    <MapPin className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
                    {selectedShipment.destinationPincode}
                 </p>
                 {selectedShipment.customerName && <p className="text-sm font-medium mt-2">{selectedShipment.customerName}</p>}
                 {selectedShipment.customerAddress && <p className="text-xs text-gray-500 mt-1">{selectedShipment.customerAddress}</p>}
              </div>

              {!actionType && (
                 <div className="space-y-4">
                    <button onClick={() => setActionType('DELIVER')} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg shadow-md flex items-center justify-center active:scale-95 transition-transform">
                       <CheckCircle className="h-6 w-6 mr-2" /> Mark Delivered
                    </button>
                    <button onClick={() => setActionType('FAIL')} className="w-full py-4 bg-white text-red-600 border border-red-200 rounded-xl font-bold text-lg flex items-center justify-center active:bg-red-50">
                       <XCircle className="h-6 w-6 mr-2" /> Failed Attempt
                    </button>
                 </div>
              )}

              {actionType === 'DELIVER' && (
                 <div className="space-y-4 bg-green-50 p-4 rounded-xl border border-green-100 flex-1">
                    <h3 className="font-bold text-green-900">Delivery Confirmation</h3>
                    
                    {selectedShipment.paymentMode === PaymentMode.COD ? (
                       <div className="bg-white p-6 rounded-lg border border-red-200 text-center shadow-sm">
                          <label className="block text-xs font-bold text-red-600 uppercase mb-2">Collect Exact Cash</label>
                          <p className="text-4xl font-extrabold text-gray-900 mb-2">₹{selectedShipment.codAmount}</p>
                          <p className="text-xs text-gray-500">Do not round off. No partial payment.</p>
                       </div>
                    ) : (
                       <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <Input label="Enter OTP (Mandatory)" type="number" value={otpInput} onChange={e => setOtpInput(e.target.value)} placeholder="4-digit OTP" autoFocus />
                       </div>
                    )}

                    <div 
                        onClick={() => setPhotoProof(!photoProof)}
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer active:bg-gray-50 transition-colors ${photoProof ? 'border-green-500 bg-green-50' : 'border-green-300 bg-white'}`}
                    >
                       {photoProof ? (
                          <div className="text-green-700">
                             <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                             <p className="font-bold text-sm">Photo Captured</p>
                          </div>
                       ) : (
                          <div className="text-green-500">
                             <Camera className="h-8 w-8 mx-auto mb-2" />
                             <p className="text-sm font-medium">Capture Proof (Optional for OTP)</p>
                          </div>
                       )}
                    </div>

                    <div className="mt-auto">
                       <Button onClick={handleDelivery} className="bg-green-600 hover:bg-green-700">
                          {selectedShipment.paymentMode === PaymentMode.COD ? 'Confirm Cash & Deliver' : 'Submit Delivery'}
                       </Button>
                    </div>
                 </div>
              )}

              {actionType === 'FAIL' && (
                 <div className="space-y-4 bg-red-50 p-4 rounded-xl border border-red-100 flex-1">
                    <h3 className="font-bold text-red-900">Mark Undelivered</h3>
                    <div>
                       <label className="block text-sm font-medium text-red-800 mb-2">Reason</label>
                       <select className="w-full p-3 border border-red-200 rounded-lg bg-white" value={failReason} onChange={e => setFailReason(e.target.value)}>
                          <option value="">Select Reason...</option>
                          <option value="Customer Not Available">Customer Not Available</option>
                          <option value="Address Not Found">Address Not Found</option>
                          <option value="Refused">Refused Delivery</option>
                          <option value="Cash Not Available">Cash Not Available</option>
                       </select>
                    </div>
                    
                    <div 
                        onClick={() => setPhotoProof(!photoProof)}
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer active:bg-gray-50 transition-colors ${photoProof ? 'border-red-500 bg-red-100' : 'border-red-300 bg-white'}`}
                    >
                       {photoProof ? (
                          <div className="text-red-700">
                             <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                             <p className="font-bold text-sm">Evidence Captured</p>
                          </div>
                       ) : (
                          <div className="text-red-400">
                             <Camera className="h-8 w-8 mx-auto mb-2" />
                             <p className="text-sm font-medium">Capture Evidence (Mandatory)</p>
                          </div>
                       )}
                    </div>

                    <div className="mt-auto">
                       <Button onClick={handleFailure} variant="danger">Submit Failure</Button>
                    </div>
                 </div>
              )}
           </div>
        </Layout>
     );
  }

  // RUNSHEET LIST VIEW
  const pending = shipments.filter(s => s.status === ShipmentStatus.ASSIGNED);
  const completed = shipments.filter(s => s.status === ShipmentStatus.DELIVERED || s.status === ShipmentStatus.UNDELIVERED);

  return (
    <Layout>
      <div className="mb-4">
         <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
               <Package className="mr-3 h-8 w-8 text-brand-600" /> Forward Delivery
            </h1>
            <span className="bg-blue-100 text-blue-800 font-mono text-xs font-bold px-2 py-1 rounded">{activeRunsheet.runsheetCode}</span>
         </div>
         <div className="flex gap-2 text-sm text-gray-500">
            <span>Pending: <strong>{pending.length}</strong></span>
            <span>Done: <strong>{completed.length}</strong></span>
         </div>
      </div>

      <div className="mb-4">
         <form onSubmit={handleScan} className="flex gap-2">
            <div className="relative flex-1">
               <Scan className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
               <input 
                  type="text" 
                  placeholder="Scan AWB to Deliver..." 
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  value={scanAwb}
                  onChange={e => setScanAwb(e.target.value)}
               />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-4 rounded-xl font-bold">GO</button>
         </form>
      </div>

      <div className="space-y-4 mb-20">
         {pending.length === 0 && completed.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Runsheet is empty.</div>
         ) : (
            <>
               {pending.map(s => (
                  <div key={s.id} onClick={() => setSelectedShipment(s)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm active:bg-gray-50 cursor-pointer flex justify-between items-center">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className="font-mono font-bold text-gray-900">{s.awb}</span>
                           {s.paymentMode === PaymentMode.COD && (
                              <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded">₹{s.codAmount}</span>
                           )}
                        </div>
                        <p className="text-xs text-gray-500">{s.destinationPincode}</p>
                     </div>
                     <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">DELIVER</span>
                  </div>
               ))}
               
               {completed.length > 0 && (
                  <div className="mt-6">
                     <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Completed</h3>
                     {completed.map(s => (
                        <div key={s.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center mb-2 opacity-70">
                           <span className="font-mono text-xs text-gray-600">{s.awb}</span>
                           <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.status === ShipmentStatus.DELIVERED ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {s.status}
                           </span>
                        </div>
                     ))}
                  </div>
               )}
            </>
         )}
      </div>

      {pending.length === 0 && (
         <div className="fixed bottom-20 left-4 right-4 md:left-72 md:w-auto">
            <Button onClick={handleCloseRunsheet} className="w-full bg-gray-900 shadow-xl">
               <Lock className="h-4 w-4 mr-2" /> Close Runsheet
            </Button>
         </div>
      )}
    </Layout>
  );
};
