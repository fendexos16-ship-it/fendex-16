
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { connectionSheetService } from '../../services/connectionSheetService';
import { tripService } from '../../services/tripService';
import { masterDataService } from '../../services/masterDataService';
import { useAuth } from '../../context/AuthContext';
import { ConnectionSheet, VehicleType } from '../../types';
import { Navigation, Truck, User, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';

export const MMDCOutbound: React.FC = () => {
  const { user } = useAuth();
  const [closedSheets, setClosedSheets] = useState<ConnectionSheet[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  
  // Mandatory Dispatch Fields
  const [vehicle, setVehicle] = useState({ number: '', type: VehicleType.TRUCK, transporter: '' });
  const [driver, setDriver] = useState({ name: '', phone: '' });

  const currentMmdcId = user?.linkedEntityId || 'M1';

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    const allSheets = await connectionSheetService.getSheets(currentMmdcId);
    // Only fetch CLOSED sheets ready for dispatch
    setClosedSheets(allSheets.filter(s => s.status === 'CLOSED'));
    
    const [dcs, lmdcs, mmdcs] = await Promise.all([
       masterDataService.getDCs(),
       masterDataService.getLMDCs(),
       masterDataService.getMMDCs()
    ]);
    
    setDestinations([
       ...dcs.map(d => ({ id: d.id, name: d.name })),
       ...lmdcs.map(l => ({ id: l.id, name: l.name })),
       ...mmdcs.map(m => ({ id: m.id, name: m.name }))
    ]);
  };

  const handleDispatch = async () => {
     // 1. UI Validation
     if (selectedSheets.length === 0) return alert("Select Sheets");
     if (!vehicle.number || !vehicle.type) return alert("Vehicle details mandatory.");
     if (!driver.name || !driver.phone) return alert("Driver details mandatory.");

     // 2. Integrity Check
     const firstDest = closedSheets.find(s => s.id === selectedSheets[0])?.destinationId;
     const mixed = selectedSheets.some(id => closedSheets.find(s => s.id === id)?.destinationId !== firstDest);
     if (mixed) return alert("Routing Error: All selected sheets must have the SAME destination.");

     if (!confirm(`CONFIRM DISPATCH?\n\nVehicle: ${vehicle.number}\nDestination: ${getDestName(firstDest!)}\nSheets: ${selectedSheets.length}\n\nThis action is FINAL and cannot be undone.`)) return;

     try {
        await tripService.createAndDispatchOutbound(user!, {
           originMmdcId: currentMmdcId,
           destinationId: firstDest!,
           sheetIds: selectedSheets,
           vehicle: { ...vehicle },
           driver: { ...driver }
        });
        
        alert(`Dispatch Successful! Vehicle Released.`);
        setSelectedSheets([]);
        setVehicle({ number: '', type: VehicleType.TRUCK, transporter: '' });
        setDriver({ name: '', phone: '' });
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const getDestName = (id: string) => destinations.find(d => d.id === id)?.name || id;

  const totalBags = closedSheets.filter(s => selectedSheets.includes(s.id)).reduce((acc, s) => acc + s.bagIds.length, 0);

  return (
    <Layout>
      <div className="mb-6">
         <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Navigation className="mr-3 h-8 w-8 text-brand-600" />
            Outbound Dispatch (Hard Mode)
         </h1>
         <p className="text-sm text-gray-500 mt-1 flex items-center">
            <ShieldCheck className="h-4 w-4 mr-1 text-green-600" />
            Final Custody Handover. Requires full vehicle & driver manifest.
         </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2">
            <h3 className="font-bold text-gray-700 mb-4">Ready for Dispatch (Closed Sheets)</h3>
            {closedSheets.length === 0 ? (
               <div className="bg-gray-50 p-8 rounded text-center border border-gray-200">
                  <p className="text-gray-500">No closed sheets available.</p>
                  <p className="text-xs text-gray-400 mt-1">Go to Sorting to close connections first.</p>
               </div>
            ) : (
               <div className="space-y-3">
                  {closedSheets.map(s => (
                     <label key={s.id} className={`flex items-center justify-between p-4 border rounded cursor-pointer transition-all shadow-sm ${selectedSheets.includes(s.id) ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-200 hover:border-brand-300'}`}>
                        <div className="flex items-center">
                           <input 
                              type="checkbox" 
                              checked={selectedSheets.includes(s.id)}
                              onChange={e => {
                                 if(e.target.checked) setSelectedSheets([...selectedSheets, s.id]);
                                 else setSelectedSheets(selectedSheets.filter(id => id !== s.id));
                              }}
                              className="w-5 h-5 text-brand-600 rounded mr-4"
                           />
                           <div>
                              <p className="font-bold text-gray-900">{s.code}</p>
                              <div className="flex gap-3 text-xs text-gray-500 mt-1">
                                 <span>{s.bagIds.length} Bags</span>
                                 <span>|</span>
                                 <span className="font-mono">{s.destinationType}</span>
                              </div>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-sm font-bold text-brand-700">{getDestName(s.destinationId)}</p>
                           <p className="text-xs text-gray-400">Closed: {new Date(s.createdAt).toLocaleTimeString()}</p>
                        </div>
                     </label>
                  ))}
               </div>
            )}
         </div>

         <div className="bg-white p-6 rounded-lg border border-gray-200 h-fit shadow-md sticky top-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center border-b pb-2">
               <Truck className="h-5 w-5 mr-2 text-brand-600" /> Manifest Details
            </h3>
            
            <div className="space-y-5">
               {/* Vehicle Section */}
               <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase">Vehicle Information</label>
                  <div className="grid grid-cols-2 gap-3">
                     <Input 
                        label="Registration No" 
                        value={vehicle.number} 
                        onChange={e => setVehicle({...vehicle, number: e.target.value.toUpperCase()})} 
                        placeholder="MH-02-AB-1234" 
                        required 
                        className="mb-0"
                     />
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                        <select 
                           className="w-full border rounded p-2.5 text-sm bg-white"
                           value={vehicle.type}
                           onChange={e => setVehicle({...vehicle, type: e.target.value as VehicleType})}
                        >
                           {Object.values(VehicleType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                     </div>
                  </div>
                  <Input 
                     label="Transporter Name (Optional)" 
                     value={vehicle.transporter} 
                     onChange={e => setVehicle({...vehicle, transporter: e.target.value})} 
                     placeholder="e.g. Express Logistics" 
                     className="mb-0"
                  />
               </div>

               {/* Driver Section */}
               <div className="space-y-3 border-t pt-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase flex items-center">
                     <User className="h-3 w-3 mr-1" /> Driver Details
                  </label>
                  <Input 
                     label="Full Name" 
                     value={driver.name} 
                     onChange={e => setDriver({...driver, name: e.target.value})} 
                     required 
                     className="mb-0"
                  />
                  <Input 
                     label="Mobile Number" 
                     value={driver.phone} 
                     onChange={e => setDriver({...driver, phone: e.target.value})} 
                     required 
                     placeholder="10-digit mobile"
                     className="mb-0"
                  />
               </div>
               
               {/* Summary & Action */}
               <div className="pt-6 border-t border-gray-200">
                  <div className="flex justify-between mb-2 text-sm">
                     <span className="text-gray-600">Selected Sheets:</span>
                     <span className="font-bold">{selectedSheets.length}</span>
                  </div>
                  <div className="flex justify-between mb-4 text-sm">
                     <span className="text-gray-600">Total Bags:</span>
                     <span className="font-bold">{totalBags}</span>
                  </div>
                  
                  <Button onClick={handleDispatch} disabled={selectedSheets.length === 0} className="w-full h-12 text-lg shadow-lg bg-gray-900 hover:bg-black">
                     Dispatch Vehicle <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                  
                  {selectedSheets.length === 0 && (
                     <p className="text-xs text-center text-gray-400 mt-2">
                        <AlertTriangle className="h-3 w-3 inline mr-1" /> Select sheets to enable dispatch.
                     </p>
                  )}
               </div>
            </div>
         </div>
      </div>
    </Layout>
  );
};
