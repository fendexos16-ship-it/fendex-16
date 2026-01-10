
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { payoutService } from '../../services/payoutService';
import { systemConfigService } from '../../services/systemConfigService';
import { cashfreeService } from '../../services/cashfreeService';
import { razorpayService } from '../../services/razorpayService'; // Imported
import { gatewayService } from '../../services/gatewayService';
import { 
  PayoutBatch, 
  PayoutBatchStatus, 
  UserRole, 
  LmdcLedgerEntry, 
  RiderLedgerEntry, 
  PaymentGateway, 
  SystemConfig, 
  SystemEnvironment,
  GatewayCredential,
  GatewayProvider,
  GatewayEnvironment
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { 
  CheckCircle, 
  Download, 
  Loader2, 
  PlayCircle, 
  Landmark, 
  Calendar, 
  ShieldCheck, 
  Lock, 
  FileCheck, 
  Settings, 
  AlertTriangle, 
  Zap, 
  Server, 
  Info, 
  Clock, 
  RefreshCw, 
  Users, 
  Plus 
} from 'lucide-react';

// Phase 7 Flow States
type CycleState = 'OPEN' | 'EXCEL_DOWNLOADED' | 'VERIFIED' | 'APPROVED' | 'LOCKED' | 'EXECUTED_TEST' | 'EXECUTED_PRODUCTION';

export const PayoutManager: React.FC = () => {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  
  const [activeTab, setActiveTab] = useState<'CYCLES' | 'CREATE' | 'CONFIG'>('CYCLES');
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Create Cycle State
  const [createRole, setCreateRole] = useState<'LMDC' | 'RIDER'>('LMDC');
  const [cycleRange, setCycleRange] = useState({ 
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [availableLedgers, setAvailableLedgers] = useState<any[]>([]);
  const [selectedLedgers, setSelectedLedgers] = useState<string[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>(PaymentGateway.CASHFREE);

  // Config State
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [gateways, setGateways] = useState<any[]>([]);

  // Modals
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<PayoutBatch | null>(null);

  // Security
  const isFounder = user?.role === UserRole.FOUNDER;

  useEffect(() => {
    if (activeTab === 'CYCLES') loadBatches();
    if (activeTab === 'CONFIG') loadConfig();
  }, [activeTab]);

  const loadBatches = async () => {
    setLoading(true);
    const data = await payoutService.getBatches();
    setBatches(data);
    setLoading(false);
  };

  const loadConfig = async () => {
    setLoading(true);
    const cfg = await systemConfigService.getConfig();
    const creds = await gatewayService.getAllCredentials(user!);
    setConfig(cfg);
    setGateways(creds);
    setLoading(false);
  };

  const handleFetchLedgers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await payoutService.getOpenLedgersInRange(createRole, user, cycleRange.start, cycleRange.end);
      setAvailableLedgers(data);
      setSelectedLedgers(data.map(l => l.id)); // Select all by default
    } catch (e: any) {
      error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCycle = async () => {
    if (!user || selectedLedgers.length === 0) return;
    try {
      setLoading(true);
      await payoutService.approveCycle(createRole, selectedLedgers, user, cycleRange, selectedGateway);
      success('Cycle Approved & Locked Successfully');
      setActiveTab('CYCLES');
      loadBatches();
    } catch (e: any) {
      error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedBatch || !user) return;
    setProcessingId(selectedBatch.id);
    
    try {
      const updatedBatch = await payoutService.executeBatch(selectedBatch.id, user);
      
      if (updatedBatch.status === PayoutBatchStatus.EXECUTED_PRODUCTION || updatedBatch.status === PayoutBatchStatus.EXECUTED_TEST) {
        success('Payout Execution Successful');
      } else if (updatedBatch.status === PayoutBatchStatus.PARTIAL_FAILURE) {
        error('Partial Failure - Check logs');
      } else {
        error('Execution Failed');
      }
      
      setShowExecuteModal(false);
      loadBatches();
    } catch (e: any) {
      error(e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleEnableProd = async () => {
    if (!user) return;
    if (!confirm("CRITICAL: Enable Production Payouts? Real money will move.")) return;
    try {
      await systemConfigService.enableProduction(user.id, user.role);
      loadConfig();
      success('Production Mode Enabled');
    } catch (e: any) {
      error(e.message);
    }
  };

  const totalAmount = availableLedgers
    .filter(l => selectedLedgers.includes(l.id))
    .reduce((sum, l) => sum + l.calculatedAmount, 0);

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Landmark className="mr-3 h-8 w-8 text-brand-600" />
            Payout Cycles
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage Payment Cycles for LMDC & Riders</p>
        </div>
        <div className="flex gap-2">
           <Button 
              onClick={() => setActiveTab('CREATE')} 
              className={`w-auto ${activeTab === 'CREATE' ? 'bg-brand-700' : 'bg-brand-600'}`}
           >
              <Plus className="h-4 w-4 mr-2" /> New Cycle
           </Button>
           {isFounder && (
              <Button 
                 onClick={() => setActiveTab('CONFIG')} 
                 variant="secondary"
                 className="w-auto"
              >
                 <Settings className="h-4 w-4 mr-2" /> Config
              </Button>
           )}
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setActiveTab('CYCLES')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'CYCLES' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500'}`}>All Cycles</button>
          <button onClick={() => setActiveTab('CREATE')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'CREATE' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500'}`}>Create New</button>
          {isFounder && <button onClick={() => setActiveTab('CONFIG')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'CONFIG' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500'}`}>System Config</button>}
        </nav>
      </div>

      {activeTab === 'CYCLES' && (
        <Table<PayoutBatch>
          data={batches}
          isLoading={loading}
          columns={[
            { header: 'Batch ID', accessor: 'id', className: 'font-mono font-bold' },
            { header: 'Role', accessor: 'role' },
            { header: 'Items', accessor: 'count' },
            { header: 'Total Amount', accessor: (b) => `₹${b.totalAmount.toLocaleString()}`, className: 'font-bold' },
            { 
               header: 'Status', 
               accessor: (b) => (
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                     b.status === PayoutBatchStatus.EXECUTED_PRODUCTION ? 'bg-green-100 text-green-800' :
                     b.status === PayoutBatchStatus.EXECUTED_TEST ? 'bg-blue-100 text-blue-800' :
                     b.status === PayoutBatchStatus.FAILED ? 'bg-red-100 text-red-800' :
                     'bg-yellow-100 text-yellow-800'
                  }`}>
                     {b.status}
                  </span>
               ) 
            },
            { header: 'Release Date', accessor: 'payoutDate' },
            { header: 'Gateway', accessor: (b) => b.gateway || '-' }
          ]}
          actions={(b) => (
             <div className="flex justify-end gap-2">
                {b.status === PayoutBatchStatus.LOCKED && (
                   <Button onClick={() => { setSelectedBatch(b); setShowExecuteModal(true); }} className="w-auto h-8 text-xs bg-green-600 hover:bg-green-700">
                      <PlayCircle className="h-3 w-3 mr-2" /> Execute
                   </Button>
                )}
             </div>
          )}
        />
      )}

      {activeTab === 'CREATE' && (
         <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
               <h3 className="font-bold text-gray-900 mb-4">1. Select Criteria</h3>
               <div className="flex gap-4 items-end">
                  <div>
                     <label className="block text-sm font-medium mb-1">Payee Role</label>
                     <select className="border rounded p-2 w-40" value={createRole} onChange={e => setCreateRole(e.target.value as any)}>
                        <option value="LMDC">LMDC Partner</option>
                        <option value="RIDER">Rider Fleet</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-sm font-medium mb-1">From Date</label>
                     <input type="date" className="border rounded p-2" value={cycleRange.start} onChange={e => setCycleRange({...cycleRange, start: e.target.value})} />
                  </div>
                  <div>
                     <label className="block text-sm font-medium mb-1">To Date</label>
                     <input type="date" className="border rounded p-2" value={cycleRange.end} onChange={e => setCycleRange({...cycleRange, end: e.target.value})} />
                  </div>
                  <Button onClick={handleFetchLedgers} className="w-auto mb-[1px]">Fetch Payable</Button>
               </div>
            </div>

            {availableLedgers.length > 0 && (
               <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-gray-900">2. Review & Approve</h3>
                     <div className="text-right">
                        <p className="text-sm text-gray-500">Selected Total</p>
                        <p className="text-2xl font-bold text-brand-600">₹{totalAmount.toLocaleString()}</p>
                     </div>
                  </div>

                  <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-200 text-sm max-h-60 overflow-y-auto">
                     {availableLedgers.map(l => (
                        <div key={l.id} className="flex justify-between py-1 border-b last:border-0">
                           <div className="flex items-center">
                              <input 
                                 type="checkbox" 
                                 checked={selectedLedgers.includes(l.id)} 
                                 onChange={e => {
                                    if(e.target.checked) setSelectedLedgers([...selectedLedgers, l.id]);
                                    else setSelectedLedgers(selectedLedgers.filter(id => id !== l.id));
                                 }}
                                 className="mr-2"
                              />
                              <span className="font-mono">{l.shipmentId}</span>
                           </div>
                           <span>₹{l.calculatedAmount}</span>
                        </div>
                     ))}
                  </div>

                  <div className="flex justify-end items-center gap-4 border-t pt-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Gateway</label>
                        <select className="border rounded p-2 text-sm" value={selectedGateway} onChange={e => setSelectedGateway(e.target.value as any)}>
                           <option value="CASHFREE">Cashfree (Payouts)</option>
                           <option value="RAZORPAY">RazorpayX</option>
                        </select>
                     </div>
                     <Button onClick={handleApproveCycle} className="w-auto h-10 bg-green-600 hover:bg-green-700">
                        <Lock className="h-4 w-4 mr-2" /> Approve & Lock Cycle
                     </Button>
                  </div>
               </div>
            )}
         </div>
      )}

      {activeTab === 'CONFIG' && config && (
         <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
               <h3 className="font-bold text-gray-900 mb-4 flex items-center"><Server className="h-5 w-5 mr-2" /> System Environment</h3>
               <div className="flex items-center justify-between p-4 bg-gray-50 rounded border border-gray-200">
                  <div>
                     <p className="font-bold text-gray-700">Payout Environment</p>
                     <p className={`text-sm font-mono mt-1 ${config.payoutEnvironment === 'PRODUCTION' ? 'text-red-600 font-bold' : 'text-blue-600'}`}>
                        {config.payoutEnvironment}
                     </p>
                  </div>
                  {config.payoutEnvironment !== 'PRODUCTION' ? (
                     <Button onClick={handleEnableProd} className="w-auto bg-red-600 hover:bg-red-700">
                        <Zap className="h-4 w-4 mr-2" /> Switch to PRODUCTION
                     </Button>
                  ) : (
                     <div className="flex items-center text-green-600 font-bold bg-green-100 px-3 py-1 rounded">
                        <CheckCircle className="h-4 w-4 mr-2" /> Live Active
                     </div>
                  )}
               </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
               <h3 className="font-bold text-gray-900 mb-4">Gateway Credentials</h3>
               <div className="space-y-3">
                  {gateways.map(g => (
                     <div key={g.id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                           <p className="font-bold">{g.provider} <span className="text-xs bg-gray-100 px-1 rounded ml-2">{g.environment}</span></p>
                           <p className="text-xs text-gray-500 font-mono">ID: {g.clientId}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${g.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                           {g.isActive ? 'Active' : 'Inactive'}
                        </span>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* EXECUTE MODAL */}
      <Modal isOpen={showExecuteModal} onClose={() => setShowExecuteModal(false)} title={`Execute Batch: ${selectedBatch?.id}`}>
         <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded border border-yellow-200 text-sm text-yellow-800">
               <AlertTriangle className="h-5 w-5 inline mr-2" />
               <strong>Confirm Execution:</strong> This will initiate bank transfers via {selectedBatch?.gatewaySelected}.
               <br/>
               <span className="block mt-2 font-mono">Amount: ₹{selectedBatch?.totalAmount.toLocaleString()}</span>
               <span className="block font-mono">Beneficiaries: {selectedBatch?.count}</span>
            </div>
            
            {processingId === selectedBatch?.id ? (
               <div className="text-center py-4">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-brand-600 mb-2" />
                  <p>Processing Payouts...</p>
               </div>
            ) : (
               <div className="flex justify-end gap-2 pt-4">
                  <Button variant="secondary" onClick={() => setShowExecuteModal(false)}>Cancel</Button>
                  <Button onClick={handleExecute} className="bg-green-600 hover:bg-green-700">Confirm Transfer</Button>
               </div>
            )}
         </div>
      </Modal>
    </Layout>
  );
};
