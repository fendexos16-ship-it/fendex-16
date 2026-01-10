
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { shipmentService } from '../../services/shipmentService';
import { runsheetService } from '../../services/runsheetService';
import { Shipment, ShipmentStatus, Runsheet, RunsheetType } from '../../types';
import { RotateCcw, MapPin, ArrowLeft, Camera, CheckSquare, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

export const RiderRvp: React.FC = () => {
  const { user } = useAuth();
  const [activeRunsheet, setActiveRunsheet] = useState<Runsheet | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  
  // RVP Workflow State
  const [transactionId, setTransactionId] = useState('');
  const [photoCaptured, setPhotoCaptured] = useState(false); // TC-RVP-02

  useEffect(() => {
    loadRunsheet();
  }, [user]);

  const loadRunsheet = async () => {
    if (!user) return;
    setLoading(true);
    const sheets = await runsheetService.getRiderRunsheets(user.id);
    const rvpSheet = sheets.find(s => s.type === 'RVP');
    
    if (rvpSheet) {
       setActiveRunsheet(rvpSheet);
       const allShipments = await shipmentService.getShipments(user);
       setShipments(allShipments.filter(s => rvpSheet.shipmentIds.includes(s.id)));
    }
    setLoading(false);
  };

  const handleCompleteRvp = async () => {
    if (!selectedShipment) return;
    
    // TC-RVP-02: Enforcement
    if (!photoCaptured) {
       alert("COMPLIANCE BLOCK: Product Photo is Mandatory for RVP.");
       return;
    }

    if (!confirm("QC Passed & Item Collected?")) return;
    
    try {
       await shipmentService.updateStatus(selectedShipment.id, ShipmentStatus.RVP_PICKED, user!.id, undefined, transactionId);
       setSelectedShipment(null);
       setTransactionId('');
       setPhotoCaptured(false);
       loadRunsheet();
    } catch(e:any) { alert(e.message); }
  };

  const handleCloseRunsheet = async () => {
     if (!activeRunsheet) return;
     const pendingCount = shipments.filter(s => s.status === ShipmentStatus.ASSIGNED).length;
     if (pendingCount > 0) {
        if (!confirm(`Warning: ${pendingCount} items are still pending. Close anyway?`)) return;
     }
     try {
        await runsheetService.closeRunsheet(user!, activeRunsheet.id);
        setActiveRunsheet(null);
        alert("Runsheet Closed");
     } catch(e:any) { alert(e.message); }
  };

  const handleSelectShipment = (s: Shipment) => {
     setSelectedShipment(s);
     setTransactionId(''); 
     setPhotoCaptured(false); // Reset for new item
  };

  if (loading) return <Layout><div className="p-4 text-center">Loading...</div></Layout>;

  if (!activeRunsheet) {
     return (
        <Layout>
           <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
              <RotateCcw className="h-16 w-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-bold text-gray-900">No Active RVP Runsheet</h2>
              <p className="text-gray-500 mt-2">No reverse pickups assigned.</p>
           </div>
        </Layout>
     );
  }

  if (selectedShipment) {
    return (
      <Layout>
        <div className="flex flex-col h-[calc(100vh-100px)]">
           <button onClick={() => setSelectedShipment(null)} className="flex items-center text-gray-500 mb-4 font-medium">
              <ArrowLeft className="h-5 w-5 mr-1" /> Back to List
           </button>

           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-4">
              <div className="flex justify-between">
                 <h2 className="text-xl font-mono font-bold text-gray-900">{selectedShipment.awb}</h2>
                 <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded h-fit">RETURN</span>
              </div>
              <p className="text-gray-600 mt-2 flex items-start text-sm">
                 <MapPin className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-gray-400" />
                 {selectedShipment.destinationPincode} (Customer Address)
              </p>
           </div>

           <div className="flex-1 space-y-4">
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 text-sm text-orange-800">
                 <strong>QC Instruction:</strong> Check for original packaging and tags. Reject if damaged.
              </div>

              {/* Photo Evidence Block (TC-RVP-02) */}
              <div 
                 onClick={() => setPhotoCaptured(!photoCaptured)}
                 className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    photoCaptured ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
                 }`}
              >
                 {photoCaptured ? (
                    <>
                       <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                       <p className="text-sm text-green-800 font-bold">Photo Captured</p>
                       <p className="text-xs text-green-600">(Tap to retake)</p>
                    </>
                 ) : (
                    <>
                       <Camera className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                       <p className="text-sm text-gray-600">Product Photo (Mandatory)</p>
                       <p className="text-xs text-red-500 mt-1 font-medium">* Required for completion</p>
                    </>
                 )}
              </div>
              
              <Input 
                 label="Transaction ID / Reference (Optional)"
                 value={transactionId}
                 onChange={e => setTransactionId(e.target.value)}
                 placeholder="e.g. Refund Ref No."
              />

              <div className="mt-auto pt-4">
                 <Button 
                    onClick={handleCompleteRvp} 
                    disabled={!photoCaptured}
                    className={`h-12 text-lg shadow-lg ${!photoCaptured ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}
                 >
                    <CheckSquare className="h-5 w-5 mr-2" /> Pickup Verified
                 </Button>
                 {!photoCaptured && (
                    <p className="text-center text-xs text-red-500 mt-2 flex items-center justify-center">
                       <AlertTriangle className="h-3 w-3 mr-1" />
                       Photo required to enable completion
                    </p>
                 )}
              </div>
           </div>
        </div>
      </Layout>
    );
  }

  const pending = shipments.filter(s => s.status === ShipmentStatus.ASSIGNED);
  const completed = shipments.filter(s => s.status === ShipmentStatus.RVP_PICKED || s.status === ShipmentStatus.RVP_QC_FAILED);

  return (
    <Layout>
      <div className="mb-4">
         <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
               <RotateCcw className="mr-3 h-8 w-8 text-brand-600" /> Reverse Pickup
            </h1>
            <span className="bg-orange-100 text-orange-800 font-mono text-xs font-bold px-2 py-1 rounded">{activeRunsheet.runsheetCode}</span>
         </div>
      </div>

      <div className="space-y-4 mb-20">
         {pending.length === 0 && completed.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Runsheet is empty.</div>
         ) : (
            <>
               {pending.map(s => (
                  <div key={s.id} onClick={() => handleSelectShipment(s)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm active:bg-gray-50 flex justify-between items-center cursor-pointer">
                     <div>
                        <span className="font-mono font-bold text-gray-900">{s.awb}</span>
                        <p className="text-xs text-gray-500">{s.destinationPincode}</p>
                     </div>
                     <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">START QC</span>
                  </div>
               ))}
               
               {completed.length > 0 && (
                  <div className="mt-6">
                     <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Completed</h3>
                     {completed.map(s => (
                        <div key={s.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center mb-2 opacity-70">
                           <span className="font-mono text-xs text-gray-600">{s.awb}</span>
                           <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-800">PICKED</span>
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
