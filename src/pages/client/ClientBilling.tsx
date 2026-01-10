
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { portalService } from '../../services/portalService';
import { Invoice, InvoiceStatus, Receivable, ReceivableStatus, CollectionRecord } from '../../types';
import { 
   CreditCard, 
   FileText, 
   AlertCircle, 
   CheckCircle, 
   Download, 
   Clock, 
   Search, 
   Filter,
   ChevronRight,
   AlertTriangle
} from 'lucide-react';

export const ClientBilling: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'PAYMENTS'>('INVOICES');
  const [loading, setLoading] = useState(true);

  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payments, setPayments] = useState<CollectionRecord[]>([]);

  // Actions
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null); // Invoice or Receivable
  const [payAmount, setPayAmount] = useState(0);
  const [disputeReason, setDisputeReason] = useState('');

  useEffect(() => {
     loadData();
  }, [user]);

  const loadData = async () => {
     if (!user) return;
     setLoading(true);
     try {
        const [inv, rec, pay] = await Promise.all([
           portalService.getInvoices(user),
           portalService.getReceivables(user),
           portalService.getPayments(user)
        ]);
        setInvoices(inv);
        setReceivables(rec);
        setPayments(pay);
     } catch (e) {
        console.error(e);
     } finally {
        setLoading(false);
     }
  };

  // --- Handlers ---
  const handleDownload = async (inv: Invoice) => {
     try {
        const csv = await portalService.downloadInvoice(user!, inv.id);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice_${inv.invoiceNumber}.csv`;
        a.click();
     } catch(e:any) { alert(e.message); }
  };

  const openPayModal = (inv: Invoice) => {
     // Find receivable
     const rec = receivables.find(r => r.invoiceId === inv.id);
     if (!rec) return alert("System Error: Receivable not linked.");
     if (rec.balance <= 0) return alert("Invoice already paid.");

     setSelectedItem(rec);
     setPayAmount(rec.balance);
     setShowPayModal(true);
  };

  const handlePay = async () => {
     if (!selectedItem || payAmount <= 0) return;
     if (payAmount > selectedItem.balance) return alert("Cannot pay more than balance.");
     
     try {
        await portalService.payInvoice(user!, selectedItem.id, payAmount);
        alert("Payment Successful!");
        setShowPayModal(false);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleDispute = async () => {
     if (!selectedItem || !disputeReason) return;
     try {
        await portalService.raiseDispute(user!, selectedItem.id, disputeReason);
        alert("Dispute Raised. Our team will contact you.");
        setShowDisputeModal(false);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const getStatusColor = (status: string) => {
     switch(status) {
        case InvoiceStatus.PAID: return 'bg-green-100 text-green-800';
        case InvoiceStatus.SENT: return 'bg-blue-100 text-blue-800';
        case InvoiceStatus.GENERATED: return 'bg-blue-100 text-blue-800';
        case InvoiceStatus.DISPUTED: return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
     }
  };

  return (
    <Layout>
       <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
             <CreditCard className="mr-3 h-8 w-8 text-brand-600" />
             Billing & Payments
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your invoices and payment history.</p>
       </div>

       <div className="border-b border-gray-200 mb-6">
         <nav className="-mb-px flex space-x-8">
            <button onClick={() => setActiveTab('INVOICES')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'INVOICES' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
               Invoices
            </button>
            <button onClick={() => setActiveTab('PAYMENTS')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'PAYMENTS' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
               Payment History
            </button>
         </nav>
      </div>

      {activeTab === 'INVOICES' && (
         <Table<Invoice>
            data={invoices}
            isLoading={loading}
            columns={[
               { header: 'Invoice #', accessor: 'invoiceNumber', className: 'font-mono font-bold' },
               { header: 'Date', accessor: (i) => new Date(i.generatedAt).toLocaleDateString() },
               { header: 'Period', accessor: (i) => `${i.billingPeriodStart} - ${i.billingPeriodEnd}` },
               { header: 'Amount', accessor: (i) => `₹${i.totalAmount.toLocaleString()}` },
               { 
                  header: 'Balance', 
                  accessor: (i) => {
                     const rec = receivables.find(r => r.invoiceId === i.id);
                     const bal = rec ? rec.balance : 0;
                     return <span className={bal > 0 ? 'font-bold text-red-600' : 'text-green-600'}>₹{bal.toLocaleString()}</span>;
                  }
               },
               { 
                  header: 'Status', 
                  accessor: (i) => (
                     <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(i.status)}`}>
                        {i.status}
                     </span>
                  )
               }
            ]}
            actions={(i) => {
               const rec = receivables.find(r => r.invoiceId === i.id);
               const canPay = rec && rec.balance > 0 && rec.status !== ReceivableStatus.DISPUTED;
               const canDispute = i.status === InvoiceStatus.SENT || i.status === InvoiceStatus.GENERATED;

               return (
                  <div className="flex gap-2 justify-end">
                     {canPay && (
                        <button onClick={() => openPayModal(i)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 shadow-sm">
                           Pay Now
                        </button>
                     )}
                     {canDispute && (
                        <button onClick={() => { setSelectedItem(i); setShowDisputeModal(true); setDisputeReason(''); }} className="text-red-600 hover:text-red-800 text-xs font-bold border border-red-200 px-2 py-1 rounded">
                           Dispute
                        </button>
                     )}
                     <button onClick={() => handleDownload(i)} className="text-gray-500 hover:text-gray-900" title="Download">
                        <Download className="h-4 w-4" />
                     </button>
                  </div>
               );
            }}
         />
      )}

      {activeTab === 'PAYMENTS' && (
         <Table<CollectionRecord>
            data={payments}
            isLoading={loading}
            columns={[
               { header: 'Date', accessor: (p) => new Date(p.recordedAt).toLocaleString() },
               { header: 'Reference', accessor: 'reference', className: 'font-mono text-xs' },
               { header: 'Method', accessor: 'mode' },
               { header: 'Amount', accessor: (p) => `₹${p.amount.toLocaleString()}`, className: 'font-bold text-green-700' },
               { header: 'Status', accessor: 'status' }
            ]}
         />
      )}

      {/* PAY MODAL */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title={`Pay Invoice: ${selectedItem?.invoiceNumber}`}>
         <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded text-center">
               <p className="text-xs text-gray-500 uppercase font-bold">Outstanding Balance</p>
               <p className="text-3xl font-extrabold text-gray-900">₹{selectedItem?.balance.toLocaleString()}</p>
            </div>

            <div>
               <label className="block text-sm font-medium mb-1">Payment Amount</label>
               <Input 
                  type="number" 
                  value={payAmount} 
                  onChange={e => setPayAmount(parseFloat(e.target.value))} 
                  max={selectedItem?.balance}
               />
               <p className="text-xs text-gray-500 mt-1">Partial payments allowed.</p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 p-3 rounded flex items-center">
               <div className="bg-white p-1 rounded border mr-3">
                  <CreditCard className="h-6 w-6 text-brand-600" />
               </div>
               <div>
                  <p className="text-sm font-bold text-blue-900">Secure Checkout</p>
                  <p className="text-xs text-blue-700">Processed by Razorpay</p>
               </div>
            </div>

            <Button onClick={handlePay} className="w-full bg-brand-600 hover:bg-brand-700 h-12 text-lg shadow-lg">
               Pay ₹{payAmount.toLocaleString()}
            </Button>
         </div>
      </Modal>

      {/* DISPUTE MODAL */}
      <Modal isOpen={showDisputeModal} onClose={() => setShowDisputeModal(false)} title="Raise Invoice Dispute">
         <div className="space-y-4">
            <div className="bg-red-50 p-3 rounded border border-red-200 text-sm text-red-800">
               <AlertTriangle className="h-4 w-4 inline mr-2" />
               <strong>Note:</strong> Disputing will pause auto-debit attempts. Our finance team will review your claim within 24 hours.
            </div>
            
            <div>
               <label className="block text-sm font-medium mb-1">Reason for Dispute</label>
               <textarea 
                  className="w-full border rounded p-2 h-24 text-sm"
                  placeholder="Describe the discrepancy..."
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
               />
            </div>
            
            <Button onClick={handleDispute} variant="danger">Submit Dispute</Button>
         </div>
      </Modal>

    </Layout>
  );
};
