import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { slaService } from '../../services/slaService';
import { useAuth } from '../../context/AuthContext';
import { SlaRecord, SlaAdjustment, UserRole, SlaBucket, SlaState, AdjustmentType } from '../../types';
import { Gauge, AlertTriangle, TrendingUp, CheckCircle, ThumbsUp, ThumbsDown, UserCheck } from 'lucide-react';

export const SlaManager: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'SHIPMENTS' | 'ADJUSTMENTS'>('DASHBOARD');
  const [loading, setLoading] = useState(false);

  // Data
  const [stats, setStats] = useState<any>({});
  const [records, setRecords] = useState<SlaRecord[]>([]);
  const [pendingAdjustments, setPendingAdjustments] = useState<any[]>([]);
  const [committedAdjustments, setCommittedAdjustments] = useState<SlaAdjustment[]>([]);

  // Modals
  const [approveModal, setApproveModal] = useState(false);
  const [selectedPending, setSelectedPending] = useState<any>(null);
  const [note, setNote] = useState('');

  const isFounder = user?.role === UserRole.FOUNDER;

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    
    // Stats
    const s = await slaService.getSlaStats();
    setStats(s);

    // Records
    const recs = await slaService.getRecords(user);
    setRecords(recs);

    // Adjustments (Founder only sees pending)
    if (isFounder) {
      const pending = await slaService.getPendingAdjustments(user);
      setPendingAdjustments(pending);
    }
    
    const committed = await slaService.getCommittedAdjustments(user);
    setCommittedAdjustments(committed);

    setLoading(false);
  };

  const handleApprove = async () => {
    if (!selectedPending || !note) return;
    try {
      await slaService.approveAdjustment(
        user!, 
        selectedPending.record.shipmentId, 
        selectedPending.suggestion.code, 
        note
      );
      setApproveModal(false);
      setNote('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async (shipmentId: string) => {
    if (!window.confirm('Exempt this shipment from SLA penalties/incentives?')) return;
    try {
      await slaService.rejectAdjustment(user!, shipmentId);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Gauge className="mr-3 h-8 w-8 text-brand-600" />
          SLA & Performance
        </h1>
        <p className="text-sm text-gray-500 mt-1">Delivery timing analysis, penalties, and performance incentives.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
         <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <p className="text-xs font-bold text-green-700 uppercase">D0 Deliveries (Same Day)</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{stats.d0 || 0}</p>
            <p className="text-xs text-green-600 mt-1">Qualified for Incentive</p>
         </div>
         <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p className="text-xs font-bold text-blue-700 uppercase">D1 Deliveries (Next Day)</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{stats.d1 || 0}</p>
            <p className="text-xs text-blue-600 mt-1">Standard SLA Met</p>
         </div>
         <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <p className="text-xs font-bold text-red-700 uppercase">D2+ Late / Breached</p>
            <p className="text-2xl font-bold text-red-900 mt-1">{stats.d2plus || 0}</p>
            <p className="text-xs text-red-600 mt-1">Penalty Eligible</p>
         </div>
         <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-xs font-bold text-gray-700 uppercase">Pending Adjustments</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{pendingAdjustments.length}</p>
            <p className="text-xs text-gray-500 mt-1">Action Required</p>
         </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setActiveTab('DASHBOARD')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'DASHBOARD' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Overview</button>
          <button onClick={() => setActiveTab('SHIPMENTS')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'SHIPMENTS' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Shipment Performance</button>
          <button onClick={() => setActiveTab('ADJUSTMENTS')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'ADJUSTMENTS' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Financial Adjustments</button>
        </nav>
      </div>

      {activeTab === 'DASHBOARD' && (
         <div className="bg-white p-8 rounded border border-gray-200 text-center text-gray-500">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
            <p>Drill down into Shipments to see specific SLA breaches or visit Adjustments to approve penalties.</p>
         </div>
      )}

      {activeTab === 'SHIPMENTS' && (
         <Table<SlaRecord>
            data={records}
            isLoading={loading}
            columns={[
               { header: 'AWB', accessor: 'shipmentId', className: 'font-mono text-xs' },
               { header: 'Rider', accessor: 'riderId' },
               { header: 'Promised', accessor: (r) => new Date(r.promisedDate).toLocaleDateString() },
               { header: 'Actual', accessor: (r) => new Date(r.actualDeliveryDate).toLocaleDateString() },
               { 
                  header: 'Bucket', 
                  accessor: (r) => (
                     <span className={`px-2 py-1 rounded text-xs font-bold ${
                        r.slaBucket === SlaBucket.D0 ? 'bg-green-100 text-green-800' : 
                        r.slaBucket === SlaBucket.D2_PLUS ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                     }`}>
                        {r.slaBucket}
                     </span>
                  ) 
               },
               { header: 'Reason', accessor: (r) => r.breachReason || '-' }
            ]}
         />
      )}

      {activeTab === 'ADJUSTMENTS' && (
         <div className="space-y-8">
            {isFounder && (
               <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                     <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                     Pending Approval ({pendingAdjustments.length})
                  </h3>
                  {pendingAdjustments.length === 0 ? (
                     <p className="text-sm text-gray-500 italic">No pending adjustments.</p>
                  ) : (
                     <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                           <thead className="bg-gray-50">
                              <tr>
                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AWB</th>
                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rider</th>
                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
                                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                              </tr>
                           </thead>
                           <tbody className="bg-white divide-y divide-gray-200">
                              {pendingAdjustments.map((item, idx) => (
                                 <tr key={idx}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{item.record.shipmentId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.record.riderId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                       <span className={`font-bold ${item.suggestion.type === AdjustmentType.PENALTY ? 'text-red-600' : 'text-green-600'}`}>
                                          {item.suggestion.desc}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                       {item.suggestion.type === AdjustmentType.PENALTY ? '-' : '+'}₹{item.suggestion.amount}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                       <button onClick={() => handleReject(item.record.shipmentId)} className="text-gray-400 hover:text-gray-600">Ignore</button>
                                       <button onClick={() => { setSelectedPending(item); setApproveModal(true); }} className="text-brand-600 hover:text-brand-900 font-bold">Approve</button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  )}
               </div>
            )}

            <div>
               <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  Committed Adjustments (Future Cycle)
               </h3>
               <Table<SlaAdjustment>
                  data={committedAdjustments}
                  isLoading={loading}
                  columns={[
                     { header: 'ID', accessor: 'id', className: 'font-mono text-xs' },
                     { header: 'Entity', accessor: 'entityId' },
                     { header: 'Type', accessor: (a) => <span className={`text-xs font-bold ${a.adjustmentType === AdjustmentType.PENALTY ? 'text-red-600' : 'text-green-600'}`}>{a.adjustmentType}</span> },
                     { header: 'Amount', accessor: (a) => `₹${a.amount}`, className: 'font-bold' },
                     { header: 'Reason', accessor: 'ruleCode', className: 'text-xs' },
                     { header: 'Approved By', accessor: 'approvedBy' },
                     { header: 'Date', accessor: (a) => new Date(a.approvedAt).toLocaleDateString() }
                  ]}
               />
            </div>
         </div>
      )}

      {/* Approve Modal */}
      <Modal isOpen={approveModal} onClose={() => setApproveModal(false)} title="Confirm Adjustment">
         {selectedPending && (
            <div className="space-y-4">
               <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <div className="flex justify-between mb-2">
                     <span className="text-sm text-gray-500">Rule:</span>
                     <span className="text-sm font-bold text-gray-900">{selectedPending.suggestion.desc}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-sm text-gray-500">Amount:</span>
                     <span className={`text-xl font-bold ${selectedPending.suggestion.type === AdjustmentType.PENALTY ? 'text-red-600' : 'text-green-600'}`}>
                        {selectedPending.suggestion.type === AdjustmentType.PENALTY ? '-' : '+'}₹{selectedPending.suggestion.amount}
                     </span>
                  </div>
               </div>
               
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Approval Note (Mandatory)</label>
                  <textarea 
                     className="w-full border border-gray-300 rounded p-2 text-sm"
                     placeholder="Reason for approval..."
                     value={note}
                     onChange={e => setNote(e.target.value)}
                  />
               </div>

               <div className="flex justify-end gap-2 pt-4">
                  <Button variant="secondary" onClick={() => setApproveModal(false)}>Cancel</Button>
                  <Button onClick={handleApprove}>Confirm Approval</Button>
               </div>
            </div>
         )}
      </Modal>

    </Layout>
  );
};