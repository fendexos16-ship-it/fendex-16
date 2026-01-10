import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { bagService } from '../../services/bagService';
import { masterDataService } from '../../services/masterDataService';
import { useAuth } from '../../context/AuthContext';
import { Bag, BagStatus, BagType, ExceptionType } from '../../types';
import { ShoppingBag, Lock, Plus, Scan, AlertTriangle, ArrowDownCircle } from 'lucide-react';

export const BagManager: React.FC = () => {
  const { user } = useAuth();
  const [bags, setBags] = useState<Bag[]>([]);
  const [activeBag, setActiveBag] = useState<Bag | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanInput, setScanInput] = useState('');
  
  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showSeal, setShowSeal] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showException, setShowException] = useState(false);

  // Forms
  const [createType, setCreateType] = useState<BagType>(BagType.OUTBOUND);
  const [createDest, setCreateDest] = useState('');
  const [destinations, setDestinations] = useState<any[]>([]);

  const [sealNumber, setSealNumber] = useState('');
  const [exceptionData, setExceptionData] = useState({ type: ExceptionType.SHORTAGE, desc: '', shipmentId: '' });

  // Assume user is linked to an MMDC. If Founder, need a selector (skipped for brevity, assuming linked)
  const currentMmdcId = user?.linkedEntityId || 'M1'; // Fallback for dev

  const loadData = async () => {
    setLoading(true);
    try {
      const [bagData, dcs, lmdcs] = await Promise.all([
        bagService.getBags(currentMmdcId),
        masterDataService.getDCs(),
        masterDataService.getLMDCs()
      ]);
      setBags(bagData);
      setDestinations([...dcs, ...lmdcs]);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  // Actions
  const handleCreateBag = async () => {
    if (!user) return;
    if (!createDest) {
        alert("Please select a destination");
        return;
    }
    try {
      await bagService.createBag(user, currentMmdcId, createType, createDest);
      setShowCreate(false);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleScanShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBag || !scanInput) return;
    try {
      await bagService.scanShipment(user!, activeBag.id, scanInput);
      setScanInput('');
      // Update local state to reflect count immediately
      const updated = await bagService.getBags(currentMmdcId);
      setBags(updated);
      setActiveBag(updated.find(b => b.id === activeBag.id) || null);
    } catch (e: any) { alert(e.message); setScanInput(''); }
  };

  const handleSealBag = async () => {
    if (!activeBag || !sealNumber) return;
    try {
      await bagService.sealBag(user!, activeBag.id, sealNumber);
      setShowSeal(false);
      setSealNumber('');
      setActiveBag(null);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleReceiveBag = async () => {
    if (!scanInput) return;
    try {
      // Input here acts as Bag Code scan
      await bagService.receiveBag(user!, scanInput);
      setShowReceive(false);
      setScanInput('');
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleOpenBag = async (bag: Bag) => {
    if (!confirm(`Open Bag ${bag.bagCode}? This allows scanning contents.`)) return;
    try {
      await bagService.openBag(user!, bag.id);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleException = async () => {
    if (!activeBag) return;
    try {
      await bagService.recordException(user!, {
        bagId: activeBag.id,
        type: exceptionData.type,
        shipmentId: exceptionData.shipmentId,
        description: exceptionData.desc
      });
      setShowException(false);
      // Reload bag to update counts
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ShoppingBag className="mr-3 h-8 w-8 text-brand-600" />
            Bag Operations
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage Inbound/Outbound Bagging at {currentMmdcId}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowReceive(true)} variant="secondary" className="w-auto">
            <ArrowDownCircle className="h-4 w-4 mr-2" /> Receive Inbound
          </Button>
          <Button onClick={() => setShowCreate(true)} className="w-auto">
            <Plus className="h-4 w-4 mr-2" /> Create Outbound
          </Button>
        </div>
      </div>

      {/* ACTIVE BAG WORKSPACE */}
      {activeBag && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-blue-900 flex items-center">
                Processing Bag: {activeBag.bagCode}
                <span className="ml-3 text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">{activeBag.type}</span>
              </h3>
              <p className="text-sm text-blue-700 mt-1">Status: {activeBag.status} | Count: {activeBag.actualCount}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowException(true)} variant="secondary" className="bg-white border-red-200 text-red-600 hover:bg-red-50 w-auto h-8 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" /> Log Issue
              </Button>
              <Button onClick={() => setShowSeal(true)} className="bg-blue-700 hover:bg-blue-800 w-auto h-8 text-xs">
                <Lock className="h-3 w-3 mr-1" /> Seal & Close
              </Button>
              <button onClick={() => setActiveBag(null)} className="text-blue-500 text-xs underline ml-2">Exit</button>
            </div>
          </div>

          <form onSubmit={handleScanShipment} className="flex gap-4">
            <Input 
              label="Scan Shipment AWB" 
              value={scanInput} 
              onChange={e => setScanInput(e.target.value)} 
              placeholder="Scan barcode..." 
              autoFocus
              className="bg-white"
            />
            <div className="pt-7">
              <Button type="submit" className="w-auto">Add to Bag</Button>
            </div>
          </form>
          
          <div className="mt-4">
             <p className="text-xs font-bold text-blue-800 uppercase mb-2">Contents ({activeBag.shipmentIds.length})</p>
             <div className="flex flex-wrap gap-2">
                {activeBag.shipmentIds.map(id => (
                   <span key={id} className="bg-white border border-blue-200 text-blue-800 px-2 py-1 rounded text-xs font-mono">{id}</span>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* BAG LIST */}
      <Table<Bag>
        data={bags}
        isLoading={loading}
        columns={[
          { header: 'Bag Code', accessor: 'bagCode', className: 'font-mono font-bold' },
          { header: 'Type', accessor: 'type' },
          { header: 'Status', accessor: (b) => <span className={`px-2 py-1 rounded text-xs font-bold ${b.status === BagStatus.SEALED ? 'bg-gray-200' : 'bg-green-100 text-green-800'}`}>{b.status}</span> },
          { header: 'Seal', accessor: (b) => b.sealNumber || '-' },
          { header: 'Items', accessor: 'actualCount' },
          { header: 'Exceptions', accessor: (b) => b.shortageCount > 0 || b.damageCount > 0 ? <span className="text-red-600 font-bold">{b.shortageCount + b.damageCount}</span> : '-' },
          { header: 'Updated', accessor: (b) => new Date(b.createdAt).toLocaleDateString() }
        ]}
        actions={(b) => (
           <div className="flex gap-2 justify-end">
              {b.status === BagStatus.CREATED && (
                 <button onClick={() => setActiveBag(b)} className="text-brand-600 font-bold text-xs hover:underline">Manage</button>
              )}
              {b.status === BagStatus.RECEIVED && (
                 <button onClick={() => handleOpenBag(b)} className="text-green-600 font-bold text-xs hover:underline">Open & Scan</button>
              )}
              {b.status === BagStatus.OPENED && (
                 <button onClick={() => setActiveBag(b)} className="text-blue-600 font-bold text-xs hover:underline">Process</button>
              )}
           </div>
        )}
      />

      {/* MODALS */}
      
      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Outbound Bag">
         <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Bag Type</label>
              <select className="w-full border rounded p-2" value={createType} onChange={e => setCreateType(e.target.value as BagType)}>
                 <option value={BagType.OUTBOUND}>Outbound (To Hub/MMDC)</option>
                 <option value={BagType.RTO}>RTO (Return)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Destination</label>
              <select className="w-full border rounded p-2" value={createDest} onChange={e => setCreateDest(e.target.value)}>
                 <option value="">Select Destination</option>
                 {destinations.filter(d => d.id !== currentMmdcId).map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.city})</option>
                 ))}
              </select>
            </div>
            <Button onClick={handleCreateBag}>Initialize Bag</Button>
         </div>
      </Modal>

      {/* Seal Modal */}
      <Modal isOpen={showSeal} onClose={() => setShowSeal(false)} title={`Seal Bag: ${activeBag?.bagCode}`}>
         <div className="space-y-4">
            <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
               <AlertTriangle className="h-4 w-4 inline mr-2" />
               Warning: Sealing is irreversible. Ensure all {activeBag?.actualCount} shipments are physically inside.
            </div>
            <Input 
               label="Seal Number (Scan or Type)" 
               value={sealNumber} 
               onChange={e => setSealNumber(e.target.value)} 
               autoFocus 
               placeholder="SL-123456"
            />
            <Button onClick={handleSealBag}>Confirm Seal</Button>
         </div>
      </Modal>

      {/* Receive Modal */}
      <Modal isOpen={showReceive} onClose={() => setShowReceive(false)} title="Receive Inbound Bag">
         <div className="space-y-4">
            <Input 
               label="Scan Bag Code" 
               value={scanInput} 
               onChange={e => setScanInput(e.target.value)} 
               autoFocus 
               placeholder="BAG-..."
            />
            <Button onClick={handleReceiveBag}>Receive</Button>
         </div>
      </Modal>

      {/* Exception Modal */}
      <Modal isOpen={showException} onClose={() => setShowException(false)} title="Log Exception">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Issue Type</label>
               <select className="w-full border rounded p-2" value={exceptionData.type} onChange={e => setExceptionData({...exceptionData, type: e.target.value as ExceptionType})}>
                  <option value={ExceptionType.SHORTAGE}>Shortage (Item Missing)</option>
                  <option value={ExceptionType.DAMAGE}>Damage (Physical Issue)</option>
                  <option value={ExceptionType.EXCESS}>Excess (Extra Item)</option>
               </select>
            </div>
            <Input 
               label="Shipment AWB (Optional)" 
               value={exceptionData.shipmentId} 
               onChange={e => setExceptionData({...exceptionData, shipmentId: e.target.value})} 
            />
            <div>
               <label className="block text-sm font-medium mb-1">Description</label>
               <textarea className="w-full border rounded p-2 h-20" value={exceptionData.desc} onChange={e => setExceptionData({...exceptionData, desc: e.target.value})} />
            </div>
            <Button onClick={handleException} variant="danger">Record Exception</Button>
         </div>
      </Modal>

    </Layout>
  );
};