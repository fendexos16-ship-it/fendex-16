
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { billingService } from '../../services/billingService';
import { clientService } from '../../services/clientService';
import { razorpayService } from '../../services/razorpayService';
import { collectionService } from '../../services/collectionService';
import { reminderService } from '../../services/reminderService';
import { 
  Invoice, 
  InvoiceStatus, 
  Client, 
  UserRole, 
  Receivable, 
  FinancialNote, 
  NoteType, 
  NoteStatus, 
  ReceivableStatus,
  CollectionMode,
  CollectionRecord,
  ReminderConfig,
  ReminderLog,
  ReminderChannel
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Receipt, CheckCircle, AlertTriangle, Send, Lock, Eye, Download, FileText, Plus, ThumbsUp, DollarSign, History, Link as LinkIcon, RefreshCcw, Landmark, Zap, Mail, MessageSquare } from 'lucide-react';

export const ClientInvoicing: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'RECEIVABLES' | 'NOTES' | 'AUTOMATION'>('INVOICES');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [notes, setNotes] = useState<FinancialNote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Invoice Filters
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'DRAFT' | 'SENT'>('ALL');

  // Creation Flow
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [period, setPeriod] = useState({ 
     start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
     end: new Date().toISOString().split('T')[0] 
  });
  const [preview, setPreview] = useState<{count: number, amount: number} | null>(null);
  const [billableShipments, setBillableShipments] = useState<any[]>([]);

  // Action Modal (Invoice)
  const [showInvoiceAction, setShowInvoiceAction] = useState(false);
  const [actionInvoice, setActionInvoice] = useState<Invoice | null>(null);
  const [actionInput, setActionInput] = useState(''); // For Dispute reason

  // Payment Modal (Receivable)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeReceivable, setActiveReceivable] = useState<Receivable | null>(null);
  const [paymentTab, setPaymentTab] = useState<'MANUAL' | 'ONLINE'>('MANUAL');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<CollectionMode>(CollectionMode.BANK_TRANSFER);
  const [razorpayLink, setRazorpayLink] = useState<{url: string, id: string} | null>(null);

  // History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<CollectionRecord[]>([]);

  // Note Modal
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteData, setNoteData] = useState({ type: NoteType.CREDIT_NOTE, amount: 0, reason: '' });

  // Automation State
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig | null>(null);
  const [reminderLogs, setReminderLogs] = useState<ReminderLog[]>([]);
  const [lastRunResults, setLastRunResults] = useState<{ remindersSent: number, penaltiesApplied: number } | null>(null);

  // Access
  if (!user || (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN)) {
     return <Layout><div className="p-8 text-red-600">Restricted</div></Layout>;
  }

  const isFounder = user.role === UserRole.FOUNDER;

  useEffect(() => {
    loadAllData();
  }, [user]);

  // Load Automation Data when tab selected
  useEffect(() => {
     if (activeTab === 'AUTOMATION') loadAutomationData();
  }, [activeTab]);

  const loadAllData = async () => {
    setLoading(true);
    const [inv, rec, not, cli] = await Promise.all([
       billingService.getInvoices(),
       billingService.getReceivables(),
       billingService.getNotes(),
       clientService.getClients()
    ]);
    setInvoices(inv);
    setReceivables(rec);
    setNotes(not);
    setClients(cli);
    setLoading(false);
  };

  const loadAutomationData = async () => {
     setLoading(true);
     const config = await reminderService.getConfig();
     const logs = await reminderService.getLogs(user!);
     setReminderConfig(config);
     setReminderLogs(logs);
     setLoading(false);
  };

  // --- Invoice Logic ---
  const handlePreview = async () => {
     if (!selectedClient) return;
     const res = await billingService.getBillableShipments(user!, selectedClient, period.start, period.end);
     setBillableShipments(res.shipments);
     setPreview({ count: res.shipments.length, amount: res.totalFees });
  };

  const handleCreateDraft = async () => {
     if (!selectedClient || billableShipments.length === 0) return;
     try {
        await billingService.createDraftInvoice(user!, selectedClient, period, billableShipments);
        setShowCreate(false);
        loadAllData();
     } catch(e:any) { alert(e.message); }
  };

  const handleGenerate = async (id: string) => {
     if (!confirm("Generate Final Invoice? This will LOCK all shipments.")) return;
     try {
        await billingService.generateInvoice(user!, id);
        loadAllData();
     } catch(e:any) { alert(e.message); }
  };

  const handleSend = async (id: string) => {
     if (!confirm("Confirm Invoice Sent? This creates a Receivable record.")) return;
     try {
        await billingService.sendInvoice(user!, id);
        loadAllData();
     } catch(e:any) { alert(e.message); }
  };

  const handleDownloadCsv = async (id: string) => {
     try {
        const csv = await billingService.getInvoiceCsv(id);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice_Data_${id}.csv`;
        a.click();
     } catch(e:any) { alert(e.message); }
  };

  const handleDispute = async () => {
     if (!actionInvoice || !actionInput) return alert("Reason Required");
     try {
        await billingService.raiseDispute(user!, actionInvoice.id, actionInput);
        setShowInvoiceAction(false);
        loadAllData();
     } catch(e:any) { alert(e.message); }
  };

  const handleResolve = async (mode: 'ACCEPT_ORIGINAL' | 'VOID') => {
     if (!actionInvoice) return;
     try {
        await billingService.resolveDispute(user!, actionInvoice.id, mode);
        setShowInvoiceAction(false);
        loadAllData();
     } catch(e:any) { alert(e.message); }
  };

  // --- Receivable & Payment Logic ---
  const openPaymentModal = (r: Receivable) => {
     setActiveReceivable(r);
     setPaymentAmount(r.balance);
     setPaymentTab('MANUAL');
     setPaymentMode(CollectionMode.BANK_TRANSFER);
     setRazorpayLink(null);
     setShowPaymentModal(true);
  };

  const handleManualPayment = async () => {
     if (!activeReceivable || paymentAmount <= 0 || !paymentRef) return alert("Invalid Input");
     try {
        await collectionService.processPayment(
           user!, 
           activeReceivable.id, 
           paymentAmount, 
           paymentMode, 
           paymentRef, 
           paymentDate
        );
        setShowPaymentModal(false);
        loadAllData();
     } catch(e:any) { alert(e.message); }
  };

  const handleGenerateLink = async () => {
     if (!activeReceivable) return;
     try {
        // Find client for details (mocked here, ideally fetched)
        const client = clients.find(c => c.id === activeReceivable.clientId);
        
        const link = await razorpayService.createPaymentLink(
           user!, 
           activeReceivable.invoiceId, 
           paymentAmount,
           { name: client?.name || 'Client', phone: '9999999999', email: 'billing@client.com' }
        );
        setRazorpayLink({ url: link.short_url, id: link.id });
     } catch(e:any) { alert(e.message); }
  };

  const handleSimulatePayment = async () => {
     if (!activeReceivable || !razorpayLink) return;
     try {
        await collectionService.processPayment(
           user!, 
           activeReceivable.id, 
           paymentAmount, 
           CollectionMode.RAZORPAY, 
           `RZ_PAY_${Date.now()}`, 
           new Date().toISOString(),
           razorpayLink.id
        );
        setShowPaymentModal(false);
        loadAllData();
     } catch(e:any) { alert(e.message); }
  };

  const handleHistoryView = async (r: Receivable) => {
     const history = await collectionService.getHistory(r.id);
     setHistoryRecords(history);
     setShowHistoryModal(true);
  };

  const handleReversePayment = async (id: string) => {
     if (!isFounder) return alert("Only Founder can reverse payments.");
     if (!confirm("Reverse this payment? This will restore the balance.")) return;
     try {
        await collectionService.reversePayment(user!, id, "Manual Admin Reversal");
        setShowHistoryModal(false);
        loadAllData();
     } catch(e:any) { alert(e.message); }
  };

  // --- Note Logic ---
  const handleIssueNote = async () => {
     if (!activeReceivable || noteData.amount <= 0 || !noteData.reason) return alert("Invalid Input");
     try {
        await billingService.createNote(user!, {
           type: noteData.type,
           invoiceId: activeReceivable.invoiceId,
           amount: noteData.amount,
           reason: noteData.reason
        });
        setShowNoteModal(false);
        setNoteData({ type: NoteType.CREDIT_NOTE, amount: 0, reason: '' });
        loadAllData();
        setActiveTab('NOTES');
     } catch(e:any) { alert(e.message); }
  };

  const handleApproveNote = async (id: string) => {
     try {
        await billingService.approveNote(user!, id);
        loadAllData();
     } catch(e:any) { alert(e.message); }
  };

  const handleApplyNote = async (id: string) => {
     if (!confirm("Apply Note to Receivable balance? Irreversible.")) return;
     try {
        await billingService.applyNote(user!, id);
        loadAllData();
     } catch(e:any) { alert(e.message); }
  };

  // --- Automation Logic ---
  const handleSaveConfig = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!reminderConfig) return;
     try {
        await reminderService.updateConfig(user!, reminderConfig);
        alert("Configuration Saved");
     } catch(e:any) { alert(e.message); }
  };

  const handleRunAutomation = async () => {
     try {
        const res = await reminderService.runDailyChecks(user!);
        setLastRunResults(res);
        loadAutomationData();
     } catch(e:any) { alert(e.message); }
  };

  // Views
  const filteredInvoices = invoices.filter(i => {
     if (invoiceFilter === 'DRAFT') return i.status === InvoiceStatus.DRAFT;
     if (invoiceFilter === 'SENT') return i.status === InvoiceStatus.SENT || i.status === InvoiceStatus.GENERATED;
     return true;
  });

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
               <Receipt className="mr-3 h-8 w-8 text-brand-600" /> Invoicing & Receivables
            </h1>
            <p className="text-sm text-gray-500 mt-1">Financial Operations Center</p>
         </div>
         {activeTab === 'INVOICES' && (
            <Button onClick={() => { setShowCreate(true); setPreview(null); setBillableShipments([]); }} className="w-auto">
               Create Invoice
            </Button>
         )}
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setActiveTab('INVOICES')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'INVOICES' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Invoices</button>
          <button onClick={() => setActiveTab('RECEIVABLES')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'RECEIVABLES' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Receivables</button>
          <button onClick={() => setActiveTab('NOTES')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'NOTES' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Credit/Debit Notes</button>
          {isFounder && <button onClick={() => setActiveTab('AUTOMATION')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'AUTOMATION' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Automation</button>}
        </nav>
      </div>

      {activeTab === 'INVOICES' && (
         <>
            <div className="mb-4 flex gap-2">
               <button onClick={() => setInvoiceFilter('ALL')} className={`px-3 py-1 rounded text-xs border ${invoiceFilter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-white'}`}>All</button>
               <button onClick={() => setInvoiceFilter('DRAFT')} className={`px-3 py-1 rounded text-xs border ${invoiceFilter === 'DRAFT' ? 'bg-gray-800 text-white' : 'bg-white'}`}>Drafts</button>
               <button onClick={() => setInvoiceFilter('SENT')} className={`px-3 py-1 rounded text-xs border ${invoiceFilter === 'SENT' ? 'bg-gray-800 text-white' : 'bg-white'}`}>Active</button>
            </div>
            <Table<Invoice>
               data={filteredInvoices}
               isLoading={loading}
               columns={[
                  { header: 'Invoice #', accessor: (i) => i.invoiceNumber || 'DRAFT', className: 'font-mono font-bold' },
                  { header: 'Client', accessor: 'clientName' },
                  { header: 'Period', accessor: (i) => `${i.billingPeriodStart} to ${i.billingPeriodEnd}` },
                  { header: 'Total', accessor: (i) => `₹${i.totalAmount.toLocaleString()}`, className: 'font-bold' },
                  { 
                     header: 'Status', 
                     accessor: (i) => (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                           i.status === InvoiceStatus.PAID ? 'bg-green-100 text-green-800' :
                           i.status === InvoiceStatus.DISPUTED ? 'bg-red-100 text-red-800' :
                           'bg-blue-100 text-blue-800'
                        }`}>
                           {i.status}
                        </span>
                     ) 
                  }
               ]}
               actions={(i) => (
                  <div className="flex gap-2 justify-end">
                     {i.status === InvoiceStatus.DRAFT && (
                        <button onClick={() => handleGenerate(i.id)} className="text-brand-600 hover:underline text-xs font-bold flex items-center">
                           <Lock className="h-3 w-3 mr-1" /> Finalize
                        </button>
                     )}
                     {i.status === InvoiceStatus.GENERATED && (
                        <button onClick={() => handleSend(i.id)} className="text-blue-600 hover:underline text-xs font-bold flex items-center">
                           <Send className="h-3 w-3 mr-1" /> Send
                        </button>
                     )}
                     {(i.status === InvoiceStatus.SENT || i.status === InvoiceStatus.GENERATED) && (
                        <button onClick={() => { setActionInvoice(i); setActionInput(''); setShowInvoiceAction(true); }} className="text-red-600 hover:underline text-xs font-bold flex items-center">
                           <AlertTriangle className="h-3 w-3 mr-1" /> Dispute
                        </button>
                     )}
                     {i.status === InvoiceStatus.DISPUTED && (
                        <button onClick={() => { setActionInvoice(i); setShowInvoiceAction(true); }} className="text-red-600 hover:underline text-xs font-bold flex items-center">
                           <AlertTriangle className="h-3 w-3 mr-1" /> Resolve
                        </button>
                     )}
                     <button onClick={() => handleDownloadCsv(i.id)} className="text-gray-500 hover:text-gray-900" title="Download CSV">
                        <Download className="h-4 w-4" />
                     </button>
                  </div>
               )}
            />
         </>
      )}

      {activeTab === 'RECEIVABLES' && (
         <Table<Receivable>
            data={receivables}
            isLoading={loading}
            columns={[
               { header: 'Inv #', accessor: 'invoiceNumber', className: 'font-mono' },
               { header: 'Due Date', accessor: (r) => new Date(r.dueDate).toLocaleDateString() },
               { header: 'Total', accessor: (r) => `₹${r.totalAmount.toLocaleString()}` },
               { header: 'Paid', accessor: (r) => `₹${r.amountPaid.toLocaleString()}`, className: 'text-green-600' },
               { header: 'CN/DN', accessor: (r) => <span className="text-xs">-{r.creditApplied} / +{r.debitApplied}</span> },
               { header: 'Balance', accessor: (r) => `₹${r.balance.toLocaleString()}`, className: 'font-bold text-red-600' },
               { 
                  header: 'Status', 
                  accessor: (r) => (
                     <span className={`px-2 py-1 rounded text-xs font-bold ${
                        r.status === ReceivableStatus.PAID ? 'bg-green-100 text-green-800' :
                        r.status === ReceivableStatus.OVERDUE ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                     }`}>
                        {r.status}
                     </span>
                  ) 
               }
            ]}
            actions={(r) => (
               <div className="flex gap-2 justify-end">
                  <button onClick={() => handleHistoryView(r)} className="text-gray-500 hover:text-gray-800 text-xs font-bold flex items-center">
                     <History className="h-3 w-3 mr-1" /> History
                  </button>
                  {r.status !== ReceivableStatus.PAID && r.status !== ReceivableStatus.DISPUTED && (
                     <>
                        <button onClick={() => openPaymentModal(r)} className="text-green-600 hover:underline text-xs font-bold flex items-center">
                           <DollarSign className="h-3 w-3 mr-1" /> Collect
                        </button>
                        <button onClick={() => { setActiveReceivable(r); setShowNoteModal(true); setNoteData({...noteData, amount: 0, reason: ''}); }} className="text-blue-600 hover:underline text-xs font-bold flex items-center">
                           <FileText className="h-3 w-3 mr-1" /> Note
                        </button>
                     </>
                  )}
               </div>
            )}
         />
      )}

      {activeTab === 'NOTES' && (
         <Table<FinancialNote>
            data={notes}
            isLoading={loading}
            columns={[
               { header: 'Note #', accessor: 'noteNumber', className: 'font-mono font-bold' },
               { header: 'Type', accessor: 'type' },
               { header: 'Inv Ref', accessor: (n) => {
                  const r = receivables.find(rec => rec.invoiceId === n.invoiceId);
                  return r ? r.invoiceNumber : n.invoiceId;
               }},
               { header: 'Amount', accessor: (n) => `₹${n.amount.toLocaleString()}`, className: 'font-bold' },
               { header: 'Reason', accessor: 'reason' },
               { 
                  header: 'Status', 
                  accessor: (n) => (
                     <span className={`px-2 py-1 rounded text-xs font-bold ${
                        n.status === NoteStatus.APPLIED ? 'bg-green-100 text-green-800' :
                        n.status === NoteStatus.ISSUED ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                     }`}>
                        {n.status}
                     </span>
                  ) 
               }
            ]}
            actions={(n) => (
               <div className="flex gap-2 justify-end">
                  {n.status === NoteStatus.PENDING_APPROVAL && isFounder && (
                     <button onClick={() => handleApproveNote(n.id)} className="text-purple-600 hover:underline text-xs font-bold flex items-center">
                        <ThumbsUp className="h-3 w-3 mr-1" /> Approve
                     </button>
                  )}
                  {n.status === NoteStatus.ISSUED && (
                     <button onClick={() => handleApplyNote(n.id)} className="text-green-600 hover:underline text-xs font-bold flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" /> Apply
                     </button>
                  )}
               </div>
            )}
         />
      )}

      {activeTab === 'AUTOMATION' && isFounder && reminderConfig && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Config Panel */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-gray-900 flex items-center"><Zap className="h-5 w-5 mr-2 text-yellow-600"/> Engine Configuration</h3>
                  <Button onClick={handleRunAutomation} className="w-auto h-9 text-xs bg-gray-800 hover:bg-black">Run Now</Button>
               </div>

               {lastRunResults && (
                  <div className="bg-green-50 p-3 rounded border border-green-200 mb-4 text-sm text-green-800">
                     <strong>Check Complete:</strong> Sent {lastRunResults.remindersSent} reminders, Applied {lastRunResults.penaltiesApplied} penalties.
                  </div>
               )}

               <form onSubmit={handleSaveConfig} className="space-y-6">
                  <div className="flex items-center space-x-2">
                     <input type="checkbox" checked={reminderConfig.enabled} onChange={e => setReminderConfig({...reminderConfig, enabled: e.target.checked})} className="h-5 w-5 text-brand-600" />
                     <span className="font-bold text-gray-700">Enable Automated Engine</span>
                  </div>

                  <div className="border-t pt-4">
                     <h4 className="text-xs font-bold uppercase text-gray-500 mb-3">Reminder Schedule (Days relative to Due Date)</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <Input label="Before Due (T-)" type="number" value={reminderConfig.schedule.beforeDueDays} onChange={e => setReminderConfig({...reminderConfig, schedule: {...reminderConfig.schedule, beforeDueDays: parseInt(e.target.value)}})} />
                        <Input label="Overdue Stage 1 (T+)" type="number" value={reminderConfig.schedule.overdueDays1} onChange={e => setReminderConfig({...reminderConfig, schedule: {...reminderConfig.schedule, overdueDays1: parseInt(e.target.value)}})} />
                        <Input label="Overdue Stage 2 (T+)" type="number" value={reminderConfig.schedule.overdueDays2} onChange={e => setReminderConfig({...reminderConfig, schedule: {...reminderConfig.schedule, overdueDays2: parseInt(e.target.value)}})} />
                        <Input label="Escalation (T+)" type="number" value={reminderConfig.schedule.escalationDays} onChange={e => setReminderConfig({...reminderConfig, schedule: {...reminderConfig.schedule, escalationDays: parseInt(e.target.value)}})} />
                     </div>
                  </div>

                  <div className="border-t pt-4">
                     <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold uppercase text-gray-500">Overdue Penalties</h4>
                        <label className="flex items-center text-xs">
                           <input type="checkbox" checked={reminderConfig.penalty.enabled} onChange={e => setReminderConfig({...reminderConfig, penalty: {...reminderConfig.penalty, enabled: e.target.checked}})} className="mr-1" />
                           Active
                        </label>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-medium mb-1">Type</label>
                           <select className="w-full border rounded p-2" value={reminderConfig.penalty.type} onChange={e => setReminderConfig({...reminderConfig, penalty: {...reminderConfig.penalty, type: e.target.value as any}})}>
                              <option value="FLAT">Flat Fee (₹)</option>
                              <option value="PERCENTAGE">Percentage (%)</option>
                           </select>
                        </div>
                        <Input label="Value" type="number" value={reminderConfig.penalty.value} onChange={e => setReminderConfig({...reminderConfig, penalty: {...reminderConfig.penalty, value: parseFloat(e.target.value)}})} />
                     </div>
                  </div>

                  <Button type="submit">Save Configuration</Button>
               </form>
            </div>

            {/* Logs Panel */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-[600px]">
               <div className="p-4 border-b bg-gray-50 font-bold text-gray-800">
                  Automation Logs
               </div>
               <div className="flex-1 overflow-y-auto p-0">
                  {reminderLogs.length === 0 ? (
                     <div className="p-8 text-center text-gray-500">No logs found.</div>
                  ) : (
                     <table className="w-full text-xs text-left">
                        <thead className="bg-white sticky top-0">
                           <tr>
                              <th className="p-2 border-b">Time</th>
                              <th className="p-2 border-b">Channel</th>
                              <th className="p-2 border-b">Client</th>
                              <th className="p-2 border-b">Template</th>
                           </tr>
                        </thead>
                        <tbody>
                           {reminderLogs.map(log => (
                              <tr key={log.id} className="border-b hover:bg-gray-50">
                                 <td className="p-2 text-gray-500">{new Date(log.sentAt).toLocaleString()}</td>
                                 <td className="p-2 flex items-center">
                                    {log.channel === 'EMAIL' ? <Mail className="h-3 w-3 mr-1"/> : <MessageSquare className="h-3 w-3 mr-1"/>}
                                    {log.channel}
                                 </td>
                                 <td className="p-2 font-mono">{log.clientId}</td>
                                 <td className="p-2 text-gray-700 truncate max-w-[200px]" title={log.template}>{log.template}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  )}
               </div>
            </div>
         </div>
      )}

      {/* CREATE INVOICE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Service Invoice">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Client</label>
               <select className="w-full border rounded p-2" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                  <option value="">Select Client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <Input label="Start Date" type="date" value={period.start} onChange={e => setPeriod({...period, start: e.target.value})} />
               <Input label="End Date" type="date" value={period.end} onChange={e => setPeriod({...period, end: e.target.value})} />
            </div>
            <Button onClick={handlePreview} variant="secondary">Check Billable Items</Button>
            
            {preview && (
               <div className="bg-gray-50 p-4 rounded border border-gray-200 text-center">
                  <p className="text-sm text-gray-600">Found {preview.count} unbilled shipments</p>
                  <p className="text-2xl font-bold text-brand-600">Est. ₹{preview.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">+ Taxes will be applied</p>
               </div>
            )}

            <Button onClick={handleCreateDraft} disabled={!preview || preview.count === 0}>Create Draft</Button>
         </div>
      </Modal>

      {/* INVOICE ACTION MODAL */}
      <Modal isOpen={showInvoiceAction} onClose={() => setShowInvoiceAction(false)} title={`Manage Invoice: ${actionInvoice?.invoiceNumber}`}>
         <div className="space-y-4">
            {actionInvoice?.status === InvoiceStatus.DISPUTED ? (
               <div className="space-y-4">
                  <div className="bg-red-50 p-3 rounded text-red-800 text-sm">
                     <strong>Dispute Reason:</strong> {actionInvoice.disputeReason}
                  </div>
                  <div className="flex gap-2">
                     <Button onClick={() => handleResolve('ACCEPT_ORIGINAL')} className="bg-green-600">Reject Dispute (Enforce Original)</Button>
                     <Button onClick={() => handleResolve('VOID')} variant="danger">Void Invoice (Accept Dispute)</Button>
                  </div>
               </div>
            ) : (
               <>
                  <Input label="Dispute Reason" value={actionInput} onChange={e => setActionInput(e.target.value)} placeholder="Reason for dispute" />
                  <Button onClick={handleDispute} variant="danger" className="bg-red-600">Raise Dispute</Button>
               </>
            )}
         </div>
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title={`Collect Payment`}>
         <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded text-center">
                <p className="text-xs uppercase text-gray-500">Outstanding Balance</p>
                <p className="text-2xl font-bold text-red-600">₹{activeReceivable?.balance.toLocaleString()}</p>
            </div>

            <div className="flex border-b border-gray-200">
               <button onClick={() => setPaymentTab('MANUAL')} className={`flex-1 py-2 text-sm font-medium ${paymentTab === 'MANUAL' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>Manual Entry</button>
               <button onClick={() => setPaymentTab('ONLINE')} className={`flex-1 py-2 text-sm font-medium ${paymentTab === 'ONLINE' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>Razorpay Link</button>
            </div>

            {paymentTab === 'MANUAL' && (
               <div className="space-y-4 animate-fade-in-up">
                  <div className="grid grid-cols-2 gap-4">
                     <Input label="Amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value))} />
                     <Input label="Date" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                  </div>
                  <div>
                     <label className="block text-sm font-medium mb-1">Mode</label>
                     <select className="w-full border rounded p-2" value={paymentMode} onChange={e => setPaymentMode(e.target.value as CollectionMode)}>
                        <option value={CollectionMode.BANK_TRANSFER}>Bank Transfer (NEFT/IMPS)</option>
                        <option value={CollectionMode.CHEQUE}>Cheque</option>
                        <option value={CollectionMode.CASH}>Cash Deposit</option>
                     </select>
                  </div>
                  <Input label="Reference ID" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="UTR / Cheque No" required />
                  <Button onClick={handleManualPayment} className="bg-green-600 hover:bg-green-700"><Landmark className="h-4 w-4 mr-2" /> Record Payment</Button>
               </div>
            )}

            {paymentTab === 'ONLINE' && (
               <div className="space-y-4 animate-fade-in-up">
                  <Input label="Amount to Request" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value))} />
                  
                  {!razorpayLink ? (
                     <Button onClick={handleGenerateLink} className="bg-blue-600 hover:bg-blue-700">
                        <LinkIcon className="h-4 w-4 mr-2" /> Generate Payment Link
                     </Button>
                  ) : (
                     <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                        <p className="text-xs text-blue-800 font-bold mb-1">Link Generated</p>
                        <a href="#" className="text-sm text-blue-600 underline break-all">{razorpayLink.url}</a>
                        <p className="text-[10px] text-gray-500 mt-2">Share this with client.</p>
                        
                        <div className="mt-4 pt-4 border-t border-blue-200">
                           <Button onClick={handleSimulatePayment} className="bg-green-600 hover:bg-green-700 h-8 text-xs w-auto">
                              Simulate Success (Dev)
                           </Button>
                        </div>
                     </div>
                  )}
               </div>
            )}
         </div>
      </Modal>

      {/* HISTORY MODAL */}
      <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="Payment History">
         <div className="space-y-4">
            {historyRecords.length === 0 ? (
               <p className="text-center text-gray-500 p-4">No payments recorded.</p>
            ) : (
               <div className="border rounded max-h-60 overflow-y-auto">
                  <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50">
                        <tr>
                           <th className="p-2">Date</th>
                           <th className="p-2">Mode</th>
                           <th className="p-2">Ref</th>
                           <th className="p-2">Amount</th>
                           <th className="p-2">Status</th>
                           <th className="p-2">Action</th>
                        </tr>
                     </thead>
                     <tbody>
                        {historyRecords.map(h => (
                           <tr key={h.id} className="border-t">
                              <td className="p-2">{new Date(h.date).toLocaleDateString()}</td>
                              <td className="p-2 text-xs">{h.mode}</td>
                              <td className="p-2 font-mono text-xs">{h.reference}</td>
                              <td className="p-2 font-bold">₹{h.amount}</td>
                              <td className="p-2"><span className={`text-[10px] px-1 rounded ${h.status === 'SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{h.status}</span></td>
                              <td className="p-2">
                                 {h.status === 'SUCCESS' && isFounder && (
                                    <button onClick={() => handleReversePayment(h.id)} className="text-red-600 hover:text-red-800 text-xs underline">Reverse</button>
                                 )}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
            <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>Close</Button>
         </div>
      </Modal>

      {/* NOTE MODAL */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title="Issue Credit/Debit Note">
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium mb-1">Type</label>
               <select className="w-full border rounded p-2" value={noteData.type} onChange={e => setNoteData({...noteData, type: e.target.value as NoteType})}>
                  <option value={NoteType.CREDIT_NOTE}>Credit Note (Reduce Balance)</option>
                  <option value={NoteType.DEBIT_NOTE}>Debit Note (Increase Balance)</option>
               </select>
            </div>
            <Input label="Amount" type="number" value={noteData.amount} onChange={e => setNoteData({...noteData, amount: parseFloat(e.target.value)})} />
            <Input label="Reason" value={noteData.reason} onChange={e => setNoteData({...noteData, reason: e.target.value})} placeholder="e.g. Damaged Goods, Rate Adjustment" />
            <Button onClick={handleIssueNote}>Issue Note</Button>
         </div>
      </Modal>
    </Layout>
  );
};
