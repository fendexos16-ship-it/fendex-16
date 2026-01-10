
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
import { Navigation, Truck, Plus, Package, ArrowRightCircle, CheckCircle, Upload, Download, FileSpreadsheet } from 'lucide-react';

export const TripOperations: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  
  // Modals / Flow State
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importContent, setImportContent] = useState('');
  
  const [newTripData, setNewTripData] = useState({ destId: '', vehicle: '', driver: '', phone: '' });
  
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [bagScan, setBagScan] = useState('');

  const currentMmdcId = user?.linkedEntityId || 'M1';

  const loadData = async () => {
    const [tData, dcs, lmdcs] = await Promise.all([
      tripService.getTrips(currentMmdcId),
      masterDataService.getDCs(),
      masterDataService.getLMDCs()
    ]);
    setTrips(tData);
    setDestinations([...dcs, ...lmdcs]);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleCreateTrip = async () => {
    if (!newTripData.destId) return alert('Select Destination');
    try {
      await tripService.createTrip(user!, {
        originEntityId: currentMmdcId,
        destinationEntityId: newTripData.destId,
        vehicleNumber: newTripData.vehicle,
        driverName: newTripData.driver,
        driverPhone: newTripData.phone,
        tripSource: TripSource.INTERNAL_TRANSFER
      });
      setShowCreate(false);
      loadData();
    } catch(e: any) { alert(e.message); }
  };

  const handleAddBag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || !bagScan) return;
    try {
      await tripService.addBagToTrip(selectedTrip.id, bagScan);
      setBagScan('');
      loadData();
      // Update selected
      const updated = await tripService.getTrips(currentMmdcId);
      setSelectedTrip(updated.find(t => t.id === selectedTrip.id) || null);
    } catch(e: any) { alert(e.message); setBagScan(''); }
  };

  const handleDispatch = async () => {
    if (!selectedTrip) return;
    if (!confirm('Dispatch Trip? Irreversible.')) return;
    try {
      await tripService.dispatchTrip(user!, selectedTrip.id);
      setSelectedTrip(null);
      loadData();
    } catch(e: any) { alert(e.message); }
  };

  const handleReceiveTrip = async (tripId: string) => {
     if(!confirm("Confirm Trip Arrival?")) return;
     try {
        await tripService.receiveTrip(user!, tripId);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleDownloadSample = () => {
     const headers = "Trip_ID, Bag_ID, Seal_No, Origin_DC";
     const blob = new Blob([headers], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = "MMDC_Trip_Sample.csv";
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
  };

  const handleImport = () => {
     if (!importContent) return;
     alert("Import Simulation: " + importContent.split('\n').length + " rows processed.");
     setShowImport(false);
     setImportContent('');
  };

  const filteredTrips = trips.filter(t => {
     if (activeTab === 'OUTBOUND') return t.originEntityId === currentMmdcId;
     return t.destinationEntityId === currentMmdcId;
  });

  const getEntityName = (id: string) => destinations.find(d => d.id === id)?.name || id;

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
           <Navigation className="mr-3 h-8 w-8 text-brand-600" /> Trip Operations
        </h1>
        <div className="flex bg-gray-100 p-1 rounded-lg">
           <button onClick={() => setActiveTab('OUTBOUND')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'OUTBOUND' ? 'bg-white shadow text-brand-600' : 'text-gray-500'}`}>Outbound</button>
           <button onClick={() => setActiveTab('INBOUND')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'INBOUND' ? 'bg-white shadow text-brand-600' : 'text-gray-500'}`}>Inbound</button>
        </div>
      </div>

      {activeTab === 'OUTBOUND' && !selectedTrip && (
         <div className="mb-4 flex justify-end gap-2">
            <Button onClick={() => setShowImport(true)} variant="secondary" className="w-auto">
               <Upload className="h-4 w-4 mr-2" /> Import Manifest
            </Button>
            <Button onClick={() => setShowCreate(true)} className="w-auto">
               <Plus className="h-4 w-4 mr-2" /> New Trip
            </Button>
         </div>
      )}

      {selectedTrip ? (
         <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start mb-6">
               <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedTrip.tripCode}</h2>
                  <p className="text-sm text-gray-500">To: {getEntityName(selectedTrip.destinationEntityId)} | Vehicle: {selectedTrip.vehicleNumber}</p>
               </div>
               <div className="text-right">
                  <p className="text-2xl font-bold">{selectedTrip.bagIds.length}</p>
                  <p className="text-xs uppercase text-gray-500">Bags Loaded</p>
               </div>
            </div>

            {selectedTrip.status === TripStatus.CREATED && (
               <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <form onSubmit={handleAddBag} className="flex gap-4">
                     <Input 
                        label="Scan Sealed Bag" 
                        value={bagScan} 
                        onChange={e => setBagScan(e.target.value)} 
                        autoFocus 
                        placeholder="BAG-..." 
                        className="bg-white"
                     />
                     <div className="pt-7">
                        <Button type="submit" className="w-auto">Load Bag</Button>
                     </div>
                  </form>
               </div>
            )}

            <div className="mb-6">
               <h3 className="font-bold text-gray-700 mb-2">Manifest</h3>
               <div className="flex flex-wrap gap-2">
                  {selectedTrip.bagIds.map(id => (
                     <span key={id} className="bg-gray-100 text-gray-800 px-3 py-1 rounded text-sm font-mono">{id}</span>
                  ))}
               </div>
            </div>

            <div className="flex gap-4 border-t pt-4">
               <Button onClick={() => setSelectedTrip(null)} variant="secondary">Back</Button>
               {selectedTrip.status === TripStatus.CREATED && (
                  <Button onClick={handleDispatch} className="bg-purple-600 hover:bg-purple-700"><Truck className="h-4 w-4 mr-2" /> Dispatch Trip</Button>
               )}
            </div>
         </div>
      ) : (
         <Table<Trip>
            data={filteredTrips}
            columns={[
               { header: 'Trip Code', accessor: 'tripCode', className: 'font-mono font-bold' },
               { header: activeTab === 'OUTBOUND' ? 'Destination' : 'Origin', accessor: (t) => getEntityName(activeTab === 'OUTBOUND' ? t.destinationEntityId : t.originEntityId) },
               { header: 'Vehicle', accessor: 'vehicleNumber' },
               { header: 'Bags', accessor: (t) => t.bagIds.length },
               { header: 'Status', accessor: (t) => <span className={`px-2 py-1 rounded text-xs font-bold ${t.status === TripStatus.IN_TRANSIT ? 'bg-orange-100 text-orange-800' : 'bg-gray-100'}`}>{t.status}</span> },
            ]}
            actions={(t) => (
               activeTab === 'OUTBOUND' ? (
                  t.status === TripStatus.CREATED ? <button onClick={() => setSelectedTrip(t)} className="text-brand-600 font-bold hover:underline">Manage</button> : null
               ) : (
                  t.status === TripStatus.IN_TRANSIT ? <button onClick={() => handleReceiveTrip(t.id)} className="text-green-600 font-bold hover:underline flex items-center"><CheckCircle className="h-4 w-4 mr-1"/> Receive</button> : null
               )
            )}
         />
      )}

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Outbound Trip">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Destination MMDC</label>
               <select className="w-full border rounded p-2" value={newTripData.destId} onChange={e => setNewTripData({...newTripData, destId: e.target.value})}>
                  <option value="">Select Destination</option>
                  {destinations.filter(d => d.id !== currentMmdcId).map(d => (
                     <option key={d.id} value={d.id}>{d.name} ({d.city})</option>
                  ))}
               </select>
            </div>
            <Input label="Vehicle Number" value={newTripData.vehicle} onChange={e => setNewTripData({...newTripData, vehicle: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
               <Input label="Driver Name" value={newTripData.driver} onChange={e => setNewTripData({...newTripData, driver: e.target.value})} />
               <Input label="Driver Phone" value={newTripData.phone} onChange={e => setNewTripData({...newTripData, phone: e.target.value})} />
            </div>
            <Button onClick={handleCreateTrip}>Initialize Manifest</Button>
         </div>
      </Modal>

      {/* IMPORT MODAL */}
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Bulk Trip Import">
         <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
               <span className="text-sm font-bold text-gray-700">Template Required</span>
               <Button onClick={handleDownloadSample} variant="secondary" className="w-auto h-8 text-xs">
                  <FileSpreadsheet className="h-3 w-3 mr-2" /> Download Sample
               </Button>
            </div>
            
            <div>
               <label className="block text-sm font-medium mb-1">Paste CSV Data</label>
               <textarea 
                  className="w-full h-32 border rounded p-2 text-sm font-mono"
                  placeholder="Trip_ID, Bag_ID, Seal_No, Origin_DC..."
                  value={importContent}
                  onChange={e => setImportContent(e.target.value)}
               />
            </div>
            <Button onClick={handleImport} disabled={!importContent}>Process Import</Button>
         </div>
      </Modal>
    </Layout>
  );
};
