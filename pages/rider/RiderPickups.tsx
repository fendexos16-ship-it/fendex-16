
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { pickupService } from '../../services/pickupService';
import { runsheetService } from '../../services/runsheetService';
import { PickupRequest, PickupStatus, Runsheet, RunsheetStatus } from '../../types';
import { Truck, MapPin, ArrowLeft, CheckSquare, ChevronRight, Lock, Camera } from 'lucide-react';
import { Button } from '../../components/Button';

export const RiderPickups: React.FC = () => {
  const { user } = useAuth();
  const [activeRunsheet, setActiveRunsheet] = useState<Runsheet | null>(null);
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [selectedPickup, setSelectedPickup] = useState<PickupRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRunsheet();
  }, [user]);

  const loadRunsheet = async () => {
    if (!user) return;
    setLoading(true);
    const sheets = await runsheetService.getRiderRunsheets(user.id);
    const fmSheet = sheets.find(s => s.type === 'FM');
    
    if (fmSheet) {
       setActiveRunsheet(fmSheet);
       const allPickups = await pickupService.getPickups(fmSheet.lmdcId);
       // Filter pickups in this runsheet (Using pickupIds if available, or logic)
       // Assuming FM runsheet stores pickupIds in `pickupIds` field
       setPickups(allPickups.filter(p => fmSheet.pickupIds?.includes(p.id)));
    }
    setLoading(false);
  };

  const handleCompletePickup = async () => {
    if (!selectedPickup) return;
    if (!confirm("Confirm Pickup Completion?")) return;
    try {
       await pickupService.markPicked(user!, selectedPickup.id);
       setSelectedPickup(null);
       loadRunsheet();
    } catch(e:any) { alert(e.message); }
  };

  const handleCloseRunsheet = async () => {
     if (!activeRunsheet) return;
     if (!confirm("Close Runsheet? Ensure all pickups attempted.")) return;
     try {
        await runsheetService.closeRunsheet(user!, activeRunsheet.id);
        setActiveRunsheet(null);
        alert("Runsheet Closed");
     } catch(e:any) { alert(e.message); }
  };

  if (loading) return <Layout><div className="p-4 text-center">Loading...</div></Layout>;

  if (!activeRunsheet) {
     return (
        <Layout>
           <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
              <Truck className="h-16 w-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-bold text-gray-900">No Active Pickup Runsheet</h2>
              <p className="text-gray-500 mt-2">No First Mile runsheet assigned.</p>
           </div>
        </Layout>
     );
  }

  if (selectedPickup) {
    return (
      <Layout>
        <div className="flex flex-col h-[calc(100vh-100px)]">
           <button onClick={() => setSelectedPickup(null)} className="flex items-center text-gray-500 mb-4 font-medium">
              <ArrowLeft className="h-5 w-5 mr-1" /> Back to List
           </button>

           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-4">
              <div className="flex justify-between">
                 <h2 className="text-xl font-bold text-gray-900">Pickup #{selectedPickup.id}</h2>
                 <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded h-fit">{selectedPickup.status}</span>
              </div>
              <p className="text-gray-600 mt-2 flex items-start">
                 <MapPin className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-gray-400" />
                 {selectedPickup.address}
              </p>
              <div className="mt-4 flex gap-4 text-sm text-gray-500">
                 <span>Expected: <strong>{selectedPickup.expectedCount} Items</strong></span>
              </div>
           </div>

           {selectedPickup.status === 'ASSIGNED' && (
             <div className="flex-1 space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 cursor-pointer">
                   <Camera className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                   <p className="text-sm text-gray-600">Photo Evidence (Optional)</p>
                </div>

                <div className="mt-auto pt-4">
                   <Button onClick={handleCompletePickup} className="h-12 text-lg bg-indigo-600 hover:bg-indigo-700 shadow-lg">
                      <CheckSquare className="h-5 w-5 mr-2" /> Confirm Pickup
                   </Button>
                </div>
             </div>
           )}
        </div>
      </Layout>
    );
  }

  const pending = pickups.filter(p => p.status === 'ASSIGNED');
  const completed = pickups.filter(p => p.status === 'PICKED');

  return (
    <Layout>
      <div className="mb-4">
         <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
               <Truck className="mr-3 h-8 w-8 text-brand-600" /> First Mile
            </h1>
            <span className="bg-indigo-100 text-indigo-800 font-mono text-xs font-bold px-2 py-1 rounded">{activeRunsheet.runsheetCode}</span>
         </div>
      </div>

      <div className="space-y-4 mb-20">
         {pickups.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Runsheet is empty.</div>
         ) : (
            <>
               {pending.map(p => (
                  <div key={p.id} onClick={() => setSelectedPickup(p)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm active:bg-gray-50 flex justify-between items-center cursor-pointer">
                     <div>
                        <span className="font-bold text-gray-900">#{p.id}</span>
                        <p className="text-sm text-gray-600 line-clamp-1">{p.address}</p>
                        <p className="text-xs text-gray-400 mt-1">Expected: {p.expectedCount} Items</p>
                     </div>
                     <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">START</span>
                  </div>
               ))}

               {completed.length > 0 && (
                  <div className="mt-6">
                     <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Completed</h3>
                     {completed.map(p => (
                        <div key={p.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center mb-2 opacity-70">
                           <span className="font-mono text-xs text-gray-600">#{p.id}</span>
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
