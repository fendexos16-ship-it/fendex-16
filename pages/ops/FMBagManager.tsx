
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { bagService } from '../../services/bagService';
import { masterDataService } from '../../services/masterDataService';
import { useAuth } from '../../context/AuthContext';
import { Bag, BagStatus, BagType, ExceptionType, MMDC } from '../../types';
import { ShoppingBag, Lock, Plus, Scan, AlertTriangle, ArrowRightCircle } from 'lucide-react';

export const FMBagManager: React.FC = () => {
  const { user } = useAuth();
  const [bags, setBags] = useState<Bag[]>([]);
  const [activeBag, setActiveBag] = useState<Bag | null>(null);
  const [mmdcs, setMmdcs] = useState<MMDC[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanInput, setScanInput] = useState('');
  
  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showSeal, setShowSeal] = useState(false);
  const [showException, setShowException] = useState(false);

  // Forms
  const [destMmdc, setDestMmdc] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [exceptionData, setExceptionData] = useState({ type: ExceptionType.SHORTAGE, desc: '', shipmentId: '' });

  const currentLmdcId = user?.linkedEntityId || 'LM1';

  const loadData = async () => {
    setLoading(true);
    const [bagData, mmdcData] = await Promise.all([
      bagService.getBags(currentLmdcId),
      masterDataService.getMMDCs()
    ]);
    setBags(bagData.filter(b => b.type === BagType.FIRST_MILE));
    setMmdcs(mmdcData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  // Actions
  const handleCreateBag = async () => {
    if (!destMmdc) return alert("Select Parent MMDC");
    try {
      await bagService.createBag(user!, currentLmdcId, BagType.FIRST_MILE, destMmdc);
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
      const updated = await bagService.getBags(currentLmdcId);
      setBags(updated.filter(b => b.type === BagType.FIRST_MILE));
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
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
           <ShoppingBag className="mr-3 h-8 w-8 text-brand-600" /> First Mile Bagging
        </h1>
        <Button onClick={() => setShowCreate(true)} className="w-auto">
           <Plus className="h-4 w-4 mr-2" /> New FM Bag
        </Button>
      </div>

      {activeBag && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-blue-900 flex items-center">
                Processing Bag: {activeBag.bagCode}
                <span className="ml-3 text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">To: {mmdcs.find(m => m.id === activeBag.destinationEntityId)?.name}</span>
              </h3>
              <p className="text-sm text-blue-700 mt-1">Status: {activeBag.status} | Items: {activeBag.actualCount}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowException(true)} variant="secondary" className="w-auto h-8 text-xs text-red-600 border-red-200">
                <AlertTriangle className="h-3 w-3 mr-1" /> Exception
              </Button>
              <Button onClick={() => setShowSeal(true)} className="w-auto h-8 text-xs bg-blue-700">
                <Lock className="h-3 w-3 mr-1" /> Seal Bag
              </Button>
              <button onClick={() => setActiveBag(null)} className="text-blue-500 text-xs underline ml-2">Exit</button>
            </div>
          </div>

          <form onSubmit={handleScanShipment} className="flex gap-4">
            <Input 
              label="Scan AWB" 
              value={scanInput} 
              onChange={e => setScanInput(e.target.value)} 
              placeholder="Scan picked shipment..." 
              autoFocus
              className="bg-white"
            />
            <div className="pt-7">
              <Button type="submit" className="w-auto">Add</Button>
            </div>
          </form>
          
          <div className="mt-4">
             <p className="text-xs font-bold text-blue-800 uppercase mb-2">Contents</p>
             <div className="flex flex-wrap gap-2">
                {activeBag.shipmentIds.map(id => (
                   <span key={id} className="bg-white border border-blue-200 text-blue-800 px-2 py-1 rounded text-xs font-mono">{id}</span>
                ))}
             </div>
          </div>
        </div>
      )}

      <Table<Bag>
        data={bags}
        isLoading={loading}
        columns={[
           { header: 'Bag Code', accessor: 'bagCode', className: 'font-mono font-bold' },
           { header: 'To MMDC', accessor: (b) => mmdcs.find(m => m.id === b.destinationEntityId)?.name || b.destinationEntityId },
           { header: 'Status', accessor: 'status' },
           { header: 'Count', accessor: 'actualCount' },
           { header: 'Seal', accessor: (b) => b.sealNumber || '-' }
        ]}
        actions={(b) => (
           <div className="flex justify-end">
              {(b.status === BagStatus.CREATED || b.status === BagStatus.OPENED) && (
                 <button onClick={() => setActiveBag(b)} className="text-brand-600 font-bold text-xs hover:underline">Manage</button>
              )}
           </div>
        )}
      />

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create First-Mile Bag">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Destination MMDC</label>
               <select className="w-full border rounded p-2" value={destMmdc} onChange={e => setDestMmdc(e.target.value)}>
                  <option value="">Select MMDC</option>
                  {mmdcs.map(m => <option key={m.id} value={m.id}>{m.name} ({m.city})</option>)}
               </select>
            </div>
            <Button onClick={handleCreateBag}>Initialize Bag</Button>
         </div>
      </Modal>

      {/* SEAL MODAL */}
      <Modal isOpen={showSeal} onClose={() => setShowSeal(false)} title="Seal Bag">
         <div className="space-y-4">
            <Input label="Seal Number" value={sealNumber} onChange={e => setSealNumber(e.target.value)} autoFocus />
            <Button onClick={handleSealBag}>Confirm Seal</Button>
         </div>
      </Modal>

      {/* EXCEPTION MODAL */}
      <Modal isOpen={showException} onClose={() => setShowException(false)} title="Log Exception">
         <div className="space-y-4">
            <select className="w-full border rounded p-2" value={exceptionData.type} onChange={e => setExceptionData({...exceptionData, type: e.target.value as any})}>
               <option value={ExceptionType.SHORTAGE}>Shortage</option>
               <option value={ExceptionType.DAMAGE}>Damage</option>
            </select>
            <Input label="Description" value={exceptionData.desc} onChange={e => setExceptionData({...exceptionData, desc: e.target.value})} />
            <Button onClick={handleException} variant="danger">Record</Button>
         </div>
      </Modal>
    </Layout>
  );
};
