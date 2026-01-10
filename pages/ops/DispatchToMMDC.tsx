
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { tripService } from '../../services/tripService';
import { bagService } from '../../services/bagService';
import { masterDataService } from '../../services/masterDataService';
import { useAuth } from '../../context/AuthContext';
import { Bag, BagStatus, BagType, MMDC, TripSource } from '../../types';
import { Navigation, CheckSquare, Truck } from 'lucide-react';

export const DispatchToMMDC: React.FC = () => {
  const { user } = useAuth();
  const [sealedBags, setSealedBags] = useState<Bag[]>([]);
  const [selectedBags, setSelectedBags] = useState<string[]>([]);
  const [mmdcs, setMmdcs] = useState<MMDC[]>([]);
  const [destMmdcId, setDestMmdcId] = useState('');
  const [vehicle, setVehicle] = useState('');
  
  const currentLmdcId = user?.linkedEntityId || 'LM1';

  const loadData = async () => {
    const [bagData, mmdcData] = await Promise.all([
      bagService.getBags(currentLmdcId),
      masterDataService.getMMDCs()
    ]);
    // Filter for SEALED First-Mile bags originating here
    setSealedBags(bagData.filter(b => 
       b.type === BagType.FIRST_MILE && 
       b.status === BagStatus.SEALED &&
       b.originEntityId === currentLmdcId
    ));
    setMmdcs(mmdcData);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleDispatch = async () => {
    if (!destMmdcId || !vehicle || selectedBags.length === 0) {
       alert("Please select destination, vehicle and at least one bag.");
       return;
    }
    
    if (!confirm("Confirm Dispatch to Hub? This action transfers custody.")) return;

    try {
       // 1. Create Trip
       const trip = await tripService.createTrip(user!, {
          originEntityId: currentLmdcId,
          destinationEntityId: destMmdcId,
          vehicleNumber: vehicle,
          driverName: 'Local Driver',
          driverPhone: '0000000000',
          tripSource: TripSource.INTERNAL_TRANSFER
       });

       // 2. Add Bags
       for (const bagId of selectedBags) {
          // Need bag code to add to trip service logic
          const bag = sealedBags.find(b => b.id === bagId);
          if(bag) await tripService.addBagToTrip(trip.id, bag.bagCode);
       }

       // 3. Dispatch Trip
       await tripService.dispatchTrip(user!, trip.id);
       
       alert(`Dispatch Successful! Trip ID: ${trip.tripCode}`);
       setSelectedBags([]);
       setVehicle('');
       loadData();
    } catch(e: any) { alert(e.message); }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
           <Navigation className="mr-3 h-8 w-8 text-brand-600" /> Dispatch to Hub
        </h1>
        <p className="text-sm text-gray-500 mt-1">Send Sealed First-Mile Bags to Parent MMDC</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Select Sealed Bags</h3>
            {sealedBags.length === 0 ? (
               <p className="text-gray-500 italic">No sealed bags ready for dispatch.</p>
            ) : (
               <div className="space-y-2">
                  {sealedBags.map(b => (
                     <div key={b.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                        <div className="flex items-center">
                           <input 
                              type="checkbox" 
                              checked={selectedBags.includes(b.id)}
                              onChange={e => {
                                 if(e.target.checked) setSelectedBags([...selectedBags, b.id]);
                                 else setSelectedBags(selectedBags.filter(id => id !== b.id));
                              }}
                              className="mr-3 h-4 w-4 text-brand-600"
                           />
                           <div>
                              <p className="font-mono font-bold text-sm">{b.bagCode}</p>
                              <p className="text-xs text-gray-500">Seal: {b.sealNumber} | Items: {b.actualCount}</p>
                           </div>
                        </div>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">To: {mmdcs.find(m => m.id === b.destinationEntityId)?.name || b.destinationEntityId}</span>
                     </div>
                  ))}
               </div>
            )}
         </div>

         <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 h-fit">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center"><Truck className="h-4 w-4 mr-2" /> Trip Details</h3>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium mb-1">Destination MMDC</label>
                  <select className="w-full border rounded p-2 bg-white" value={destMmdcId} onChange={e => setDestMmdcId(e.target.value)}>
                     <option value="">Select Hub</option>
                     {mmdcs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
               </div>
               <Input label="Vehicle / Ref No" value={vehicle} onChange={e => setVehicle(e.target.value)} className="bg-white" />
               
               <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between mb-2 text-sm">
                     <span>Selected Bags:</span>
                     <span className="font-bold">{selectedBags.length}</span>
                  </div>
                  <Button onClick={handleDispatch} disabled={selectedBags.length === 0}>Confirm Dispatch</Button>
               </div>
            </div>
         </div>
      </div>
    </Layout>
  );
};
