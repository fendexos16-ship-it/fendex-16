
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { settlementService } from '../../services/settlementService';
import { clientService } from '../../services/clientService';
import { 
  UserRole, 
  Client, 
  ClientSettlementBatch, 
  SettlementState, 
  SettlementCycle, 
  ClientSettlementRow 
} from '../../types';
import { 
  Briefcase, 
  CheckCircle, 
  Download, 
  FileText,
  FileSpreadsheet,
  File,
  Info
} from 'lucide-react';

export const ClientSettlementManager: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'BALANCES' | 'BATCHES'>('BALANCES');
  const [loading, setLoading] = useState(false);
  
  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [ledgerStats, setLedgerStats] = useState<Record<string, any>>({});
  const [batches, setBatches] = useState<ClientSettlementBatch[]>([]);
  
  // Generation Modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [onlyDeposited, setOnlyDeposited] = useState(true);
  
  // Preview Data
  const [previewRows, setPreviewRows] = useState<ClientSettlementRow[]>([]);
  const [previewTotals, setPreviewTotals] = useState({ cod: 0, fees: 0, net: 0 });
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Settlement Action Modal
  const [showAction, setShowAction] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ClientSettlementBatch | null>(null);
  const [actionInputs, setActionInputs] = useState({ ref: '', notes: '' });

  // Access
  const isFounder = user?.role === UserRole.FOUNDER;

  useEffect(() => {
    loadClients();
    if (activeTab === 'BATCHES') loadBatches();
  }, [activeTab]);

  const loadClients = async () => {
    setLoading(true);
    const list = await clientService.getClients();
    setClients(list);
    
    // Async load stats
    const stats: Record<string, any> = {};
    for (const c of list) {
       stats[c.id] = await settlementService.getClientLedger(c.id);
    }
    setLedgerStats(stats);
    setLoading(false);
  };

  const loadBatches = async () => {
    setLoading(true);
    const data = await settlementService.getBatches();
    setBatches(data.sort((a,b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
    setLoading(false);
  };

  const handleGeneratePreview = async () => {
    if (!selectedClient) return;
    try {
      const data = await settlementService.generateStatement(user!, selectedClient.id, dateRange.start, dateRange.end, onlyDeposited);
      setPreviewRows(data.rows);
      setPreviewTotals(data.totals);
      setIsPreviewing(true);
    } catch(e:any) { alert(e.message); }
  };

  const handleCreateBatch = async () => {
    if (!selectedClient || previewRows.length === 0) return;
    if (!confirm(`Generate Settlement Statement for ₹${previewTotals.net}? This will LOCK ${previewRows.length} shipments.`)) return;
    
    try {
      await settlementService.createBatch(user!, selectedClient.id, dateRange, previewRows);
      setShowGenerate(false);
      setIsPreviewing(false);
      setActiveTab('BATCHES');
      loadBatches();
    } catch(e:any) { alert(e.message); }
  };

  const handleBatchAction = async (status: SettlementState) => {
     if (!selectedBatch) return;
     if (status === SettlementState.SETTLED && !actionInputs.ref) return alert("Bank Reference Required for Settlement.");
     
     try {
        await settlementService.updateStatus(user!, selectedBatch.id, status, actionInputs.ref, actionInputs.notes);
        setShowAction(false);
        loadBatches();
     } catch(e:any) { alert(e.message); }
  };

  // EXPORT HANDLER
  const handleExport = async (batch: ClientSettlementBatch, type: 'CSV' | 'EXCEL' | 'PDF') => {
    if (!isFounder) return;
    
    try {
      // 1. Fetch Full Report Data
      const reportRows = await settlementService.getBatchReport(batch.id);
      const fileName = `Settlement_${batch.clientName.replace(/\s+/g, '_')}_${batch.batchCode}`;

      // 2. Format Logic
      if (type === 'CSV') {
         const headers = ['Client', 'AWB', 'Delivery Date', 'COD Amount', 'Freight', 'COD Fee', 'Total Deduction', 'Net Amount', 'Rider Collected', 'Deposit Ref', 'Status', 'Settlement Ref'];
         const csvRows = reportRows.map(r => 
            `"${r.clientName}","${r.awb}","${r.deliveryDate}",${r.codAmount},${r.freightAmount},${r.codFee},${r.totalFees},${r.netAmount},"${r.riderCollectedDate}","${r.cmsDepositRef}","${r.settlementStatus}","${r.settlementRef}"`
         );
         const csvContent = [headers.join(','), ...csvRows].join('\n');
         
         const blob = new Blob([csvContent], { type: 'text/csv' });
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `${fileName}.csv`;
         a.click();
      } 
      else if (type === 'EXCEL') {
         const table = `
            <table border="1">
               <thead>
                  <tr>
                     <th>Client</th><th>AWB</th><th>Delivery Date</th><th>COD Amount</th>
                     <th>Freight</th><th>COD Fee</th><th>Total Deductions</th><th>Net Amount</th>
                     <th>Collected Date</th><th>Deposit Ref</th><th>Status</th><th>Settlement Ref</th>
                  </tr>
               </thead>
               <tbody>
                  ${reportRows.map(r => `
                     <tr>
                        <td>${r.clientName}</td>
                        <td style="mso-number-format:'\@'">${r.awb}</td>
                        <td>${r.deliveryDate}</td>
                        <td>${r.codAmount}</td>
                        <td>${r.freightAmount}</td>
                        <td>${r.codFee}</td>
                        <td>${r.totalFees}</td>
                        <td>${r.netAmount}</td>
                        <td>${r.riderCollectedDate}</td>
                        <td>${r.cmsDepositRef}</td>
                        <td>${r.settlementStatus}</td>
                        <td>${r.settlementRef}</td>
                     </tr>
                  `).join('')}
               </tbody>
            </table>
         `;
         const blob = new Blob([table], { type: 'application/vnd.ms-excel' });
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `${fileName}.xls`;
         a.click();
      }
      else if (type === 'PDF') {
         const win = window.open('', '_blank');
         if (win) {
            win.document.write(`
               <html>
                  <head>
                     <title>${fileName}</title>
                     <style>
                        body { font-family: sans-serif; padding: 20px; }
                        h1 { font-size: 18px; margin-bottom: 5px; }
                        p { font-size: 12px; color: #555; }
                        table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                        th { background-color: #f3f4f6; }
                        .total { font-weight: bold; text-align: right; margin-top: 20px; font-size: 14px; }
                     </style>
                  </head>
                  <body>
                     <h1>FENDEX LOGISTICS - Settlement Statement</h1>
                     <p>Batch: ${batch.batchCode} | Client: ${batch.clientName}</p>
                     <p>Period: ${batch.periodStart} to ${batch.periodEnd}</p>
                     <p>Status: ${batch.status} | Date: ${new Date().toLocaleDateString()}</p>
                     
                     <table>
                        <thead>
                           <tr>
                              <th>AWB</th>
                              <th>Date</th>
                              <th>COD (INR)</th>
                              <th>Freight</th>
                              <th>COD Fee</th>
                              <th>Deduction</th>
                              <th>Net (INR)</th>
                           </tr>
                        </thead>
                        <tbody>
                           ${reportRows.map(r => `
                              <tr>
                                 <td>${r.awb}</td>
                                 <td>${r.deliveryDate}</td>
                                 <td>${r.codAmount}</td>
                                 <td>${r.freightAmount}</td>
                                 <td>${r.codFee}</td>
                                 <td>${r.totalFees}</td>
                                 <td>${r.netAmount}</td>
                              </tr>
                           `).join('')}
                        </tbody>
                     </table>
                     
                     <div class="total">
                        Total Payable: INR ${batch.netAmount.toLocaleString()}
                     </div>
                     <p style="font-size: 10px; color: #888; margin-top: 10px;">Generated by Fendex Logistics System. Trace ID: ${Date.now()}</p>
                     <script>window.print();</script>
                  </body>
               </html>
            `);
            win.document.close();
         }
      }

    } catch (e: any) {
      alert("Export Failed: " + e.message);
    }
  };

  if (!isFounder) return <Layout><div className="p-8 text-red-600">Restricted Access</div></Layout>;

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
             <Briefcase className="mr-3 h-8 w-8 text-brand-600" /> Client Settlement Engine
          </h1>
          <p className="text-sm text-gray-500 mt-1">Reconcile 3PL COD and Generate Statements</p>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setActiveTab('BALANCES')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'BALANCES' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500'}`}>
             Client Balances
          </button>
          <button onClick={() => setActiveTab('BATCHES')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'BATCHES' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500'}`}>
             Settlement History
          </button>
        </nav>
      </div>

      {activeTab === 'BALANCES' && (
         <>
            <Table<Client>
               data={clients}
               isLoading={loading}
               columns={[
                  { header: 'Client Name', accessor: 'name', className: 'font-bold' },
                  { header: 'Code', accessor: 'clientCode', className: 'font-mono text-xs' },
                  { header: 'Cycle', accessor: (c) => c.settlementCycle || '-' },
                  { 
                     header: 'Total COD Collected', 
                     accessor: (c) => `₹${(ledgerStats[c.id]?.totalCollected || 0).toLocaleString()}`,
                     className: 'text-gray-500'
                  },
                  { 
                     header: 'Settled', 
                     accessor: (c) => `₹${(ledgerStats[c.id]?.totalSettled || 0).toLocaleString()}`,
                     className: 'text-green-600'
                  },
                  { 
                     header: 'Unsettled Balance', 
                     accessor: (c) => {
                        const val = ledgerStats[c.id]?.unsettled || 0;
                        return <span className={`font-bold ${val > 0 ? 'text-blue-600' : 'text-gray-400'}`}>₹{val.toLocaleString()}</span>;
                     }
                  }
               ]}
               actions={(c) => (
                  <Button 
                     onClick={() => { setSelectedClient(c); setIsPreviewing(false); setShowGenerate(true); }}
                     className="w-auto h-8 text-xs bg-brand-600 hover:bg-brand-700"
                  >
                     Generate Statement
                  </Button>
               )}
            />
         </>
      )}

      {activeTab === 'BATCHES' && (
         <Table<ClientSettlementBatch>
            data={batches}
            isLoading={loading}
            columns={[
               { header: 'Batch Code', accessor: 'batchCode', className: 'font-mono font-bold' },
               { header: 'Client', accessor: 'clientName' },
               { header: 'Generated', accessor: (b) => new Date(b.generatedAt).toLocaleDateString() },
               { header: 'Gross COD', accessor: (b) => `₹${b.totalCodAmount.toLocaleString()}`, className: 'text-gray-500' },
               { header: 'Fees', accessor: (b) => `₹${b.totalFees.toLocaleString()}`, className: 'text-red-600' },
               { header: 'Net Amount', accessor: (b) => `₹${b.netAmount.toLocaleString()}`, className: 'font-bold text-gray-900' },
               { 
                  header: 'Status', 
                  accessor: (b) => (
                     <span className={`px-2 py-1 rounded text-xs font-bold ${
                        b.status === SettlementState.SETTLED ? 'bg-green-100 text-green-800' : 
                        b.status === SettlementState.DRAFT ? 'bg-gray-200 text-gray-800' : 
                        'bg-blue-100 text-blue-800'
                     }`}>
                        {b.status}
                     </span>
                  ) 
               }
            ]}
            actions={(b) => (
               <div className="flex gap-2">
                  <button onClick={() => handleExport(b, 'EXCEL')} className="text-green-600 hover:text-green-800" title="Excel Export">
                     <FileSpreadsheet className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleExport(b, 'CSV')} className="text-gray-600 hover:text-gray-800" title="CSV Export">
                     <File className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleExport(b, 'PDF')} className="text-red-600 hover:text-red-800" title="PDF Export">
                     <FileText className="h-4 w-4" />
                  </button>
                  <div className="w-px h-4 bg-gray-300 mx-1"></div>
                  <button onClick={() => { setSelectedBatch(b); setShowAction(true); }} className="text-brand-600 font-bold text-xs hover:underline">
                     Manage
                  </button>
               </div>
            )}
         />
      )}

      {/* GENERATE MODAL */}
      <Modal isOpen={showGenerate} onClose={() => setShowGenerate(false)} title={`New Settlement: ${selectedClient?.name}`}>
         <div className="space-y-4">
            {!isPreviewing ? (
               <>
                  <div className="grid grid-cols-2 gap-4">
                     <Input label="Start Date" type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                     <Input label="End Date" type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                  </div>
                  <div className="flex items-center space-x-2 bg-yellow-50 p-3 rounded border border-yellow-200">
                     <input type="checkbox" checked={onlyDeposited} onChange={e => setOnlyDeposited(e.target.checked)} className="rounded text-brand-600" />
                     <span className="text-sm font-medium text-yellow-900">Include ONLY Bank Deposited COD (Safe)</span>
                  </div>
                  <div className="pt-2">
                     <Button onClick={handleGeneratePreview}>Preview Statement</Button>
                  </div>
               </>
            ) : (
               <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded border border-blue-200 flex justify-between items-center">
                     <div>
                        <p className="text-xs text-blue-600 uppercase">Net Payable</p>
                        <p className="text-2xl font-bold text-blue-900">₹{previewTotals.net.toLocaleString()}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-xs text-gray-500">{previewRows.length} Shipments</p>
                        <p className="text-xs text-gray-500">Gross COD: ₹{previewTotals.cod.toLocaleString()}</p>
                        <p className="text-xs text-red-500">Fees: -₹{previewTotals.fees.toLocaleString()}</p>
                     </div>
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto border rounded text-sm">
                     <table className="min-w-full">
                        <thead className="bg-gray-50 sticky top-0">
                           <tr>
                              <th className="px-2 py-1 text-left">AWB</th>
                              <th className="px-2 py-1 text-right">COD</th>
                              <th className="px-2 py-1 text-right">Fee</th>
                              <th className="px-2 py-1 text-right">Net</th>
                           </tr>
                        </thead>
                        <tbody>
                           {previewRows.map(r => (
                              <tr key={r.awb} className="border-t">
                                 <td className="px-2 py-1 font-mono text-xs">{r.awb}</td>
                                 <td className="px-2 py-1 text-right">₹{r.codAmount}</td>
                                 <td className="px-2 py-1 text-right text-red-600">-₹{r.feeAmount}</td>
                                 <td className="px-2 py-1 text-right font-bold">₹{r.netAmount}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  <div className="bg-gray-50 p-2 rounded text-xs text-gray-500 flex items-start">
                     <Info className="h-3 w-3 mr-1 mt-0.5" />
                     Fees include Freight, COD Charges, and RTO deductions based on active Client Rate Card.
                  </div>

                  <div className="flex gap-2 pt-2">
                     <Button variant="secondary" onClick={() => setIsPreviewing(false)}>Back</Button>
                     <Button onClick={handleCreateBatch} disabled={previewRows.length === 0}>Confirm & Generate</Button>
                  </div>
               </div>
            )}
         </div>
      </Modal>

      {/* ACTION MODAL */}
      <Modal isOpen={showAction} onClose={() => setShowAction(false)} title={`Manage Batch ${selectedBatch?.batchCode}`}>
         <div className="space-y-4">
            <div className="bg-gray-100 p-3 rounded text-sm">
               <p>Status: <strong>{selectedBatch?.status}</strong></p>
               <p>Net Amount: <strong>₹{selectedBatch?.netAmount.toLocaleString()}</strong></p>
            </div>

            {selectedBatch?.status === SettlementState.DRAFT && (
               <Button onClick={() => handleBatchAction(SettlementState.SHARED)} className="bg-blue-600">Mark Shared with Client</Button>
            )}

            {selectedBatch?.status === SettlementState.SHARED && (
               <Button onClick={() => handleBatchAction(SettlementState.CONFIRMED)} className="bg-green-600">Confirm (Client Accepted)</Button>
            )}

            {selectedBatch?.status === SettlementState.CONFIRMED && (
               <div className="border-t pt-4">
                  <h4 className="font-bold text-gray-900 mb-2">Final Settlement</h4>
                  <Input label="Bank Reference No" value={actionInputs.ref} onChange={e => setActionInputs({...actionInputs, ref: e.target.value})} placeholder="UTR / Ref" />
                  <Input label="Notes" value={actionInputs.notes} onChange={e => setActionInputs({...actionInputs, notes: e.target.value})} placeholder="Optional" />
                  <Button onClick={() => handleBatchAction(SettlementState.SETTLED)} className="bg-gray-900 mt-2">Mark SETTLED</Button>
               </div>
            )}

            {selectedBatch?.status === SettlementState.SETTLED && (
               <div className="text-center text-green-600 font-bold p-4 border border-green-200 rounded bg-green-50">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                  Settled on {new Date(selectedBatch.settledAt!).toLocaleDateString()}
                  <p className="text-xs text-gray-600 font-mono mt-1">Ref: {selectedBatch.bankReference}</p>
               </div>
            )}
         </div>
      </Modal>
    </Layout>
  );
};
