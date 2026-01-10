
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { connectionSheetService } from '../../services/connectionSheetService';
import { bagService } from '../../services/bagService';
import { masterDataService } from '../../services/masterDataService';
import { useAuth } from '../../context/AuthContext';
import { ConnectionSheet, Bag, BagStatus } from '../../types';
import { Layers, Plus, Lock, ArrowRight, Box, AlertOctagon } from 'lucide-react';

export const MMDCConnection: React.FC = () => {
  const { user } = useAuth();
  const [sheets, setSheets] = useState<ConnectionSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState<ConnectionSheet | null>(null);
  
  // Selection Data
  const [destinations, setDestinations] = useState<{id: string, name: string, type: string}[]>([]);
  
  // Forms
  const [createDest, setCreateDest] = useState('');
  const [createType, setCreateType] = useState<'LMDC' | 'DC' | 'MMDC' | 'RTO'>('LMDC');
  const [scanBag, setScanBag] = useState('');
  const [error, setError] = useState('');

  const currentMmdcId = user?.linkedEntityId || 'M1';

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    const sData = await connectionSheetService.getSheets(currentMmdcId);
    // Show active sheets (CREATED or IN_PROGRESS)
    setSheets(sData.filter(s => s.status === 'CREATED' || s.status === 'IN_PROGRESS'));
    
    const [dcs, mmdcs, lmdcs] = await Promise.all([
       masterDataService.getDCs(),
       masterDataService.getMMDCs(),
       masterDataService.getLMDCs()
    ]);

    const combined = [
       ...dcs.map(d => ({ id: d.id, name: d.name, type: 'DC' })),
       ...mmdcs.map(m => ({ id: m.id, name: m.name, type: 'MMDC' })),
       ...lmdcs.map(l => ({ id: l.id, name: l.name, type: 'LMDC' }))
    ];
    setDestinations(combined);
  };

  const handleCreate = async () => {
     if (!createDest) return;
     // Infer type from selection if possible or use state
     const selected = destinations.find(d => d.id === createDest);
     const type = selected?.type || createType;

     try {
        await connectionSheetService.create(user!, currentMmdcId, createDest, type as any);
        setCreateDest('');
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleScan = async (e: React.FormEvent) => {
     e.preventDefault();
     setError('');
     if (!activeSheet || !scanBag) return;
     
     try {
        await connectionSheetService.addBag(user!, activeSheet.id, scanBag);
        setScanBag('');
        // Refresh sheet
        const updated = await connectionSheetService.getSheets(currentMmdcId);
        setActiveSheet(updated.find(s => s.id === activeSheet.id) || null);
     } catch(e:any) { setError(e.message); }
  };

  const handleClose = async () => {
     if (!activeSheet) return;
     if (!confirm("Close Connection Sheet? It will be ready for Outbound and bags will be LOCKED.")) return;
     try {
        await connectionSheetService.close(user!, activeSheet.id);
        setActiveSheet(null);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const getDestName = (id: string) => destinations.find(d => d.id === id)?.name || id;

  // Filter destinations based on selected type
  const filteredDestinations = destinations.filter(d => {
     if (createType === 'LMDC') return d.type === 'LMDC';
     if (createType === 'DC') return d.type === 'DC';
     if (createType === 'MMDC') return d.type === 'MMDC';
     return true;
  });

  return (
    <Layout>
      <div className="mb-6">
         <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Layers className="mr-3 h-8 w-8 text-brand-600" />
            Sorting & Connection
         </h1>
         <p className="text-sm text-gray-500 mt-1">Hard Routing Mode: Connect Bags to Unique Destinations</p>
      </div>

      {!activeSheet ? (
         <div className="space-y-6">
            <div className="bg-white p-6 rounded border border-gray-200 shadow-sm">
               <h3 className="text-lg font-bold text-gray-900 mb-4">Start New Routing</h3>
               <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="w-full md:w-1/4">
                     <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Destination Type</label>
                     <select className="w-full border rounded p-2 text-sm" value={createType} onChange={e => setCreateType(e.target.value as any)}>
                        <option value="LMDC">LMDC (Last Mile)</option>
                        <option value="MMDC">MMDC (Hub Transfer)</option>
                        <option value="DC">Regional DC</option>
                        <option value="RTO">RTO Center</option>
                     </select>
                  </div>
                  <div className="flex-1">
                     <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Destination Center</label>
                     <select className="w-full border rounded p-2 text-sm" value={createDest} onChange={e => setCreateDest(e.target.value)}>
                        <option value="">Select Target...</option>
                        {filteredDestinations.map(d => (
                           <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
                        ))}
                     </select>
                  </div>
                  <Button onClick={handleCreate} className="w-auto h-[38px] px-6"><Plus className="h-4 w-4 mr-2" /> Start Sheet</Button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {sheets.map(s => (
                  <div key={s.id} onClick={() => setActiveSheet(s)} className="bg-white p-4 rounded border border-brand-200 shadow-sm cursor-pointer hover:border-brand-400 transition-colors group">
                     <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-xs text-gray-500 font-bold">{s.code}</span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${s.status === 'CREATED' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                           {s.status.replace('_', ' ')}
                        </span>
                     </div>
                     <h4 className="font-bold text-lg text-gray-900 group-hover:text-brand-600">{getDestName(s.destinationId)}</h4>
                     <p className="text-xs text-gray-500 mt-1">{s.destinationType} Routing</p>
                     <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="flex items-center text-gray-600"><Box className="h-4 w-4 mr-1" /> {s.bagIds.length} Bags</span>
                        <ArrowRight className="h-4 w-4 text-brand-400" />
                     </div>
                  </div>
               ))}
            </div>
         </div>
      ) : (
         <div className="space-y-6">
            <div className="bg-white p-6 rounded border border-gray-200 shadow-sm">
               <div className="flex justify-between items-start mb-6">
                  <div>
                     <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-900">{activeSheet.code}</h2>
                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">{activeSheet.status}</span>
                     </div>
                     <p className="text-gray-500 mt-1">Routing to: <strong className="text-brand-700">{getDestName(activeSheet.destinationId)}</strong> ({activeSheet.destinationType})</p>
                  </div>
                  <div className="flex gap-2">
                     <Button onClick={handleClose} className="bg-gray-900 hover:bg-black w-auto shadow-lg" disabled={activeSheet.bagIds.length === 0}>
                        <Lock className="h-4 w-4 mr-2" /> Close & Lock
                     </Button>
                     <button onClick={() => setActiveSheet(null)} className="text-gray-500 hover:text-gray-800 underline ml-2 text-sm">Exit</button>
                  </div>
               </div>

               <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-6">
                  <form onSubmit={handleScan} className="flex gap-4 items-end">
                     <div className="flex-1">
                        <label className="block text-xs font-bold uppercase text-blue-800 mb-1">Add Bag to Sheet</label>
                        <Input 
                           label=""
                           value={scanBag} 
                           onChange={e => setScanBag(e.target.value)} 
                           placeholder="Scan Bag Code..." 
                           autoFocus
                           className="bg-white mb-0"
                        />
                     </div>
                     <Button type="submit" className="w-auto h-[42px] mb-[1px]">Connect Bag</Button>
                  </form>
                  {error && (
                     <div className="mt-3 flex items-center text-red-600 text-sm font-medium bg-white p-2 rounded border border-red-100">
                        <AlertOctagon className="h-4 w-4 mr-2" /> {error}
                     </div>
                  )}
               </div>

               <div className="bg-gray-50 p-4 rounded">
                  <h4 className="font-bold text-gray-700 mb-3 flex items-center">
                     <Box className="h-4 w-4 mr-2" /> Connected Bags ({activeSheet.bagIds.length})
                  </h4>
                  {activeSheet.bagIds.length === 0 ? (
                     <p className="text-sm text-gray-400 italic">No bags connected yet.</p>
                  ) : (
                     <div className="flex flex-wrap gap-2">
                        {activeSheet.bagIds.map(b => (
                           <span key={b} className="bg-white border border-green-200 text-green-800 px-3 py-1.5 rounded text-sm font-mono flex items-center shadow-sm">
                              <CheckCircleIcon className="h-3 w-3 mr-2" /> {b}
                           </span>
                        ))}
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}
    </Layout>
  );
};

const CheckCircleIcon = ({className}: {className?: string}) => (
   <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
   </svg>
);
