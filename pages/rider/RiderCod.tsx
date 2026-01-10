
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { codService } from '../../services/codService';
import { masterDataService } from '../../services/masterDataService';
import { CodRecord, CodState, CashHandoverBatch, HandoverStatus } from '../../types';
import { Banknote, ArrowUpRight, History, CheckCircle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';

export const RiderCod: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<CodRecord[]>([]);
  const [cashOnHand, setCashOnHand] = useState(0);
  const [pendingHandoverCount, setPendingHandoverCount] = useState(0);
  const [lmdcName, setLmdcName] = useState('');
  
  // Handover Modal
  const [showHandover, setShowHandover] = useState(false);

  const loadData = async () => {
    if (!user) return;
    
    // 1. Get Shipments Level History (CCRs)
    const records = await codService.getRiderHistory(user.id);
    setHistory(records.sort((a,b) => new Date(b.collectedAt || 0).getTime() - new Date(a.collectedAt || 0).getTime()));
    
    // 2. Calc Cash in Hand (Only Collected, Not Handed Over)
    const pendingRecords = records.filter(r => r.state === CodState.COD_COLLECTED);
    const amount = pendingRecords.reduce((sum, r) => sum + r.codAmount, 0);
    setCashOnHand(amount);
    setPendingHandoverCount(pendingRecords.length);

    // Get LMDC Name
    if (user.linkedEntityId) {
       const lmdcs = await masterDataService.getLMDCs();
       const lmdc = lmdcs.find(l => l.id === user.linkedEntityId);
       if(lmdc) setLmdcName(lmdc.name);
    }
  };

  useEffect(() => { loadData(); }, [user]);

  const handleHandover = async () => {
     if (cashOnHand === 0) return;
     
     // STRICT: No partial handover. All PENDING are selected.
     try {
        const pendingIds = history.filter(r => r.state === CodState.COD_COLLECTED).map(r => r.id);
        await codService.createHandoverBatch(user!, pendingIds);
        
        setShowHandover(false);
        loadData();
        alert("Batch Created. Handover Physical Cash to Station Manager.");
     } catch(e:any) { alert(e.message); }
  };

  // Group History by Batches or Status
  const pendingVerification = history.filter(r => r.state === CodState.COD_HANDOVER_INITIATED);
  
  // Calculate Pending Verification Amount
  const pendingAmount = pendingVerification.reduce((sum, r) => sum + r.codAmount, 0);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
           <Banknote className="mr-3 h-8 w-8 text-brand-600" /> Cash Summary
        </h1>
        <p className="text-sm text-gray-500">Track collections and handovers</p>
      </div>

      {/* SCREEN 3: CASH SUMMARY (READ-ONLY) */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 rounded-2xl p-6 text-white shadow-xl mb-6 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck className="h-32 w-32 text-white" />
         </div>
         
         <div className="relative z-10">
            <p className="text-brand-100 text-xs font-bold uppercase tracking-wider mb-1">Total Liability (Cash in Hand)</p>
            <div className="flex items-baseline gap-2 mb-4">
               <span className="text-4xl font-extrabold">₹{cashOnHand.toLocaleString()}</span>
               <span className="text-sm opacity-80">from {pendingHandoverCount} shipments</span>
            </div>

            {pendingAmount > 0 && (
               <div className="mb-4 bg-white/10 p-3 rounded-lg border border-white/20">
                  <div className="flex items-center text-yellow-300 text-xs font-bold uppercase mb-1">
                     <Clock className="h-3 w-3 mr-1" /> Pending Verification
                  </div>
                  <p className="text-lg font-bold">₹{pendingAmount.toLocaleString()}</p>
                  <p className="text-xs opacity-75">Handed over, waiting for DC to count.</p>
               </div>
            )}
            
            <div className="mt-6 pt-4 border-t border-brand-500/30 flex justify-between items-center">
               <div className="text-xs text-brand-100">
                  Station: <strong>{lmdcName || '...'}</strong>
               </div>
               <button 
                  onClick={() => setShowHandover(true)}
                  disabled={cashOnHand === 0}
                  className="bg-white text-brand-800 px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center hover:bg-brand-50 transition-colors"
               >
                  Submit Cash <ArrowUpRight className="h-4 w-4 ml-1" />
               </button>
            </div>
         </div>
      </div>

      {/* SCREEN 5: HANDOVER CONFIRMATION / HISTORY */}
      <div>
         <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <History className="h-5 w-5 mr-2 text-gray-500" /> Today's Activity
         </h3>
         
         {history.length === 0 ? (
            <p className="text-gray-500 italic text-sm">No cash collected today.</p>
         ) : (
            <div className="space-y-3">
               {history.map(rec => (
                  <div key={rec.id} className="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center">
                     <div>
                        <p className="text-xs font-mono text-gray-500 font-bold">{rec.shipmentId}</p>
                        <p className="text-[10px] text-gray-400">{new Date(rec.collectedAt!).toLocaleTimeString()}</p>
                     </div>
                     <div className="text-right flex items-center gap-3">
                        <p className="font-bold text-gray-900">₹{rec.codAmount}</p>
                        <StatusBadge state={rec.state} />
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>

      {/* HANDOVER CONFIRMATION MODAL */}
      <Modal isOpen={showHandover} onClose={() => setShowHandover(false)} title="Confirm Cash Handover">
         <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
               <p className="text-xs text-gray-500 uppercase font-bold mb-1">Declared Amount</p>
               <p className="text-4xl font-extrabold text-brand-600">₹{cashOnHand}</p>
               <p className="text-xs text-gray-400 mt-2">{pendingHandoverCount} Shipments</p>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg text-sm text-yellow-800 flex items-start">
               <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0 text-yellow-600" />
               <div>
                  <p className="font-bold mb-1">Handover Rules:</p>
                  <ul className="list-disc ml-4 space-y-1 text-xs">
                     <li>You must handover the EXACT amount shown above.</li>
                     <li>Partial handover is NOT permitted.</li>
                     <li>Once submitted, amount is locked for verification.</li>
                     <li>Shortages will block your payouts immediately.</li>
                  </ul>
               </div>
            </div>

            <Button onClick={handleHandover} className="h-12 text-lg bg-brand-600 hover:bg-brand-700">
               Confirm & Submit
            </Button>
         </div>
      </Modal>
    </Layout>
  );
};

const StatusBadge = ({ state }: { state: CodState }) => {
   if (state === CodState.COD_COLLECTED) {
      return <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">ON HAND</span>;
   }
   if (state === CodState.COD_HANDOVER_INITIATED) {
      return <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-1 rounded flex items-center"><Clock className="h-3 w-3 mr-1" /> VERIFYING</span>;
   }
   if (state === CodState.COD_VERIFIED || state === CodState.COD_DEPOSITED || state === CodState.COD_SETTLED) {
      return <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> VERIFIED</span>;
   }
   return <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded">ISSUE</span>;
};
