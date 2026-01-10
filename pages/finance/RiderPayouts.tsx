
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ledgerService } from '../../services/ledgerService';
import { masterDataService } from '../../services/masterDataService';
import { RiderLedgerEntry, LedgerStatus, PaymentMode, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, CheckCircle2, Clock, Truck, Lock, AlertTriangle, ShieldCheck } from 'lucide-react';

export const RiderPayouts: React.FC = () => {
  const { user } = useAuth();
  const [ledgers, setLedgers] = useState<RiderLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [riders, setRiders] = useState<any[]>([]);
  
  // Action State
  const [actionType, setActionType] = useState<'PAY' | 'HOLD' | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<RiderLedgerEntry | null>(null);
  const [formInput, setFormInput] = useState({ ref: '', date: '', reason: '' });

  const isFinance = user?.role === UserRole.FOUNDER || user?.role === UserRole.FINANCE_ADMIN;

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [ledgerData, riderData] = await Promise.all([
      ledgerService.getRiderLedgers(user),
      masterDataService.getRiders()
    ]);
    // Sort by Date Descending
    setLedgers(ledgerData.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setRiders(riderData);
    setLoading(false);
  };

  const getRiderName = (id: string) => riders.find(r => r.id === id)?.name || id;

  const handleApprove = async (ledger: RiderLedgerEntry) => {
     if (!confirm(`Approve Payout for Runsheet ${ledger.shipmentId}? Amount: ₹${ledger.calculatedAmount}`)) return;
     try {
        await ledgerService.approveLedger(user!, ledger.id);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handlePay = async () => {
     if (!selectedLedger || !formInput.ref || !formInput.date) {
        alert("Reference and Date mandatory for Payment.");
        return;
     }
     try {
        await ledgerService.markPaid(user!, selectedLedger.id, formInput.ref, formInput.date);
        closeModal();
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleHold = async () => {
     if (!selectedLedger || !formInput.reason) {
        alert("Hold Reason mandatory.");
        return;
     }
     try {
        await ledgerService.markOnHold(user!, selectedLedger.id, formInput.reason);
        closeModal();
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const openAction = (type: 'PAY' | 'HOLD', ledger: RiderLedgerEntry) => {
     setSelectedLedger(ledger);
     setActionType(type);
     setFormInput({ ref: '', date: new Date().toISOString().split('T')[0], reason: '' });
  };

  const closeModal = () => {
     setActionType(null);
     setSelectedLedger(null);
  };

  const stats = ledgerService.getStats(ledgers);

  const StatCard = ({ title, amount, icon: Icon, colorClass, bgClass }: any) => (
    <div className={`p-6 rounded-lg border ${bgClass} flex items-start justify-between`}>
      <div>
        <p className={`text-sm font-medium ${colorClass} uppercase tracking-wider`}>{title}</p>
        <p className={`text-2xl font-bold ${colorClass} mt-2`}>₹{amount.toLocaleString()}</p>
      </div>
      <div className={`p-2 rounded-lg bg-white bg-opacity-60`}>
        <Icon className={`h-6 w-6 ${colorClass}`} />
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rider Payout Ledger</h1>
        <p className="text-sm text-gray-500 mt-1">Runsheet-based Financial Tracking (Hard Mode)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Payable (Open)" amount={stats.open} icon={AlertCircle} colorClass="text-blue-700" bgClass="bg-blue-50 border-blue-200" />
        <StatCard title="Approved" amount={stats.approved} icon={CheckCircle2} colorClass="text-purple-700" bgClass="bg-purple-50 border-purple-200" />
        <StatCard title="Paid (YTD)" amount={stats.paid} icon={Truck} colorClass="text-green-700" bgClass="bg-green-50 border-green-200" />
        <div className="p-6 rounded-lg border bg-gray-50 border-gray-200 flex items-center justify-center text-center">
           <div>
              <ShieldCheck className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-bold uppercase">System Lock</p>
              <p className="text-xs text-gray-400">Manual edits disabled</p>
           </div>
        </div>
      </div>

      <Table<RiderLedgerEntry>
        data={ledgers}
        isLoading={loading}
        columns={[
          { header: 'Date', accessor: (row) => new Date(row.createdAt).toLocaleDateString() },
          { header: 'Runsheet Code', accessor: 'shipmentId', className: 'font-mono font-bold text-gray-900' },
          { header: 'Rider', accessor: (row) => getRiderName(row.riderId) },
          { header: 'Type', accessor: 'jobType' },
          { header: 'Payout', accessor: (row) => `₹${row.calculatedAmount}`, className: 'font-bold text-green-700' },
          { 
            header: 'Status', 
            accessor: (row) => {
              const colors: Record<string, string> = {
                [LedgerStatus.OPEN]: 'bg-blue-100 text-blue-800',
                [LedgerStatus.APPROVED]: 'bg-purple-100 text-purple-800',
                [LedgerStatus.PAID]: 'bg-green-100 text-green-800',
                [LedgerStatus.ON_HOLD]: 'bg-red-100 text-red-800',
              };
              return (
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colors[row.ledgerStatus] || 'bg-gray-100'}`}>
                  {row.ledgerStatus}
                </span>
              );
            }
          },
          { header: 'Ref', accessor: (row) => row.razorpayPayoutId || '-' }
        ]}
        actions={isFinance ? (row) => (
           <div className="flex justify-end gap-2">
              {row.ledgerStatus === LedgerStatus.OPEN && (
                 <>
                    <button onClick={() => handleApprove(row)} className="text-purple-600 font-bold text-xs border border-purple-200 px-2 py-1 rounded hover:bg-purple-50">Approve</button>
                    <button onClick={() => openAction('HOLD', row)} className="text-red-600 font-bold text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50">Hold</button>
                 </>
              )}
              {row.ledgerStatus === LedgerStatus.APPROVED && (
                 <button onClick={() => openAction('PAY', row)} className="text-green-600 font-bold text-xs border border-green-200 px-2 py-1 rounded hover:bg-green-50 flex items-center">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Pay
                 </button>
              )}
              {row.ledgerStatus === LedgerStatus.ON_HOLD && (
                 <span className="text-xs text-red-500 italic">Held</span>
              )}
           </div>
        ) : undefined}
      />

      {/* ACTION MODAL */}
      <Modal isOpen={!!actionType} onClose={closeModal} title={actionType === 'PAY' ? 'Record Payment' : 'Hold Payout'}>
         <div className="space-y-4">
            <div className="bg-gray-100 p-3 rounded text-sm mb-4">
               <p>Runsheet: <strong>{selectedLedger?.shipmentId}</strong></p>
               <p>Amount: <strong>₹{selectedLedger?.calculatedAmount}</strong></p>
            </div>

            {actionType === 'PAY' && (
               <>
                  <Input label="Transaction Reference (UTR)" value={formInput.ref} onChange={e => setFormInput({...formInput, ref: e.target.value})} required />
                  <Input label="Payment Date" type="date" value={formInput.date} onChange={e => setFormInput({...formInput, date: e.target.value})} required />
                  <Button onClick={handlePay} className="bg-green-600 hover:bg-green-700">Confirm Payment</Button>
               </>
            )}

            {actionType === 'HOLD' && (
               <>
                  <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-sm text-yellow-800 mb-2">
                     <AlertTriangle className="h-4 w-4 inline mr-2" />
                     Holding a payout requires a valid reason (e.g. Cash Shortage, Audit). This blocks payment.
                  </div>
                  <Input label="Reason for Hold" value={formInput.reason} onChange={e => setFormInput({...formInput, reason: e.target.value})} placeholder="e.g. Cash Shortage of ₹500" required />
                  <Button onClick={handleHold} variant="danger">Confirm Hold</Button>
               </>
            )}
         </div>
      </Modal>
    </Layout>
  );
};
