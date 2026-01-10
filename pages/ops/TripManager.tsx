
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { tripService } from '../../services/tripService';
import { masterDataService } from '../../services/masterDataService';
import { useAuth } from '../../context/AuthContext';
import { Trip, TripStatus, MMDC, TripSource } from '../../types';
import { Navigation, Truck, Plus, Package, ArrowRightCircle } from 'lucide-react';

export const TripManager: React.FC = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [mmdcs, setMmdcs] = useState<MMDC[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Create Form
  const [showCreate, setShowCreate] = useState(false);
  const [newTrip, setNewTrip] = useState({ destId: '', vehicle: '', driver: '', phone: '' });
  
  // Bag Load Form
  const [bagScan, setBagScan] = useState('');

  const currentMmdcId = user?.linkedEntityId || 'M1';

  const loadData = async () => {
    setLoading(true);
    const [tData, mData] = await Promise.all([
      tripService.getTrips(currentMmdcId),
      masterDataService.getMMDCs()
    ]);
    setTrips(tData);
    setMmdcs(mData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleCreateTrip = async () => {
    if (!user) return;
    try {
      await tripService.createTrip(user, {
        originEntityId: currentMmdcId,
        destinationEntityId: newTrip.destId,
        vehicleNumber: newTrip.vehicle,
        driverName: newTrip.driver,
        driverPhone: newTrip.phone,
        tripSource: TripSource.INTERNAL_TRANSFER
      });
      setShowCreate(false);
      loadData();
    } catch(e: any) { alert(e.message); }
  };

  const handleAddBag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !bagScan) return;
    try {
      await tripService.addBagToTrip(activeTrip.id, bagScan);
      setBagScan('');
      loadData();
      // Optimistic update
      const updatedTrips = await tripService.getTrips(currentMmdcId);
      setActiveTrip(updatedTrips.find(t => t.id === activeTrip.id) || null);
    } catch(e: any) { alert(e.message); setBagScan(''); }
  };

  const handleDispatch = async () => {
    if (!activeTrip) return;
    if (!confirm(`Dispatch Trip ${activeTrip.tripCode}? This is irreversible.`)) return;
    try {
      await tripService.dispatchTrip(user!, activeTrip.id);
      setActiveTrip(null);
      loadData();
    } catch(e: any) { alert(e.message); }
  };

  const handleReceive = async (tripId: string) => {
    if (!confirm("Confirm Trip Arrival?")) return;
    try {
      await tripService.receiveTrip(user!, tripId);
      loadData();
    } catch(e: any) { alert(e.message); }
  };

  const getMMDCName = (id: string) => mmdcs.find(m => m.id === id)?.name || id;

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Navigation className="mr-3 h-8 w-8 text-brand-600" />
            Trip Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">Vehicle Dispatch & Arrivals at {currentMmdcId}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="w-auto">
          <Plus className="h-4 w-4 mr-2" /> Create Trip
        </Button>
      </div>

      {/* ACTIVE LOADING DOCK */}
      {activeTrip && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-8 shadow-sm">
           <div className="flex justify-between items-start mb-4">
              <div>
                 <h3 className="text-lg font-bold text-indigo-900 flex items-center">
                    <Truck className="h-5 w-5 mr-2" /> Loading: {activeTrip.tripCode}
                 </h3>
                 <p className="text-sm text-indigo-700 mt-1">
                    To: {getMMDCName(activeTrip.destinationEntityId)} | Vehicle: {activeTrip.vehicleNumber}
                 </p>
              </div>
              <div className="flex gap-2">
                 <Button onClick={handleDispatch} className="bg-indigo-700 hover:bg-indigo-800 w-auto text-xs h-8">
                    Dispatch Trip
                 </Button>
                 <button onClick={() => setActiveTrip(null)} className="text-indigo-500 text-xs underline ml-2">Close</button>
              </div>
           </div>

           <form onSubmit={handleAddBag} className="flex gap-4">
              <Input 
                 label="Scan Sealed Bag" 
                 value={bagScan} 
                 onChange={e => setBagScan(e.target.value)} 
                 placeholder="BAG-..." 
                 autoFocus
                 className="bg-white"
              />
              <div className="pt-7">
                 <Button type="submit" className="w-auto">Load</Button>
              </div>
           </form>

           <div className="mt-4">
              <p className="text-xs font-bold text-indigo-800 uppercase mb-2">Manifest ({activeTrip.bagIds.length} Bags)</p>
              <div className="flex flex-wrap gap-2">
                 {activeTrip.bagIds.map(id => (
                    <span key={id} className="bg-white border border-indigo-200 text-indigo-800 px-2 py-1 rounded text-xs font-mono flex items-center">
                       <Package className="h-3 w-3 mr-1" /> {id}
                    </span>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* TRIP LIST */}
      <Table<Trip>
        data={trips}
        isLoading={loading}
        columns={[
          { header: 'Trip Code', accessor: 'tripCode', className: 'font-mono font-bold' },
          { header: 'Origin', accessor: (t) => getMMDCName(t.originEntityId) },
          { header: 'Destination', accessor: (t) => getMMDCName(t.destinationEntityId) },
          { header: 'Vehicle', accessor: 'vehicleNumber' },
          { header: 'Bags', accessor: (t) => t.bagIds.length },
          { header: 'Status', accessor: (t) => <span className={`px-2 py-1 rounded text-xs font-bold ${t.status === TripStatus.IN_TRANSIT ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100'}`}>{t.status}</span> },
        ]}
        actions={(t) => (
           <div className="flex justify-end">
              {t.status === TripStatus.CREATED && (
                 <button onClick={() => setActiveTrip(t)} className="text-brand-600 font-bold text-xs hover:underline">Load & Manage</button>
              )}
              {t.status === TripStatus.IN_TRANSIT && t.destinationEntityId === currentMmdcId && (
                 <button onClick={() => handleReceive(t.id)} className="text-green-600 font-bold text-xs hover:underline flex items-center">
                    <ArrowRightCircle className="h-3 w-3 mr-1" /> Receive
                 </button>
              )}
           </div>
        )}
      />

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Trip">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Destination MMDC</label>
               <select className="w-full border rounded p-2" value={newTrip.destId} onChange={e => setNewTrip({...newTrip, destId: e.target.value})}>
                  <option value="">Select Destination</option>
                  {mmdcs.filter(m => m.id !== currentMmdcId).map(m => (
                     <option key={m.id} value={m.id}>{m.name} ({m.city})</option>
                  ))}
               </select>
            </div>
            <Input label="Vehicle Number" value={newTrip.vehicle} onChange={e => setNewTrip({...newTrip, vehicle: e.target.value})} placeholder="MH-01-AB-1234" />
            <div className="grid grid-cols-2 gap-4">
               <Input label="Driver Name" value={newTrip.driver} onChange={e => setNewTrip({...newTrip, driver: e.target.value})} />
               <Input label="Driver Phone" value={newTrip.phone} onChange={e => setNewTrip({...newTrip, phone: e.target.value})} />
            </div>
            <Button onClick={handleCreateTrip}>Create Manifest</Button>
         </div>
      </Modal>

    </Layout>
  );
};
