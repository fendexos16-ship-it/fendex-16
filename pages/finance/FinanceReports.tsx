
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { reportService } from '../../services/reportService';
import { complianceService } from '../../services/complianceService';
import { payoutService } from '../../services/payoutService';
import { 
  PayoutSummaryStats, 
  ExceptionRecord, 
  ComplianceLog, 
  UserRole, 
  LedgerReportRow,
  ReconciliationRecord,
  PayoutBatch
} from '../../types';
import { 
  FileText, 
  Download, 
  ShieldCheck, 
  AlertTriangle, 
  MessageSquare,
  FileCheck,
  Archive,
  EyeOff,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';

export const FinanceReports: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'LEDGER' | 'RECON' | 'EXCEPTIONS' | 'LOGS'>('SUMMARY');
  const [loading, setLoading] = useState(false);

  // Stats Data
  const [stats, setStats] = useState<PayoutSummaryStats | null>(null);
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'LMDC' | 'RIDER'>('ALL');

  // List Data
  const [ledgerRows, setLedgerRows] = useState<LedgerReportRow[]>([]);
  const [reconRows, setReconRows] = useState<ReconciliationRecord[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
  const [logs, setLogs] = useState<ComplianceLog[]>([]);
  const [summaryBatches, setSummaryBatches] = useState<PayoutBatch[]>([]);

  // Modals
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [selectedExceptionId, setSelectedExceptionId] = useState<string>('');
  const [noteContent, setNoteContent] = useState('');

  // Access Control
  const canAccess = user && (user.role === UserRole.FOUNDER || user.role === UserRole.FINANCE_ADMIN);
  const isFounder = user?.role === UserRole.FOUNDER;

  if (!canAccess) {
    return <div className="p-8 text-red-600 font-bold">⛔ Access Denied: Unauthorized Personnel</div>;
  }

  // DATA LOADERS
  const loadSummary = async () => {
    setLoading(true);
    const [statData, batchData] = await Promise.all([
      reportService.getPayoutSummary(user!, dateRange.start, dateRange.end, roleFilter),
      payoutService.getBatches()
    ]);
    setStats(statData);
    setSummaryBatches(batchData);
    setLoading(false);
  };

  const loadLedgerReport = async () => {
    setLoading(true);
    const data = await reportService.getLedgerReport(user!);
    setLedgerRows(data);
    setLoading(false);
  };

  const loadReconReport = async () => {
    setLoading(true);
    const data = await reportService.getReconciliationReport(user!);
    setReconRows(data);
    setLoading(false);
  };

  const loadExceptions = async () => {
    setLoading(true);
    const data = await reportService.getExceptions(user!);
    setExceptions(data);
    setLoading(false);
  };

  const loadLogs = async () => {
    setLoading(true);
    const data = await complianceService.getLogs(user!.role);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'SUMMARY') loadSummary();
    if (activeTab === 'LEDGER') loadLedgerReport();
    if (activeTab === 'RECON') loadReconReport();
    if (activeTab === 'EXCEPTIONS') loadExceptions();
    if (activeTab === 'LOGS') loadLogs();
  }, [activeTab, dateRange, roleFilter]);

  // UTILITIES
  const mask = (val: string) => {
    if (isFounder) return val;
    if (!val || val.length < 5) return '****';
    return val.substring(0, 4) + '****' + val.substring(val.length - 4);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  // EXPORT HANDLERS (FOUNDER ONLY)
  const handleExportCSV = async (type: 'LEDGER' | 'RECON' | 'GST' | 'RUNSHEET' | 'COD') => {
    if (!isFounder) return alert("Security Alert: Only Founder can export data.");
    
    let content = '';
    let filename = '';

    if (type === 'LEDGER') {
      const data = ledgerRows.map(r => ({
        ...r,
        gatewayRef: r.gatewayRef
      }));
      content = reportService.generateCsv(data, Object.keys(data[0] || {}));
      filename = `FENDEX_LEDGER_REPORT_${new Date().toISOString().split('T')[0]}.csv`;
    } 
    else if (type === 'RECON') {
      const data = reconRows;
      content = reportService.generateCsv(data, Object.keys(data[0] || {}));
      filename = `FENDEX_RECON_REPORT_${new Date().toISOString().split('T')[0]}.csv`;
    }
    else if (type === 'GST') {
      content = reportService.generateCsv(ledgerRows, Object.keys(ledgerRows[0] || {}));
      filename = `FENDEX_GST_READY_${new Date().toISOString().split('T')[0]}.csv`;
    }
    else if (type === 'RUNSHEET') {
       const data = await reportService.getRunsheetReport(user!, dateRange.start, dateRange.end);
       if (data.length === 0) return alert("No data for date range.");
       content = reportService.generateCsv(data, Object.keys(data[0]));
       filename = `FENDEX_RUNSHEET_REPORT_${dateRange.start}_${dateRange.end}.csv`;
    }
    else if (type === 'COD') {
       const data = await reportService.getCodReport(user!, dateRange.start, dateRange.end);
       if (data.length === 0) return alert("No data for date range.");
       content = reportService.generateCsv(data, Object.keys(data[0]));
       filename = `FENDEX_COD_REPORT_${dateRange.start}_${dateRange.end}.csv`;
    }

    downloadFile(content, filename, 'text/csv');

    await complianceService.logEvent(
      'EXPORT',
      user!,
      `Exported ${type} Report`,
      { filename }
    );
  };

  const handleAuditPackage = async () => {
    if (!isFounder) return;
    const manifest = reportService.generateAuditManifest(user!);
    downloadFile(manifest, `FENDEX_AUDIT_MANIFEST_${Date.now()}.json`, 'application/json');
    
    await complianceService.logEvent(
      'EXPORT',
      user!,
      'Generated Auditor Package Manifest',
      { type: 'ZIP_SIMULATION' }
    );
  };

  const handleNoteSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExceptionId || !noteContent) return;
    await complianceService.addExceptionNote(selectedExceptionId, noteContent, { id: user!.id, role: user!.role });
    setNoteModalOpen(false);
    setNoteContent('');
    loadExceptions();
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ShieldCheck className="mr-3 h-8 w-8 text-brand-600" />
            Compliance & Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Read-only financial controls and audit center. 
            {!isFounder && <span className="text-orange-600 font-semibold ml-2 flex items-center inline-flex"><EyeOff className="h-3 w-3 mr-1"/>Data Masked</span>}
          </p>
        </div>
        {isFounder && (
           <div className="flex gap-2">
              <Button onClick={() => handleExportCSV('GST')} variant="secondary" className="w-auto h-9 text-xs">
                 <FileText className="h-3 w-3 mr-2" /> GST Export
              </Button>
              <Button onClick={handleAuditPackage} className="w-auto h-9 text-xs bg-gray-800 hover:bg-gray-900 text-white">
                 <Archive className="h-3 w-3 mr-2" /> Auditor Package
              </Button>
           </div>
        )}
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'SUMMARY', label: 'Payout Summary' },
            { id: 'LEDGER', label: 'Ledger Detail' },
            { id: 'RECON', label: 'Gateway Reconciliation' },
            { id: 'EXCEPTIONS', label: 'Exceptions' },
            { id: 'LOGS', label: 'Audit Logs' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* --- SUMMARY TAB --- */}
      {activeTab === 'SUMMARY' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-end">
             <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="px-3 py-2 border rounded-md text-sm" />
             </div>
             <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="px-3 py-2 border rounded-md text-sm" />
             </div>
             <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Entity Role</label>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} className="px-3 py-2 border rounded-md text-sm w-32">
                   <option value="ALL">All</option>
                   <option value="LMDC">LMDC</option>
                   <option value="RIDER">Rider</option>
                </select>
             </div>
             <div className="flex gap-2">
               <Button onClick={loadSummary} className="w-auto h-[38px] px-4">Apply</Button>
               {isFounder && (
                  <>
                     <Button onClick={() => handleExportCSV('RUNSHEET')} variant="secondary" className="w-auto h-[38px] px-4 text-xs">
                        <FileSpreadsheet className="h-4 w-4 mr-2" /> Runsheet Report
                     </Button>
                     <Button onClick={() => handleExportCSV('COD')} variant="secondary" className="w-auto h-[38px] px-4 text-xs">
                        <FileSpreadsheet className="h-4 w-4 mr-2" /> COD Report
                     </Button>
                  </>
               )}
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                <p className="text-xs font-bold text-blue-800 uppercase">Total Payable</p>
                <p className="text-2xl font-bold text-blue-900 mt-2">₹{stats?.totalPayable.toLocaleString()}</p>
             </div>
             <div className="bg-green-50 p-6 rounded-lg border border-green-100">
                <p className="text-xs font-bold text-green-800 uppercase">Executed (Paid)</p>
                <p className="text-2xl font-bold text-green-900 mt-2">₹{stats?.executedAmount.toLocaleString()}</p>
             </div>
             <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-100">
                <p className="text-xs font-bold text-yellow-800 uppercase">Pending</p>
                <p className="text-2xl font-bold text-yellow-900 mt-2">₹{stats?.pendingAmount.toLocaleString()}</p>
             </div>
             <div className="bg-red-50 p-6 rounded-lg border border-red-100">
                <p className="text-xs font-bold text-red-800 uppercase">Failed / Issues</p>
                <p className="text-2xl font-bold text-red-900 mt-2">₹{stats?.failedAmount.toLocaleString()}</p>
                <p className="text-xs text-red-600 mt-1">{stats?.failedCount} Records</p>
             </div>
          </div>

          <h3 className="text-lg font-bold text-gray-900 mt-8 mb-4">Cycle Summary</h3>
          <Table<PayoutBatch>
             data={summaryBatches}
             isLoading={loading}
             columns={[
               { header: 'Cycle ID', accessor: 'id', className: 'font-mono' },
               { header: 'Role', accessor: 'role' },
               { header: 'Total Amount', accessor: (b) => `₹${b.totalAmount.toLocaleString()}` },
               { header: 'Status', accessor: 'status' },
               { header: 'Payout Date', accessor: 'payoutDate' },
               { header: 'Gateway', accessor: (b) => b.gateway || '-' }
             ]}
          />
        </div>
      )}

      {/* --- LEDGER DETAIL TAB --- */}
      {activeTab === 'LEDGER' && (
         <>
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-gray-900">Immutable Ledger Details</h3>
               {isFounder && (
                  <Button onClick={() => handleExportCSV('LEDGER')} variant="secondary" className="w-auto h-8 text-xs">
                     <Download className="h-3 w-3 mr-2" /> Export CSV
                  </Button>
               )}
            </div>
            <Table<LedgerReportRow>
               data={ledgerRows}
               isLoading={loading}
               columns={[
                  { header: 'Cycle ID', accessor: 'cycleId', className: 'font-mono text-xs' },
                  { header: 'AWB', accessor: 'awb', className: 'font-mono text-xs' },
                  { header: 'Entity ID', accessor: 'entityId' },
                  { header: 'Mode', accessor: 'paymentMode' },
                  { header: 'COD', accessor: (r) => `₹${r.codAmount}` },
                  { header: 'Payout', accessor: (r) => `₹${r.payoutAmount}`, className: 'font-bold' },
                  { header: 'Status', accessor: 'status' },
                  { header: 'Gateway Ref', accessor: (r) => mask(r.gatewayRef), className: 'font-mono text-xs text-gray-500' },
                  { header: 'Executed At', accessor: (r) => r.executedAt ? new Date(r.executedAt).toLocaleString() : '-' }
               ]}
            />
         </>
      )}

      {/* --- RECONCILIATION TAB --- */}
      {activeTab === 'RECON' && (
        <>
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-gray-900">Gateway Reconciliation (Transfer Level)</h3>
               {isFounder && (
                  <Button onClick={() => handleExportCSV('RECON')} variant="secondary" className="w-auto h-8 text-xs">
                     <Download className="h-3 w-3 mr-2" /> Export Recon CSV
                  </Button>
               )}
            </div>
            <Table<ReconciliationRecord>
               data={reconRows}
               isLoading={loading}
               columns={[
                  { header: 'Gateway', accessor: 'gateway' },
                  { header: 'Transfer ID', accessor: (r) => mask(r.transferId), className: 'font-mono text-xs' },
                  { header: 'Bank Ref', accessor: (r) => mask(r.referenceId), className: 'font-mono text-xs' },
                  { header: 'Status', accessor: (r) => <span className={r.status === 'SUCCESS' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{r.status}</span> },
                  { header: 'Amount', accessor: (r) => `₹${r.amount}` },
                  { header: 'Executed', accessor: (r) => new Date(r.executedAt).toLocaleDateString() },
                  { header: 'Verified', accessor: (r) => r.webhookVerified ? <FileCheck className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-orange-500" /> }
               ]}
            />
        </>
      )}

      {/* --- EXCEPTIONS TAB --- */}
      {activeTab === 'EXCEPTIONS' && (
        <>
          <Table<ExceptionRecord>
             data={exceptions}
             isLoading={loading}
             columns={[
               { header: 'Ref ID', accessor: 'referenceId', className: 'font-mono' },
               { header: 'Type', accessor: 'type' },
               { header: 'Date', accessor: (row) => new Date(row.date).toLocaleDateString() },
               { header: 'Amount', accessor: (row) => `₹${row.amount.toLocaleString()}` },
               { header: 'Issue', accessor: 'issue', className: 'text-red-600 font-medium' },
               { header: 'Founder Note', accessor: (row) => row.founderNote || <span className="text-gray-400 italic">None</span> }
             ]}
             actions={isFounder ? (row) => (
                <button onClick={() => { setSelectedExceptionId(row.id); setNoteModalOpen(true); }} className="text-brand-600 hover:text-brand-800 text-xs font-bold flex items-center">
                   <MessageSquare className="h-3 w-3 mr-1" /> Add Note
                </button>
             ) : undefined}
          />
          {exceptions.length === 0 && !loading && (
             <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <p>No exceptions found. Systems nominal.</p>
             </div>
          )}
        </>
      )}

      {/* --- LOGS TAB --- */}
      {activeTab === 'LOGS' && (
         <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50">
                  <tr>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hash</th>
                  </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map(log => (
                     <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-800">{log.eventType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">{log.actorRole} ({log.actorId})</td>
                        <td className="px-6 py-4 text-xs text-gray-800">{log.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-400">{log.integrityHash.substring(0, 8)}...</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      )}

      {/* Note Modal */}
      <Modal isOpen={noteModalOpen} onClose={() => setNoteModalOpen(false)} title="Add Exception Note">
         <form onSubmit={handleNoteSave}>
            <div className="mb-4">
               <label className="block text-sm font-medium text-gray-700 mb-2">Internal Note (Audit Logged)</label>
               <textarea 
                  className="w-full border border-gray-300 rounded-md p-2 h-32 focus:ring-brand-500 focus:border-brand-500"
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder="Enter resolution details or findings..."
                  required
               />
            </div>
            <div className="flex justify-end gap-2">
               <Button type="button" variant="secondary" onClick={() => setNoteModalOpen(false)}>Cancel</Button>
               <Button type="submit">Save Note</Button>
            </div>
         </form>
      </Modal>
    </Layout>
  );
};
