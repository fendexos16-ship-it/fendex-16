
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { codService } from '../../services/codService';
import { masterDataService } from '../../services/masterDataService';
import { 
  UserRole, 
  CodRecord, 
  CodDeposit, 
  CodDepositMode, 
  CodAdjustment,
  CashHandoverBatch,
  CodState,
  HandoverStatus,
  CodWarning,
  RiderExposure
} from '../../types';
import { 
  Banknote, 
  TrendingUp, 
  CheckCircle, 
  AlertOctagon, 
  Plus, 
  Scale, 
  FileCheck,
  Building,
  UserCheck,
  AlertTriangle,
  Clock,
  Scan,
  ShieldAlert,
  Search,
  Lock,
  ArrowRightCircle
} from 'lucide-react';

export const CodManager: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'RIDER_RISK' | 'HANDOVERS' | 'DEPOSITS' | 'ADJUSTMENTS'>('DASHBOARD');
  const [loading, setLoading] = useState(false);
  
  // Data
  const [stats, setStats] = useState({ collected: 0, deposited: 0, reconciled: 0, shortage: 0 });
  const [deposits, setDeposits] = useState<CodDeposit[]>([]);
  const [handovers, setHandovers] = useState<CashHandoverBatch[]>([]);
  const [adjustments, setAdjustments] = useState<CodAdjustment[]>([]);
  const [riderExposures, setRiderExposures] = useState<RiderExposure[]>([]);
  const [warnings, setWarnings] = useState<CodWarning[]>([]);
  
  // Breakdown Data (Finance)
  const [lmdcBreakdown, setLmdcBreakdown] = useState<any[]>([]);
  
  // CMS Deposit Modal
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [verifiedRecords, setVerifiedRecords] = useState<CodRecord[]>([]);
  const [selectedForDeposit, setSelectedForDeposit] = useState<string[]>([]);
  const [newDeposit, setNewDeposit] = useState<{ amount: number, mode: CodDepositMode, ref: string, lmdcId: string }>({
    amount: 0,
    mode: CodDepositMode.BANK,
    ref: '',
    lmdcId: ''
  });

  // Handover Verification Modal
  const [verifyModal, setVerifyModal] = useState(false);
  const [activeHandover, setActiveHandover] = useState<CashHandoverBatch | null>(null);
  const [physicalCount, setPhysicalCount] = useState<number>(0);

  // Reconciliation Modal (Finance)
  const [showReconModal, setShowReconModal] = useState(false);
  const [reconDeposit, setReconDeposit] = useState<CodDeposit | null>(null);

  // Search Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Dropdown Data
  const [lmdcs, setLmdcs] = useState<any[]>([]);

  // Permissions
  const isFinance = user?.role === UserRole.FOUNDER || user?.role === UserRole.FINANCE_ADMIN;
  const isLMDC = user?.role === UserRole.LMDC_MANAGER || user?.role === UserRole.MMDC_MANAGER;

  useEffect(() => {
    loadData();
    if (isLMDC) {
      setActiveTab('HANDOVERS'); // Ops Workflow Start
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    
    // Stats & Lists
    const s = await codService.getStats();
    setStats(s);

    if (isLMDC && user.linkedEntityId) {
       const h = await codService.getPendingHandovers(user.linkedEntityId);
       setHandovers(h);
    } else if (isFinance) {
       const h = await codService.getAllHandovers();
       setHandovers(h);
       const r = await codService.getRiderExposures();
       setRiderExposures(r);
       
       // Calculate LMDC Breakdown
       const allRecords = await codService.getAllRecords();
       const allLmdcs = await masterDataService.getLMDCs();
       const recordsArray = Object.values(allRecords);
       
       const breakdown = allLmdcs.map(l => {
          const lmdcRecs = recordsArray.filter(r => r.lmdcId === l.id);
          const collected = lmdcRecs.filter(r => r.state >= CodState.COD_COLLECTED).reduce((sum, r) => sum + r.codAmount, 0);
          const verified = lmdcRecs.filter(r => r.state >= CodState.COD_VERIFIED).reduce((sum, r) => sum + r.codAmount, 0);
          const deposited = lmdcRecs.filter(r => r.state >= CodState.COD_DEPOSITED).reduce((sum, r) => sum + r.codAmount, 0);
          
          return {
             id: l.id,
             name: l.name,
             collected,
             verified,
             pending: collected - verified,
             deposited
          };
       });
       setLmdcBreakdown(breakdown);
    }

    const d = await codService.getAllDeposits(user);
    setDeposits(d);
    
    if (isFinance) {
       const a = await codService.getAdjustments(user);
       setAdjustments(a);
       const w = await codService.checkWarnings();
       setWarnings(w);
    }

    const l = await masterDataService.getLMDCs();
    setLmdcs(l);

    setLoading(false);
  };

  // --- HANDOVER VERIFICATION (CHB) ---
  const handleOpenVerify = (batch: CashHandoverBatch) => {
     setActiveHandover(batch);
     setPhysicalCount(batch.declaredAmount); // Default to match
     setVerifyModal(true);
  };

  const submitVerification = async () => {
     if (!activeHandover) return;
     if (!confirm(`Verify physical count of ₹${physicalCount}? Differences will be logged as shortages.`)) return;
     try {
        await codService.verifyHandoverBatch(user!, activeHandover.id, physicalCount);
        setVerifyModal(false);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  // --- CMS DEPOSIT (CDR) ---
  const handleOpenDeposit = async () => {
     setShowDepositModal(true);
     setVerifiedRecords([]); 
     setNewDeposit({...newDeposit, lmdcId: isLMDC ? user!.linkedEntityId! : ''});
     setSelectedForDeposit([]);
     
     if (isLMDC && user?.linkedEntityId) {
        handleLmdcSelect(user.linkedEntityId);
     }
  };

  const handleLmdcSelect = async (lmdcId: string) => {
     setNewDeposit({...newDeposit, lmdcId});
     if (lmdcId) {
        // Fetch only VERIFIED records
        const verified = await codService.getVerifiedRecords(lmdcId);
        setVerifiedRecords(verified);
     }
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeposit.lmdcId || selectedForDeposit.length === 0) return alert('Select items.');

    const total = verifiedRecords
       .filter(r => selectedForDeposit.includes(r.id))
       .reduce((sum, r) => sum + r.codAmount, 0);
    
    if (newDeposit.amount !== total) return alert(`Amount Mismatch! Total: ${total}`);

    try {
      await codService.createCmsDeposit(user!, {
         lmdcId: newDeposit.lmdcId,
         amount: newDeposit.amount,
         mode: newDeposit.mode,
         ref: newDeposit.ref,
         shipmentIds: selectedForDeposit
      });
      setShowDepositModal(false);
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleSettleDeposit = async (action: 'SETTLE' | 'REJECT') => {
     if (!reconDeposit) return;
     try {
        await codService.reconcileDeposit(user!, reconDeposit.id, action);
        setShowReconModal(false);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const getLmdcName = (id: string) => lmdcs.find(l => l.id === id)?.name || id;
  const totalDepositSelected = verifiedRecords.filter(r => selectedForDeposit.includes(r.id)).reduce((s,r) => s+r.codAmount, 0);

  // Filter for Rider Table
  const filteredRiders = riderExposures.filter(r => 
     r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     r.riderId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Banknote className="mr-3 h-8 w-8 text-brand-600" />
          COD Control Center
        </h1>
        <p className="text-sm text-gray-500 mt-1">
           {isLMDC ? 'Station Cash Operations' : 'Network Financial Custody & Risk Management'}
        </p>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {isFinance && (
             <>
               <button onClick={() => setActiveTab('DASHBOARD')} className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'DASHBOARD' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Live Control</button>
               <button onClick={() => setActiveTab('RIDER_RISK')} className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'RIDER_RISK' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Rider Exposure</button>
             </>
          )}
          <button onClick={() => setActiveTab('HANDOVERS')} className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'HANDOVERS' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{isFinance ? 'CHB Monitor' : 'Rider Handovers'}</button>
          <button onClick={() => setActiveTab('DEPOSITS')} className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'DEPOSITS' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Bank Deposits</button>
          {isFinance && <button onClick={() => setActiveTab('ADJUSTMENTS')} className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'ADJUSTMENTS' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Shortage & Debt</button>}
        </nav>
      </div>

      {/* DASHBOARD TAB (SCREEN 1) */}
      {activeTab === 'DASHBOARD' && isFinance && (
         <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="bg-blue-50 p-4 rounded border border-blue-200">
                  <p className="text-xs font-bold text-blue-700 uppercase">On-Field (Liability)</p>
                  <p className="text-2xl font-bold">₹{stats.collected.toLocaleString()}</p>
                  <p className="text-xs text-blue-600 mt-1">Cash with Riders</p>
               </div>
               <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                  <p className="text-xs font-bold text-yellow-700 uppercase">In-Transit (Deposited)</p>
                  <p className="text-2xl font-bold">₹{stats.deposited.toLocaleString()}</p>
                  <p className="text-xs text-yellow-600 mt-1">Pending Bank Confirm</p>
               </div>
               <div className="bg-green-50 p-4 rounded border border-green-200">
                  <p className="text-xs font-bold text-green-700 uppercase">Settled (Bank)</p>
                  <p className="text-2xl font-bold">₹{stats.reconciled.toLocaleString()}</p>
                  <p className="text-xs text-green-600 mt-1">Safe & Audited</p>
               </div>
               <div className="bg-red-50 p-4 rounded border border-red-200">
                  <p className="text-xs font-bold text-red-700 uppercase">Total Shortage</p>
                  <p className="text-2xl font-bold">₹{stats.shortage.toLocaleString()}</p>
                  <p className="text-xs text-red-600 mt-1">Recoverable Debt</p>
               </div>
            </div>
            
            <div>
               <h3 className="text-lg font-bold text-gray-900 mb-4">Station-wise Breakdown</h3>
               <Table
                  data={lmdcBreakdown}
                  isLoading={loading}
                  columns={[
                     { header: 'Station', accessor: 'name' },
                     { header: 'Collected', accessor: (l:any) => `₹${l.collected.toLocaleString()}` },
                     { header: 'Verified', accessor: (l:any) => `₹${l.verified.toLocaleString()}`, className: 'text-green-600 font-medium' },
                     { header: 'Pending Verify', accessor: (l:any) => `₹${l.pending.toLocaleString()}`, className: 'text-yellow-600 font-bold' },
                     { header: 'Deposited', accessor: (l:any) => `₹${l.deposited.toLocaleString()}` }
                  ]}
               />
            </div>
         </div>
      )}

      {/* RIDER RISK TAB (SCREEN 2) */}
      {activeTab === 'RIDER_RISK' && isFinance && (
         <div className="space-y-4">
            <div className="flex justify-between items-center">
               <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input 
                     type="text" 
                     placeholder="Search Rider..." 
                     className="pl-9 pr-4 py-2 border rounded-md text-sm w-64"
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
               <div className="flex gap-2">
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded font-bold flex items-center"><ShieldAlert className="h-3 w-3 mr-1" /> BLOCKED: {riderExposures.filter(r => r.status === 'BLOCKED').length}</span>
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded font-bold flex items-center"><AlertTriangle className="h-3 w-3 mr-1" /> RISK: {riderExposures.filter(r => r.status === 'RISK').length}</span>
               </div>
            </div>

            <Table<RiderExposure & { id: string }>
               data={filteredRiders.map(r => ({ ...r, id: r.riderId }))}
               isLoading={loading}
               columns={[
                  { header: 'Rider', accessor: (r) => <div><p className="font-bold">{r.name}</p><p className="text-xs text-gray-500 font-mono">{r.riderId}</p></div> },
                  { header: 'Station', accessor: (r) => getLmdcName(r.lmdcId) },
                  { header: 'Cash on Hand', accessor: (r) => `₹${r.cashOnHand}`, className: 'text-blue-700 font-medium' },
                  { header: 'Pending Verify', accessor: (r) => `₹${r.pendingVerification}`, className: 'text-yellow-700' },
                  { header: 'Shortage Debt', accessor: (r) => r.shortage > 0 ? <span className="text-red-600 font-bold">₹{r.shortage}</span> : '-' },
                  { 
                     header: 'Status', 
                     accessor: (r) => (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                           r.status === 'BLOCKED' ? 'bg-red-100 text-red-800' : 
                           r.status === 'RISK' ? 'bg-yellow-100 text-yellow-800' : 
                           'bg-green-100 text-green-800'
                        }`}>
                           {r.status}
                        </span>
                     ) 
                  }
               ]}
               actions={(r) => (
                  <div className="text-right">
                     {r.status === 'BLOCKED' ? (
                        <span className="text-xs text-red-600 flex items-center justify-end"><Lock className="h-3 w-3 mr-1" /> Payout Locked</span>
                     ) : (
                        <span className="text-xs text-green-600 flex items-center justify-end"><CheckCircle className="h-3 w-3 mr-1" /> Eligible</span>
                     )}
                  </div>
               )}
            />
         </div>
      )}

      {/* HANDOVERS TAB (CHB - SCREEN 3) */}
      {activeTab === 'HANDOVERS' && (
         <>
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-gray-900">{isFinance ? 'All Batches Monitor' : 'Pending Rider Batches'}</h3>
            </div>
            <Table<CashHandoverBatch>
               data={handovers}
               isLoading={loading}
               columns={[
                  { header: 'Batch ID', accessor: 'id', className: 'font-mono font-bold' },
                  { header: 'Rider ID', accessor: 'riderId' },
                  ...(isFinance ? [{ header: 'Station', accessor: (h: CashHandoverBatch) => getLmdcName(h.lmdcId) }] : []),
                  { header: 'Declared', accessor: (h) => `₹${h.declaredAmount}`, className: 'font-bold' },
                  { header: 'Physical', accessor: (h) => h.physicalAmount ? `₹${h.physicalAmount}` : '-', className: 'text-gray-500' },
                  { 
                     header: 'Status', 
                     accessor: (h) => (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                           h.status === HandoverStatus.VERIFIED ? 'bg-green-100 text-green-800' :
                           h.status === HandoverStatus.SHORTAGE_LOCKED ? 'bg-red-100 text-red-800' :
                           'bg-yellow-100 text-yellow-800'
                        }`}>
                           {h.status}
                        </span>
                     )
                  },
                  { header: 'Time', accessor: (h) => new Date(h.createdAt).toLocaleTimeString() }
               ]}
               actions={(h) => (
                  <div className="flex justify-end">
                     {isLMDC && h.status !== HandoverStatus.VERIFIED && h.status !== HandoverStatus.SHORTAGE_LOCKED && (
                        <button onClick={() => handleOpenVerify(h)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700">
                           Verify Cash
                        </button>
                     )}
                     {isFinance && h.status === HandoverStatus.SHORTAGE_LOCKED && (
                        <button className="text-red-600 font-bold text-xs flex items-center hover:underline">
                           <AlertOctagon className="h-3 w-3 mr-1" /> View Issue
                        </button>
                     )}
                  </div>
               )}
            />
            {handovers.length === 0 && <p className="text-center text-gray-500 py-8">No records found.</p>}
         </>
      )}

      {/* DEPOSITS TAB (CDR - SCREEN 4) */}
      {activeTab === 'DEPOSITS' && (
         <>
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-gray-900">CMS / Bank Deposits</h3>
               {isLMDC && (
                  <Button onClick={handleOpenDeposit} className="w-auto h-9 text-xs">
                     <Plus className="h-3 w-3 mr-2" /> Create Deposit
                  </Button>
               )}
            </div>
            <Table<CodDeposit>
               data={deposits}
               isLoading={loading}
               columns={[
                  { header: 'Ref No', accessor: 'referenceNo', className: 'font-mono' },
                  { header: 'Date', accessor: (d) => new Date(d.createdAt).toLocaleDateString() },
                  { header: 'LMDC', accessor: (d) => getLmdcName(d.lmdcId) },
                  { header: 'Amount', accessor: (d) => `₹${d.declaredAmount.toLocaleString()}`, className: 'font-bold' },
                  { 
                     header: 'Status', 
                     accessor: (d) => (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                           d.status === 'SETTLED' ? 'bg-green-100 text-green-800' : 
                           d.status === 'MISMATCH' ? 'bg-red-100 text-red-800' :
                           'bg-yellow-100 text-yellow-800'
                        }`}>
                           {d.status}
                        </span>
                     ) 
                  }
               ]}
               actions={isFinance ? (d) => (
                  d.status === 'PENDING' && (
                     <button onClick={() => { setReconDeposit(d); setShowReconModal(true); }} className="text-blue-600 font-bold text-xs border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">
                        Confirm Receipt
                     </button>
                  )
               ) : undefined}
            />
         </>
      )}

      {/* ADJUSTMENTS TAB */}
      {activeTab === 'ADJUSTMENTS' && isFinance && (
         <Table<CodAdjustment>
            data={adjustments}
            isLoading={loading}
            columns={[
               { header: 'Reason', accessor: 'reason' },
               { header: 'Amount', accessor: 'amount', className: 'text-red-600 font-bold' },
               { header: 'Entity', accessor: 'entityId' },
               { header: 'Date', accessor: (a) => new Date(a.approvedAt).toLocaleDateString() },
               { 
                  header: 'State', 
                  accessor: (a) => (
                     <span className={`px-2 py-1 rounded text-xs font-bold ${a.status === 'OPEN' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                        {a.status}
                     </span>
                  )
               }
            ]}
         />
      )}

      {/* MODALS */}
      
      {/* Verify Modal */}
      <Modal isOpen={verifyModal} onClose={() => setVerifyModal(false)} title={`Verify Batch: ${activeHandover?.id}`}>
         <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded text-center">
               <p className="text-sm text-gray-500 uppercase">Declared Amount</p>
               <p className="text-3xl font-bold text-gray-900">₹{activeHandover?.declaredAmount}</p>
            </div>
            
            <Input 
               label="Physical Cash Count" 
               type="number" 
               value={physicalCount} 
               onChange={e => setPhysicalCount(parseFloat(e.target.value))} 
               autoFocus
            />
            
            {physicalCount !== activeHandover?.declaredAmount && (
               <div className="bg-red-50 p-3 rounded border border-red-200 text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  <strong>Mismatch:</strong> ₹{physicalCount - (activeHandover?.declaredAmount || 0)}. This will be logged as a shortage against the Rider.
               </div>
            )}

            <Button onClick={submitVerification}>Confirm Verification</Button>
         </div>
      </Modal>

      {/* Deposit Modal */}
      <Modal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} title="Create Bank Deposit">
         <form onSubmit={handleSubmitDeposit} className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Select LMDC</label>
               <select className="w-full border rounded p-2" value={newDeposit.lmdcId} onChange={e => handleLmdcSelect(e.target.value)} disabled={isLMDC}>
                  <option value="">Select...</option>
                  {lmdcs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
               </select>
            </div>

            {newDeposit.lmdcId && verifiedRecords.length > 0 ? (
               <div className="max-h-40 overflow-y-auto border rounded p-2">
                  {verifiedRecords.map(r => (
                     <label key={r.id} className="flex items-center justify-between p-2 hover:bg-gray-50 border-b last:border-0">
                        <div className="flex items-center">
                           <input 
                              type="checkbox" 
                              checked={selectedForDeposit.includes(r.id)} 
                              onChange={e => {
                                 if(e.target.checked) setSelectedForDeposit([...selectedForDeposit, r.id]);
                                 else setSelectedForDeposit(selectedForDeposit.filter(id => id !== r.id));
                              }} 
                              className="mr-2"
                           />
                           <span className="font-mono text-xs">{r.shipmentId}</span>
                        </div>
                        <span className="font-bold text-sm">₹{r.codAmount}</span>
                     </label>
                  ))}
               </div>
            ) : <p className="text-sm text-gray-500 italic">No verified cash pending deposit.</p>}

            <div className="flex justify-between items-center bg-green-50 p-3 rounded border border-green-200">
               <span className="text-green-800 font-bold">Selected Total:</span>
               <span className="text-xl font-bold text-green-900">₹{totalDepositSelected}</span>
            </div>

            <Input 
               label="Amount (Auto-filled)" 
               type="number" 
               value={newDeposit.amount} 
               onChange={e => setNewDeposit({...newDeposit, amount: parseFloat(e.target.value)})} 
               // Allow manual override if needed but warn? Best practice: Lock it to selected.
               // For this implementation, let's keep it manual entry to match bank slip but validate against total.
            />
            
            <Input label="Bank Reference / Slip No" value={newDeposit.ref} onChange={e => setNewDeposit({...newDeposit, ref: e.target.value})} required />
            
            <Button type="submit" disabled={totalDepositSelected === 0}>Submit Deposit</Button>
         </form>
      </Modal>

      {/* Settle Modal */}
      <Modal isOpen={showReconModal} onClose={() => setShowReconModal(false)} title="Settle Deposit">
         <div className="space-y-4">
            <p>Confirm funds received in bank for Ref: <strong>{reconDeposit?.referenceNo}</strong></p>
            <div className="flex gap-2">
               <Button onClick={() => handleSettleDeposit('SETTLE')} className="bg-green-600 hover:bg-green-700">Confirm Receipt</Button>
               <Button onClick={() => handleSettleDeposit('REJECT')} variant="secondary" className="text-red-600 hover:bg-red-50">Reject</Button>
            </div>
         </div>
      </Modal>

    </Layout>
  );
};
