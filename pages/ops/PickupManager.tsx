
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { pickupService } from '../../services/pickupService';
import { masterDataService } from '../../services/masterDataService';
import { clientService } from '../../services/clientService';
import { useAuth } from '../../context/AuthContext';
import { PickupRequest, PickupStatus, Client, RiderProfile } from '../../types';
import { Truck, Plus, User } from 'lucide-react';

export const PickupManager: React.FC = () => {
  const { user } = useAuth();
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [newPickup, setNewPickup] = useState({ clientId: '', address: '', count: 0 });
  
  // Assign Modal
  const [showAssign, setShowAssign] = useState(false);
  const [selectedPickup, setSelectedPickup] = useState<PickupRequest | null>(null);
  const [selectedRider, setSelectedRider] = useState('');

  const currentLmdcId = user?.linkedEntityId || 'LM1';

  const loadData = async () => {
    setLoading(true);
    const [pData, cData, rData] = await Promise.all([
      pickupService.getPickups(currentLmdcId),
      clientService.getClients(),
      masterDataService.getRiders()
    ]);
    setPickups(pData);
    setClients(cData);
    // Filter riders for this LMDC
    setRiders(rData.filter(r => r.linkedLmdcId === currentLmdcId && r.status === 'Active'));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleCreate = async () => {
    if (!newPickup.clientId) return alert('Select Client');
    try {
      await pickupService.createPickup(user!, {
        lmdcId: currentLmdcId,
        clientId: newPickup.clientId,
        address: newPickup.address,
        expectedCount: newPickup.count
      });
      setShowCreate(false);
      loadData();
    } catch(e: any) { alert(e.message); }
  };

  const handleAssign = async () => {
    if (!selectedPickup || !selectedRider) return;
    try {
      await pickupService.assignRider(user!, selectedPickup.id, selectedRider);
      setShowAssign(false);
      loadData();
    } catch(e: any) { alert(e.message); }
  };

  const handleMarkPicked = async (id: string) => {
    if (!confirm('Mark as Picked? Ensure Rider has physically collected goods.')) return;
    try {
      await pickupService.markPicked(user!, id);
      loadData();
    } catch(e: any) { alert(e.message); }
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || id;
  const getRiderName = (id?: string) => riders.find(r => r.id === id)?.name || '-';

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
           <Truck className="mr-3 h-8 w-8 text-brand-600" /> First Mile Pickups
        </h1>
        <Button onClick={() => setShowCreate(true)} className="w-auto">
           <Plus className="h-4 w-4 mr-2" /> Schedule Pickup
        </Button>
      </div>

      <Table<PickupRequest>
        data={pickups}
        isLoading={loading}
        columns={[
           { header: 'ID', accessor: 'id', className: 'font-mono font-bold' },
           { header: 'Client', accessor: (p) => getClientName(p.clientId) },
           { header: 'Expected', accessor: 'expectedCount' },
           { header: 'Rider', accessor: (p) => getRiderName(p.assignedRiderId) },
           { header: 'Status', accessor: (p) => <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'PICKED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status}</span> },
           { header: 'Date', accessor: (p) => new Date(p.createdAt).toLocaleDateString() }
        ]}
        actions={(p) => (
           <div className="flex gap-2 justify-end">
              {p.status === 'SCHEDULED' && (
                 <button onClick={() => { setSelectedPickup(p); setShowAssign(true); }} className="text-blue-600 font-bold text-xs hover:underline">Assign Rider</button>
              )}
              {p.status === 'ASSIGNED' && (
                 <button onClick={() => handleMarkPicked(p.id)} className="text-green-600 font-bold text-xs hover:underline">Mark Picked</button>
              )}
           </div>
        )}
      />

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Pickup Request">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Client</label>
               <select className="w-full border rounded p-2" value={newPickup.clientId} onChange={e => setNewPickup({...newPickup, clientId: e.target.value})}>
                  <option value="">Select Client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
            </div>
            <Input label="Pickup Address" value={newPickup.address} onChange={e => setNewPickup({...newPickup, address: e.target.value})} />
            <Input label="Expected Count" type="number" value={newPickup.count} onChange={e => setNewPickup({...newPickup, count: parseInt(e.target.value)})} />
            <Button onClick={handleCreate}>Create Request</Button>
         </div>
      </Modal>

      {/* ASSIGN MODAL */}
      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Assign Rider">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Available Riders</label>
               <select className="w-full border rounded p-2" value={selectedRider} onChange={e => setSelectedRider(e.target.value)}>
                  <option value="">Select Rider</option>
                  {riders.map(r => <option key={r.id} value={r.id}>{r.name} ({r.phone})</option>)}
               </select>
            </div>
            <Button onClick={handleAssign}>Confirm Assignment</Button>
         </div>
      </Modal>
    </Layout>
  );
};
