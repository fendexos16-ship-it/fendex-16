
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { rvpService } from '../../services/rvpService';
import { masterDataService } from '../../services/masterDataService';
import { RVP, RvpStatus, UserRole, RiderProfile } from '../../types';
import { RotateCcw, Plus, Truck, CheckCircle, Package, Lock } from 'lucide-react';

export const RvpManager: React.FC = () => {
  const { user } = useAuth();
  const [rvps, setRvps] = useState<RVP[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'MANAGEMENT' | 'INBOUND'>('MANAGEMENT');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [targetAwb, setTargetAwb] = useState('');
  const [reasonCode, setReasonCode] = useState('REASON_01');
  const [selectedRvpIds, setSelectedRvpIds] = useState<string[]>([]);
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [selectedRider, setSelectedRider] = useState('');

  const currentLmdcId = user?.linkedEntityId || '';

  const loadData = async () => {
    if (!currentLmdcId) return;
    setLoading(true);
    const [data, rData] = await Promise.all([
      rvpService.getRvps(currentLmdcId),
      masterDataService.getRiders()
    ]);
    setRvps(data);
    setRiders(rData.filter(r => r.linkedLmdcId === currentLmdcId && r.status === 'Active'));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleCreateRvp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await rvpService.createRvp(user!, targetAwb, reasonCode);
      setShowCreate(false);
      setTargetAwb('');
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleCreateRunsheet = async () => {
    if (!selectedRider || selectedRvpIds.length === 0) return;
    try {
      await rvpService.createRvpRunsheet(user!, selectedRider, selectedRvpIds);
      setShowAssign(false);
      setSelectedRvpIds([]);
      loadData();
      alert("RVP Runsheet Generated.");
    } catch (e: any) { alert(e.message); }
  };

  const handleInbound = async (rvpId: string) => {
     if(!confirm("Receive this item at station?")) return;
     try {
        await rvpService.inboundAtLmdc(user!, rvpId);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleClose = async (rvpId: string) => {
     if(!confirm("Handover and CLOSE this RVP? This is permanent.")) return;
     try {
        await rvpService.closeRvp(user!, rvpId, 'CLOSE');
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <RotateCcw className="mr-3 h-8 w-8 text-brand-600" /> RVP Control Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage Reverse Pickups and Custody Flow</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => setShowCreate(true)} className="w-auto h-10">
              <Plus className="h-4 w-4 mr-2" /> New RVP
           </Button>
           <Button onClick={() => setShowAssign(true)} variant="secondary" className="w-auto h-10" disabled={rvps.filter(r => r.status === RvpStatus.RVP_CREATED).length === 0}>
              <Truck className="h-4 w-4 mr-2" /> Assign Runsheet
           </Button>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
           <button onClick={() => setActiveTab('MANAGEMENT')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'MANAGEMENT' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500'}`}>Management</button>
           <button onClick={() => setActiveTab('INBOUND')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'INBOUND' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500'}`}>Station Receipt</button>
        </nav>
      </div>

      <Table<RVP & { id: string }>
        data={rvps.filter(r => activeTab === 'INBOUND' ? r.status === RvpStatus.PICKED_UP : true).map(r => ({ ...r, id: r.rvp_id }))}
        isLoading={loading}
        columns={[
          { header: 'AWB', accessor: 'awb', className: 'font-mono font-bold' },
          { header: 'Reason', accessor: 'reason_code' },
          { header: 'Date', accessor: 'pickup_date' },
          { header: 'Rider', accessor: (row) => row.assigned_rider_id || '-' },
          { 
            header: 'Status', 
            accessor: (row) => (
              <span className={`inline-flex px-2 py-1 text-[10px] font-bold rounded-full ${row.status === RvpStatus.CLOSED ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
                {row.status}
              </span>
            )
          }
        ]}
        actions={(row) => (
           <div className="flex gap-2">
              {row.status === RvpStatus.PICKED_UP && activeTab === 'INBOUND' && (
                 <button onClick={() => handleInbound(row.rvp_id)} className="text-green-600 font-bold text-xs hover:underline">Receive @ LMDC</button>
              )}
              {row.status === RvpStatus.INBOUND_RECEIVED_LMDC && (
                 <button onClick={() => handleClose(row.rvp_id)} className="text-brand-600 font-bold text-xs flex items-center hover:underline">
                    <Lock className="h-3 w-3 mr-1" /> Handover & Close
                 </button>
              )}
           </div>
        )}
      />

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Initialize Reverse Pickup">
         <form onSubmit={handleCreateRvp} className="space-y-4">
            <Input label="AWB Number" value={targetAwb} onChange={e => setTargetAwb(e.target.value)} required placeholder="Scan Forward AWB" />
            <div>
               <label className="block text-sm font-medium mb-1">Reason Code</label>
               <select className="w-full border rounded p-2 text-sm" value={reasonCode} onChange={e => setReasonCode(e.target.value)}>
                  <option value="REASON_01">Product Defective</option>
                  <option value="REASON_02">Size/Color Mismatch</option>
                  <option value="REASON_03">Damaged Package</option>
                  <option value="REASON_04">Policy Return</option>
               </select>
            </div>
            <div className="bg-blue-50 p-3 rounded text-xs text-blue-800">
               <strong>Rule Check:</strong> System will verify if forward shipment was Delivered or RTO'd.
            </div>
            <Button type="submit">Create RVP Entry</Button>
         </form>
      </Modal>

      {/* ASSIGN MODAL */}
      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Generate RVP Runsheet">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Select Rider</label>
               <select className="w-full border rounded p-2 text-sm" value={selectedRider} onChange={e => setSelectedRider(e.target.value)}>
                  <option value="">-- Choose Active Rider --</option>
                  {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
               </select>
            </div>

            <div className="bg-gray-50 p-4 rounded border border-gray-200 max-h-48 overflow-y-auto">
               <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Ready for Assignment</p>
               {rvps.filter(r => r.status === RvpStatus.RVP_CREATED).map(r => (
                  <label key={r.rvp_id} className="flex items-center gap-2 py-1 text-sm">
                     <input type="checkbox" checked={selectedRvpIds.includes(r.rvp_id)} onChange={e => {
                        if(e.target.checked) setSelectedRvpIds([...selectedRvpIds, r.rvp_id]);
                        else setSelectedRvpIds(selectedRvpIds.filter(id => id !== r.rvp_id));
                     }} />
                     <span className="font-mono">{r.awb}</span>
                  </label>
               ))}
            </div>

            <div className="bg-orange-50 p-3 rounded text-[10px] text-orange-800 uppercase font-bold tracking-wider">
               Constraint: Max 2 RVP Runsheets per rider per day.
            </div>

            <Button onClick={handleCreateRunsheet} disabled={!selectedRider || selectedRvpIds.length === 0}>Generate Runsheet</Button>
         </div>
      </Modal>
    </Layout>
  );
};
