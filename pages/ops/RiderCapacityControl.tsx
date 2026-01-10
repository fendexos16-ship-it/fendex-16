
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { masterDataService } from '../../services/masterDataService';
import { capacityService } from '../../services/capacityService';
import { useAuth } from '../../context/AuthContext';
import { RiderCapacityStatus, UserRole, DistributionCenter } from '../../types';
import { Navigate } from 'react-router-dom';
import { ShieldAlert, Filter, Activity, Edit2, AlertTriangle } from 'lucide-react';

export const RiderCapacityControl: React.FC = () => {
  const { user } = useAuth();
  
  // Security Guard
  if (user?.role !== UserRole.FOUNDER) {
     return <Navigate to="/" replace />;
  }

  const [loading, setLoading] = useState(false);
  
  // Master Data
  const [dcs, setDcs] = useState<DistributionCenter[]>([]);
  
  // Filter State (Mandatory)
  const [selectedDc, setSelectedDc] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Data for Table
  const [riderData, setRiderData] = useState<RiderCapacityStatus[]>([]);
  
  // Modal State
  const [showEdit, setShowEdit] = useState(false);
  const [editingRider, setEditingRider] = useState<RiderCapacityStatus | null>(null);
  const [overrideForm, setOverrideForm] = useState({
     fwd: 0, fm: 0, rvp: 0,
     start: '', end: '', reason: '',
     isPermanent: false
  });

  useEffect(() => {
     const init = async () => {
        const dcData = await masterDataService.getDCs();
        setDcs(dcData);
     };
     init();
  }, []);

  // Fetch Riders & Capacity when Filters Change
  useEffect(() => {
     if (!selectedDc || !selectedDate) {
        setRiderData([]);
        return;
     }
     loadTableData();
  }, [selectedDc, selectedDate]);

  const loadTableData = async () => {
     if (!user) return;
     setLoading(true);
     try {
        const data = await capacityService.getRidersForDc(user, selectedDc, selectedDate);
        setRiderData(data);
     } catch(e) {
        console.error(e);
     } finally {
        setLoading(false);
     }
  };

  const handleEditClick = (rider: RiderCapacityStatus) => {
     const cap = rider.effectiveCapacity;
     // Pre-fill with current effective (whether tier or override)
     setOverrideForm({
        fwd: cap.fwd,
        fm: cap.fm,
        rvp: cap.rvp,
        start: selectedDate,
        end: selectedDate,
        reason: '',
        isPermanent: false
     });
     setEditingRider(rider);
     setShowEdit(true);
  };

  const handleSaveOverride = async () => {
     if (!editingRider || !user) return;
     if (!overrideForm.reason) return alert("Reason is mandatory.");
     
     // Handle Permanent (simulate far future)
     const endDate = overrideForm.isPermanent ? '2099-12-31' : overrideForm.end;

     try {
        await capacityService.saveOverride(user, {
           riderId: editingRider.riderId,
           dcId: selectedDc,
           fwd: overrideForm.fwd,
           fm: overrideForm.fm,
           rvp: overrideForm.rvp,
           start: overrideForm.start,
           end: endDate,
           reason: overrideForm.reason
        });
        setShowEdit(false);
        loadTableData();
     } catch(e:any) {
        alert(e.message);
     }
  };

  return (
    <Layout>
      <div className="mb-6">
         <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ShieldAlert className="mr-3 h-8 w-8 text-purple-600" />
            Rider Capacity Control
         </h1>
         <p className="text-sm text-gray-500 mt-1">Founder-Only Module: Enforce hard limits per DC and Rider.</p>
      </div>

      {/* 1. FILTER PANEL (BLOCKING) */}
      <div className="bg-white p-6 rounded-lg border border-purple-200 shadow-sm mb-6">
         <div className="flex flex-col md:flex-row gap-6 items-end">
            <div className="flex-1 w-full">
               <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select DC (Mandatory)</label>
               <select 
                  className="w-full border rounded-md p-2.5 text-sm font-medium bg-gray-50 focus:ring-purple-500 focus:border-purple-500"
                  value={selectedDc}
                  onChange={e => setSelectedDc(e.target.value)}
               >
                  <option value="">-- Choose Distribution Center --</option>
                  {dcs.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
               </select>
            </div>
            <div className="flex-1 w-full">
               <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Effective Date</label>
               <input 
                  type="date" 
                  className="w-full border rounded-md p-2.5 text-sm bg-gray-50"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
               />
            </div>
            <div className="pb-1">
               <Button onClick={loadTableData} disabled={!selectedDc || !selectedDate} className="h-[42px] px-6">
                  <Filter className="h-4 w-4 mr-2" /> View Roster
               </Button>
            </div>
         </div>
         {!selectedDc && (
            <p className="text-xs text-orange-600 mt-3 flex items-center">
               <AlertTriangle className="h-3 w-3 mr-1" /> Select a DC to manage capacity.
            </p>
         )}
      </div>

      {/* 2. RIDER LIST */}
      {selectedDc && (
         <Table<RiderCapacityStatus & { id: string }>
            data={riderData.map(r => ({ ...r, id: r.riderId }))}
            isLoading={loading}
            columns={[
               { header: 'Rider ID', accessor: 'riderId', className: 'font-mono text-gray-500' },
               { header: 'Name', accessor: 'name', className: 'font-bold' },
               { 
                  header: 'Tier', 
                  accessor: (r) => (
                     <span className={`px-2 py-1 rounded text-xs font-bold ${r.tier === 'TIER_3' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                        {r.tier || 'TIER_1'}
                     </span>
                  ) 
               },
               { 
                  header: 'Capacity (Runs)', 
                  accessor: (r) => {
                     const cap = r.effectiveCapacity;
                     return (
                        <div className="flex gap-2 text-sm">
                           <div className="text-center px-2 border rounded bg-white">
                              <span className="text-[10px] text-gray-400 block uppercase">FWD</span>
                              <span className="font-bold">{cap.fwd}</span>
                           </div>
                           <div className="text-center px-2 border rounded bg-white">
                              <span className="text-[10px] text-gray-400 block uppercase">FM</span>
                              <span className="font-bold">{cap.fm}</span>
                           </div>
                           <div className="text-center px-2 border rounded bg-white">
                              <span className="text-[10px] text-gray-400 block uppercase">RVP</span>
                              <span className="font-bold">{cap.rvp}</span>
                           </div>
                        </div>
                     );
                  }
               },
               { 
                  header: 'Override', 
                  accessor: (r) => {
                     return r.effectiveCapacity.source === 'OVERRIDE' ? (
                        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded flex items-center w-fit">
                           <Activity className="h-3 w-3 mr-1" /> ACTIVE
                        </span>
                     ) : <span className="text-gray-400 text-xs">Default</span>;
                  }
               }
            ]}
            actions={(r) => (
               <button onClick={() => handleEditClick(r)} className="text-purple-600 hover:text-purple-800 text-xs font-bold flex items-center border border-purple-200 px-3 py-1.5 rounded bg-white hover:bg-purple-50 transition-colors">
                  <Edit2 className="h-3 w-3 mr-1" /> Edit Capacity
               </button>
            )}
         />
      )}

      {/* 3. EDIT MODAL */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Edit Capacity: ${editingRider?.name}`}>
         <div className="space-y-5">
            <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded-r">
               <h4 className="text-sm font-bold text-purple-900 mb-1">Founder Authority</h4>
               <p className="text-xs text-purple-700">
                  You are overriding the system default for this rider. 
                  This action is logged and affects runsheet generation immediately.
               </p>
            </div>

            <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded border border-gray-200">
               <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Max FWD (0-3)</label>
                  <input 
                     type="number" min="0" max="3" 
                     className="w-full border rounded p-2 text-center font-bold text-lg" 
                     value={overrideForm.fwd}
                     onChange={e => setOverrideForm({...overrideForm, fwd: parseInt(e.target.value)})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Max FM (0-2)</label>
                  <input 
                     type="number" min="0" max="2" 
                     className="w-full border rounded p-2 text-center font-bold text-lg" 
                     value={overrideForm.fm}
                     onChange={e => setOverrideForm({...overrideForm, fm: parseInt(e.target.value)})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Max RVP (0-1)</label>
                  <input 
                     type="number" min="0" max="1" 
                     className="w-full border rounded p-2 text-center font-bold text-lg" 
                     value={overrideForm.rvp}
                     onChange={e => setOverrideForm({...overrideForm, rvp: parseInt(e.target.value)})}
                  />
               </div>
            </div>

            <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">Effective Period</label>
               <div className="flex gap-4 items-center mb-3">
                  <label className="flex items-center text-sm">
                     <input type="checkbox" checked={overrideForm.isPermanent} onChange={e => setOverrideForm({...overrideForm, isPermanent: e.target.checked})} className="mr-2 rounded text-purple-600" />
                     Permanent (Until Revoked)
                  </label>
               </div>
               
               <div className={`grid grid-cols-2 gap-4 ${overrideForm.isPermanent ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Input label="From" type="date" value={overrideForm.start} onChange={e => setOverrideForm({...overrideForm, start: e.target.value})} />
                  <Input label="To" type="date" value={overrideForm.end} onChange={e => setOverrideForm({...overrideForm, end: e.target.value})} />
               </div>
            </div>

            <Input 
               label="Reason (Mandatory Audit Trail)" 
               placeholder="e.g. Festival Load, Performance Review, Probation" 
               value={overrideForm.reason} 
               onChange={e => setOverrideForm({...overrideForm, reason: e.target.value})} 
               required
            />

            <div className="flex justify-end gap-3 pt-2">
               <Button onClick={() => setShowEdit(false)} variant="secondary">Cancel</Button>
               <Button onClick={handleSaveOverride} disabled={!overrideForm.reason} className="bg-purple-600 hover:bg-purple-700">Save & Apply</Button>
            </div>
         </div>
      </Modal>
    </Layout>
  );
};
