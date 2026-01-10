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
import { ShoppingBag, Lock, Plus, Scan, AlertTriangle, ArrowDownCircle, ArrowLeft, Camera, CheckSquare } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const BagOperations: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [view, setView] = useState<'LIST' | 'DETAIL'>('LIST');
  const [tab, setTab] = useState<'INBOUND' | 'OUTBOUND'>('OUTBOUND');
  
  // Data
  const [bags, setBags] = useState<Bag[]>([]);
  const [activeBag, setActiveBag] = useState<Bag | null>(null);
  const [destinations, setDestinations] = useState<any[]>([]);
  
  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [newBagData, setNewBagData] = useState({ type: BagType.OUTBOUND, destId: '' });

  // Detail View State
  const [scanAwb, setScanAwb] = useState('');
  const [sealInput, setSealInput] = useState('');
  
  // Exception Modal
  const [showException, setShowException] = useState(false);
  const [exceptionData, setExceptionData] = useState({ type: ExceptionType.SHORTAGE, desc: '', shipmentId: '' });

  const currentMmdcId = user?.linkedEntityId || 'M1';

  const loadData = async () => {
    const allBags = await bagService.getBags(currentMmdcId);
    setBags(allBags);
    
    // Load Dest Options (DCs and LMDCs)
    const dcs = await masterDataService.getDCs();
    const lmdcs = await masterDataService.getLMDCs();
    setDestinations([...dcs, ...lmdcs]);
  };

  useEffect(() => { loadData(); }, [user]);

  // Initial Tab logic
  useEffect(() => {
     const params = new URLSearchParams(location.search);
     const t = params.get('tab');
     if (t === 'INBOUND') setTab('INBOUND');
  }, [location]);

  // --- Handlers ---

  const handleCreateBag = async () => {
    if (!newBagData.destId) return alert("Select Destination");
    try {
      await bagService.createBag(user!, currentMmdcId, newBagData.type, newBagData.destId);
      setShowCreate(false);
      loadData();
    } catch(e:any) { alert(e.message); }
  };

  const handleOpenDetail = (bag: Bag) => {
    setActiveBag(bag);
    setView('DETAIL');
  };

  const handleScanShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBag || !scanAwb) return;
    
    try {
       if (activeBag.type === BagType.OUTBOUND) {
          // Add to Bag
          await bagService.scanShipment(user!, activeBag.id, scanAwb);
       } else {
          // Verify Inbound
          const ok = await bagService.verifyShipmentScan(activeBag.id, scanAwb);
          if (!ok) alert("Unexpected Item or Duplicate Scan!");
       }
       // Refresh local state
       const updatedBags = await bagService.getBags(currentMmdcId);
       const updatedActive = updatedBags.find(b => b.id === activeBag.id);
       setActiveBag(updatedActive || null);
       setBags(updatedBags);
       setScanAwb('');
    } catch(e:any) { alert(e.message); }
  };

  const handleSealBag = async () => {
     if (!activeBag || !sealInput) return;
     if (!confirm("Confirm Seal? This is irreversible.")) return;
     try {
        await bagService.sealBag(user!, activeBag.id, sealInput);
        setView('LIST');
        setActiveBag(null);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleReceiveBag = async (code: string) => {
     try {
        await bagService.receiveBag(user!, code);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleRecordException = async () => {
     if (!activeBag) return;
     try {
        await bagService.recordException(user!, {
           bagId: activeBag.id,
           type: exceptionData.type,
           shipmentId: exceptionData.shipmentId,
           description: exceptionData.desc
        });
        setShowException(false);
        // Refresh
        const updatedBags = await bagService.getBags(currentMmdcId);
        setActiveBag(updatedBags.find(b => b.id === activeBag.id) || null);
        setBags(updatedBags);
     } catch(e:any) { alert(e.message); }
  };

  const filteredBags = bags.filter(b => {
     if (tab === 'INBOUND') return b.destinationEntityId === currentMmdcId;
     return b.originEntityId === currentMmdcId; // Corrected sourceEntityId -> originEntityId
  });

  return (
    <Layout>
      {view === 'LIST' && (
        <>
          <div className="mb-6 flex justify-between items-center">
             <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <ShoppingBag className="mr-3 h-8 w-8 text-brand-600" /> Bag Operations
             </h1>
             <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setTab('OUTBOUND')} className={`px-4 py-2 text-sm font-medium rounded-md ${tab === 'OUTBOUND' ? 'bg-white shadow text-brand-600' : 'text-gray-500'}`}>Outbound</button>
                <button onClick={() => setTab('INBOUND')} className={`px-4 py-2 text-sm font-medium rounded-md ${tab === 'INBOUND' ? 'bg-white shadow text-brand-600' : 'text-gray-500'}`}>Inbound</button>
             </div>
          </div>

          <div className="mb-4 flex justify-end">
             {tab === 'OUTBOUND' ? (
                <Button onClick={() => setShowCreate(true)} className="w-auto"><Plus className="h-4 w-4 mr-2" /> New Outbound Bag</Button>
             ) : (
                <div className="flex gap-2">
                   <Input 
                      label="" 
                      placeholder="Scan Bag Code to Receive..." 
                      className="w-64 mb-0" 
                      onKeyDown={(e) => { if(e.key === 'Enter') { handleReceiveBag(e.currentTarget.value); e.currentTarget.value = ''; }}} 
                   />
                </div>
             )}
          </div>

          <Table<Bag>
             data={filteredBags}
             columns={[
                { header: 'Bag Code', accessor: 'bagCode', className: 'font-mono font-bold' },
                { header: 'Type', accessor: 'type' },
                { header: tab === 'INBOUND' ? 'Source' : 'Destination', accessor: (b) => tab === 'INBOUND' ? b.originEntityId : b.destinationEntityId },
                { header: 'Status', accessor: 'status' },
                { header: 'Exp / Act', accessor: (b) => `${b.manifestCount} / ${b.actualCount}` }, // Corrected expectedCount -> manifestCount
                { header: 'Exceptions', accessor: (b) => b.shortageCount + b.damageCount > 0 ? <span className="text-red-600 font-bold">{b.shortageCount + b.damageCount}</span> : '-' }
             ]}
             actions={(b) => (
                <div className="flex gap-2 justify-end">
                   {b.status === BagStatus.CREATED && (
                      <button onClick={() => setActiveBag(b)} className="text-brand-600 font-bold text-xs hover:underline">Manage</button>
                   )}
                   {b.status === BagStatus.RECEIVED && (
                      <button onClick={() => handleOpenDetail(b)} className="text-green-600 font-bold text-xs hover:underline">Open & Scan</button>
                   )}
                   {b.status === BagStatus.OPENED && (
                      <button onClick={() => setActiveBag(b)} className="text-blue-600 font-bold text-xs hover:underline">Process</button>
                   )}
                </div>
             )}
          />
        </>
      )}

      {view === 'DETAIL' && activeBag && (
         <div className="max-w-4xl mx-auto">
            <button onClick={() => setView('LIST')} className="flex items-center text-gray-500 hover:text-gray-900 mb-4">
               <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
            </button>

            {/* HEADER */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-6">
               <div className="flex justify-between items-start">
                  <div>
                     <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                        {activeBag.bagCode}
                        <span className="ml-3 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{activeBag.status}</span>
                     </h2>
                     <p className="text-sm text-gray-500 mt-1">
                        {activeBag.type} | From: {activeBag.originEntityId} &rarr; To: {activeBag.destinationEntityId}
                     </p>
                  </div>
                  <div className="text-right">
                     <p className="text-sm text-gray-500">Seal No</p>
                     <p className="font-mono font-bold text-lg">{activeBag.sealNumber || '---'}</p>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               
               {/* VERIFICATION PANEL */}
               <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <h3 className="font-bold text-blue-900 mb-4 flex items-center"><Scan className="h-5 w-5 mr-2" /> Shipment Scanner</h3>
                  
                  {activeBag.status === BagStatus.RECEIVED && (
                     <div className="text-center py-8">
                        <p className="text-blue-800 mb-4">Bag must be opened to verify contents.</p>
                        <Button onClick={() => bagService.openBag(user!, activeBag.id).then(loadData).then(() => setView('LIST'))}>
                           Open Bag
                        </Button>
                     </div>
                  )}

                  {(activeBag.status === BagStatus.OPENED || activeBag.status === BagStatus.CREATED) && (
                     <>
                        <form onSubmit={handleScanShipment}>
                           <Input 
                              label="Scan AWB" 
                              value={scanAwb} 
                              onChange={e => setScanAwb(e.target.value)} 
                              autoFocus 
                              placeholder="Scan barcode..."
                              className="bg-white"
                           />
                        </form>
                        <div className="flex justify-between items-center mt-4 bg-white p-3 rounded">
                           <div className="text-center w-1/3">
                              <p className="text-xs text-gray-500 uppercase">Expected</p>
                              <p className="text-xl font-bold">{activeBag.manifestCount}</p>
                           </div>
                           <div className="text-center w-1/3 border-l border-gray-200">
                              <p className="text-xs text-gray-500 uppercase">Scanned</p>
                              <p className="text-xl font-bold text-blue-600">{activeBag.actualCount}</p>
                           </div>
                           <div className="text-center w-1/3 border-l border-gray-200">
                              <p className="text-xs text-gray-500 uppercase">Diff</p>
                              <p className={`text-xl font-bold ${activeBag.actualCount !== activeBag.manifestCount ? 'text-red-500' : 'text-green-500'}`}>
                                 {activeBag.actualCount - activeBag.manifestCount}
                              </p>
                           </div>
                        </div>
                     </>
                  )}
                  
                  {[BagStatus.SEALED, BagStatus.DISPATCHED].includes(activeBag.status) && (
                     <p className="text-center text-gray-500 py-4 italic">Bag is sealed. Scanning disabled.</p>
                  )}
               </div>

               {/* EXCEPTION & SEAL PANEL */}
               <div className="space-y-6">
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900 flex items-center"><AlertTriangle className="h-5 w-5 mr-2 text-orange-500" /> Exceptions</h3>
                        {(activeBag.status === BagStatus.OPENED || activeBag.status === BagStatus.CREATED) && (
                           <Button onClick={() => setShowException(true)} variant="secondary" className="w-auto h-8 text-xs text-red-600 border-red-200 hover:bg-red-50">
                              + Report
                           </Button>
                        )}
                     </div>
                     <div className="text-sm text-gray-600">
                        <p>Shortages: <span className="font-bold">{activeBag.shortageCount}</span></p>
                        <p>Damages: <span className="font-bold">{activeBag.damageCount}</span></p>
                     </div>
                  </div>

                  {(activeBag.status === BagStatus.OPENED || activeBag.status === BagStatus.CREATED) && (
                     <div className="bg-gray-900 p-6 rounded-lg text-white">
                        <h3 className="font-bold mb-4 flex items-center"><Lock className="h-5 w-5 mr-2" /> Finalize Bag</h3>
                        <p className="text-xs text-gray-400 mb-3">Ensure all physical items are inside and sealed.</p>
                        <Input 
                           label="Seal Number" 
                           value={sealInput} 
                           onChange={e => setSealInput(e.target.value)} 
                           placeholder="Scan Seal..." 
                           className="text-gray-900"
                        />
                        <Button onClick={handleSealBag} className="bg-green-600 hover:bg-green-700">
                           {activeBag.type === 'INBOUND' ? 'Close & Re-Seal' : 'Seal for Dispatch'}
                        </Button>
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

      {/* MODALS */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Outbound Bag">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Bag Type</label>
               <select className="w-full border rounded p-2" value={newBagData.type} onChange={e => setNewBagData({...newBagData, type: e.target.value as BagType})}>
                  <option value={BagType.OUTBOUND}>Outbound (Regular)</option>
                  <option value={BagType.RTO}>RTO (Return)</option>
               </select>
            </div>
            <div>
               <label className="block text-sm font-medium mb-1">Destination</label>
               <select className="w-full border rounded p-2" value={newBagData.destId} onChange={e => setNewBagData({...newBagData, destId: e.target.value})}>
                  <option value="">Select Destination</option>
                  {destinations.filter(d => d.id !== currentMmdcId).map(d => (
                     <option key={d.id} value={d.id}>{d.name} ({d.city})</option>
                  ))}
               </select>
            </div>
            <Button onClick={handleCreateBag}>Initialize Bag</Button>
         </div>
      </Modal>

      <Modal isOpen={showException} onClose={() => setShowException(false)} title="Log Exception">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Issue Type</label>
               <select className="w-full border rounded p-2" value={exceptionData.type} onChange={e => setExceptionData({...exceptionData, type: e.target.value as ExceptionType})}>
                  <option value={ExceptionType.SHORTAGE}>Shortage</option>
                  <option value={ExceptionType.DAMAGE}>Damage</option>
                  <option value={ExceptionType.EXCESS}>Excess</option>
               </select>
            </div>
            <Input label="AWB (Optional)" value={exceptionData.shipmentId} onChange={e => setExceptionData({...exceptionData, shipmentId: e.target.value})} />
            <Input label="Description / Reason" value={exceptionData.desc} onChange={e => setExceptionData({...exceptionData, desc: e.target.value})} required />
            <div className="border border-dashed border-gray-300 rounded p-4 text-center text-gray-500">
               <Camera className="h-6 w-6 mx-auto mb-2" />
               <p className="text-xs">Photo Upload Required (Simulated)</p>
            </div>
            <Button onClick={handleRecordException} variant="danger">Confirm Exception</Button>
         </div>
      </Modal>

    </Layout>
  );
};