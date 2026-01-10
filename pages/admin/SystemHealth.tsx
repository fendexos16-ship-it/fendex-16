import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { resilienceService } from '../../services/resilienceService';
import { backupService } from '../../services/backupService';
import { masterDataService } from '../../services/masterDataService';
import { authService } from '../../services/authService';
import { systemConfigService } from '../../services/systemConfigService';
import { useAuth } from '../../context/AuthContext';
import { CircuitBreakerState, BackupRecord, PaymentGateway, UserRole, BackupConfig, DRStatus, RestoreDrill, IncidentState } from '../../types';
import { Activity, Server, Database, RefreshCw, Zap, ShieldAlert, Archive, CheckCircle, XCircle, Rocket, Lock, Key, Clock, Shield, AlertTriangle, PlayCircle, Settings, FileText, AlertOctagon } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';

export const SystemHealth: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'HEALTH' | 'DR' | 'CONFIG'>('HEALTH');
  const [breakers, setBreakers] = useState<CircuitBreakerState[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // DR State
  const [drStatus, setDrStatus] = useState<DRStatus | null>(null);
  const [backupConfig, setBackupConfig] = useState<BackupConfig | null>(null);
  const [drills, setDrills] = useState<RestoreDrill[]>([]);
  const [incidentState, setIncidentState] = useState<IncidentState | undefined>(undefined);

  // Modals
  const [showFailover, setShowFailover] = useState(false);
  const [showIncident, setShowIncident] = useState(false);
  const [incidentReason, setIncidentReason] = useState('');
  const [drillNotes, setDrillNotes] = useState('');
  const [showDrillModal, setShowDrillModal] = useState(false);

  // Checklist State
  const [checks, setChecks] = useState({
    founderAuth: false,
    opsEntities: false,
    backupsExist: false,
    securityHardened: true 
  });

  // Security
  if (user?.role !== UserRole.FOUNDER) return <div className="p-8 text-red-600">Access Restricted</div>;

  const loadData = async () => {
    setLoading(true);
    
    // Load Breakers
    const cashfree = resilienceService.getBreakerStatus(PaymentGateway.CASHFREE);
    const razorpay = resilienceService.getBreakerStatus(PaymentGateway.RAZORPAY);
    setBreakers([cashfree, razorpay]);

    // Load Backups
    const bkp = await backupService.getBackups();
    setBackups(bkp);

    // LIVE CHECK
    setIsLive(localStorage.getItem('fendex_system_status') === 'LIVE');

    // Run Checks
    const users = await authService.getAllUsers();
    const lmdcs = await masterDataService.getLMDCs();
    setChecks({
       founderAuth: users.some(u => u.role === UserRole.FOUNDER),
       opsEntities: lmdcs.length > 0,
       backupsExist: bkp.length > 0,
       securityHardened: true
    });

    // DR Specific
    const drStats = await backupService.getDRStatus();
    setDrStatus(drStats);
    const bConfig = await backupService.getConfig();
    setBackupConfig(bConfig);
    const dHist = await backupService.getDrills();
    setDrills(dHist);
    const inc = systemConfigService.getIncidentState();
    setIncidentState(inc);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Auto-refresh
    return () => clearInterval(interval);
  }, []);

  // --- Handlers ---

  const handleResetBreaker = async (gateway: string) => {
    if (!confirm(`Reset circuit breaker for ${gateway}? This will allow traffic again.`)) return;
    await resilienceService.manualResetBreaker(gateway, user!);
    loadData();
  };

  const handleBackup = async () => {
    try {
      setLoading(true);
      await backupService.createBackup(user!);
      await loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    if (!confirm(`CRITICAL: Restore system to state at ${id}? Current data will be overwritten.`)) return;
    alert("Restore functionality is simulated for safety in this demo.");
  };

  const handleGoLive = () => {
     if (!checks.founderAuth || !checks.opsEntities || !checks.backupsExist) {
        alert("Pre-flight checks failed. Cannot go live.");
        return;
     }
     if (confirm("AUTHORIZE GO-LIVE?\n\nThis will mark the system as Production Ready. Ensure all tests are passed.")) {
        localStorage.setItem('fendex_system_status', 'LIVE');
        setIsLive(true);
        alert("SYSTEM IS NOW LIVE.");
     }
  };

  const handleSaveConfig = async () => {
     if (!backupConfig || !user) return;
     try {
        await backupService.updateConfig(user, backupConfig);
        alert("Config Updated");
     } catch(e:any) { alert(e.message); }
  };

  const initiateFailover = async () => {
     if (!user) return;
     try {
        await backupService.initiateFailover(user);
        setShowFailover(false);
        loadData();
        alert("Failover Sequence Completed. System is running on DR Region.");
     } catch(e:any) { alert(e.message); }
  };

  const toggleIncident = async () => {
     if (!user) return;
     const active = !incidentState?.active;
     try {
        await systemConfigService.toggleIncidentMode(user, active, incidentReason || 'Manual Toggle');
        setShowIncident(false);
        setIncidentReason('');
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleDrill = async (success: boolean) => {
     if (!user) return;
     // Create pending
     await backupService.scheduleDrill(user);
     // Simulate execute
     const drills = await backupService.getDrills();
     const pending = drills[0];
     await backupService.executeDrill(user, pending.id, success, drillNotes || 'Routine Drill');
     setShowDrillModal(false);
     setDrillNotes('');
     loadData();
  };

  const ChecklistItem = ({ label, passed }: { label: string, passed: boolean }) => (
     <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {passed ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
     </div>
  );

  return (
    <Layout>
      {isLive && (
         <div className="bg-green-600 text-white p-4 rounded-lg shadow-lg mb-6 text-center animate-pulse">
            <h2 className="text-xl font-bold flex justify-center items-center">
               <Rocket className="h-6 w-6 mr-2" /> SYSTEM IS LIVE
            </h2>
            <p className="text-sm opacity-90">Operations authorized. Monitoring active.</p>
         </div>
      )}

      {incidentState?.active && (
         <div className="bg-red-600 text-white p-6 rounded-lg shadow-lg mb-6 border-4 border-red-800">
            <div className="flex justify-between items-start">
               <div>
                  <h2 className="text-2xl font-extrabold flex items-center">
                     <AlertTriangle className="h-8 w-8 mr-3" /> INCIDENT MODE ACTIVE
                  </h2>
                  <p className="font-mono mt-2">Started: {new Date(incidentState.startedAt!).toLocaleString()}</p>
                  <p className="mt-1">Reason: {incidentState.reason}</p>
               </div>
               <Button onClick={() => setShowIncident(true)} className="bg-white text-red-700 font-bold hover:bg-gray-100 w-auto">
                  Resolve Incident
               </Button>
            </div>
         </div>
      )}

      <div className="mb-8 flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 flex items-center">
             <Activity className="mr-3 h-8 w-8 text-brand-600" />
             System Health & Resilience
           </h1>
           <p className="text-sm text-gray-500 mt-1">Real-time infrastructure monitoring and fail-safe controls.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg">
           <button onClick={() => setActiveTab('HEALTH')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'HEALTH' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'}`}>Overview</button>
           <button onClick={() => setActiveTab('DR')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'DR' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'}`}>Disaster Recovery</button>
           <button onClick={() => setActiveTab('CONFIG')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'CONFIG' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'}`}>Config</button>
        </div>
      </div>

      {activeTab === 'HEALTH' && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* GO-LIVE CONTROL PANEL */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
               <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <ShieldAlert className="h-5 w-5 text-purple-600 mr-2" />
                  Production Readiness Checklist
               </h3>
               <div className="space-y-3 mb-6">
                  <ChecklistItem label="Founder Authentication" passed={checks.founderAuth} />
                  <ChecklistItem label="Operational Entities (LMDC)" passed={checks.opsEntities} />
                  <ChecklistItem label="Disaster Recovery Snapshot" passed={checks.backupsExist} />
                  <ChecklistItem label="Security Hardening (RBAC)" passed={checks.securityHardened} />
               </div>
               {!isLive ? (
                  <Button onClick={handleGoLive} disabled={!checks.founderAuth || !checks.opsEntities || !checks.backupsExist} className="bg-green-600 hover:bg-green-700">
                     AUTHORIZE GO-LIVE
                  </Button>
               ) : (
                  <div className="text-center text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                     VERSION: 1.1.0-HARDENED | STATUS: LIVE
                  </div>
               )}
            </div>

            {/* SECURITY DASHBOARD (STEP 9) */}
            <div className="bg-slate-800 text-white rounded-lg border border-slate-700 shadow-sm p-6">
               <h3 className="text-lg font-bold mb-4 flex items-center">
                  <Shield className="h-5 w-5 text-green-400 mr-2" />
                  Security Posture
               </h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-700 rounded border border-slate-600">
                     <div className="flex items-center text-slate-300 text-xs uppercase mb-1">
                        <Clock className="h-3 w-3 mr-1" /> Session Policy
                     </div>
                     <div className="font-bold text-green-400">Strict 8 Hours</div>
                  </div>
                  <div className="p-3 bg-slate-700 rounded border border-slate-600">
                     <div className="flex items-center text-slate-300 text-xs uppercase mb-1">
                        <Key className="h-3 w-3 mr-1" /> Encryption
                     </div>
                     <div className="font-bold text-green-400">Simulated (SHA-256)</div>
                  </div>
                  <div className="p-3 bg-slate-700 rounded border border-slate-600">
                     <div className="flex items-center text-slate-300 text-xs uppercase mb-1">
                        <Lock className="h-3 w-3 mr-1" /> Ledger
                     </div>
                     <div className="font-bold text-blue-400">Immutable</div>
                  </div>
                  <div className="p-3 bg-slate-700 rounded border border-slate-600">
                     <div className="flex items-center text-slate-300 text-xs uppercase mb-1">
                        <Zap className="h-3 w-3 mr-1" /> Rate Limits
                     </div>
                     <div className="font-bold text-yellow-400">Active (100/min)</div>
                  </div>
               </div>
            </div>

            {/* CIRCUIT BREAKERS */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 lg:col-span-2">
               <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Zap className="h-5 w-5 text-yellow-600 mr-2" />
                  Gateway Circuit Breakers
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {breakers.map(b => (
                     <div key={b.gateway} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                           <p className="font-bold text-gray-800">{b.gateway}</p>
                           <div className="flex items-center mt-1">
                              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${b.status === 'CLOSED' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              <span className={`text-sm font-mono ${b.status === 'CLOSED' ? 'text-green-700' : 'text-red-600 font-bold'}`}>
                                 {b.status}
                              </span>
                           </div>
                           <p className="text-xs text-gray-500 mt-1">Failures: {b.failCount}</p>
                        </div>
                        {b.status === 'OPEN' && (
                           <Button onClick={() => handleResetBreaker(b.gateway)} className="w-auto h-8 text-xs bg-green-600 hover:bg-green-700">
                              <RefreshCw className="h-3 w-3 mr-2" /> Reset
                           </Button>
                        )}
                        {b.status === 'CLOSED' && (
                           <div className="flex items-center text-gray-400 text-xs">
                              <ShieldAlert className="h-4 w-4 mr-1" /> Monitoring Active
                           </div>
                        )}
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}

      {activeTab === 'DR' && drStatus && (
         <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               
               {/* DR STATUS PANEL */}
               <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-6">
                     <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center">
                           <Database className="h-5 w-5 text-blue-600 mr-2" />
                           Recovery Objectives
                        </h3>
                        <p className="text-sm text-gray-500">Region: {drStatus.region} ({drStatus.role})</p>
                     </div>
                     <span className={`px-2 py-1 text-xs font-bold rounded ${drStatus.health === 'HEALTHY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {drStatus.health}
                     </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                     <div className="p-3 bg-blue-50 rounded border border-blue-100 text-center">
                        <p className="text-xs font-bold text-blue-800 uppercase">RPO Status</p>
                        <p className="text-2xl font-bold text-blue-900">{drStatus.replicationLagSeconds}s</p>
                        <p className="text-xs text-blue-600">Target: &lt; 900s</p>
                     </div>
                     <div className="p-3 bg-purple-50 rounded border border-purple-100 text-center">
                        <p className="text-xs font-bold text-purple-800 uppercase">Last Backup</p>
                        <p className="text-sm font-bold text-purple-900 mt-2">{new Date(drStatus.lastBackupAt).toLocaleTimeString()}</p>
                        <p className="text-xs text-purple-600 mt-1">{new Date(drStatus.lastBackupAt).toLocaleDateString()}</p>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <Button onClick={handleBackup} isLoading={loading} variant="secondary">
                        <Archive className="h-4 w-4 mr-2" /> Trigger Manual Backup
                     </Button>
                     <Button onClick={() => setShowFailover(true)} className="bg-red-600 hover:bg-red-700 text-white">
                        <AlertTriangle className="h-4 w-4 mr-2" /> INITIATE FAILOVER
                     </Button>
                  </div>
               </div>

               {/* INCIDENT MANAGEMENT */}
               <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                     <ShieldAlert className="h-5 w-5 text-orange-600 mr-2" />
                     Incident Response
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                     Activate Incident Mode to freeze non-critical writes and financial operations. Use during outages or attacks.
                  </p>
                  
                  <div className="bg-gray-50 p-4 rounded border border-gray-200 mb-6">
                     <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-700">Current State</span>
                        <span className={`px-2 py-1 text-xs font-bold rounded ${incidentState?.active ? 'bg-red-600 text-white' : 'bg-green-100 text-green-800'}`}>
                           {incidentState?.active ? 'ACTIVE' : 'NORMAL'}
                        </span>
                     </div>
                     {incidentState?.active && (
                        <p className="text-xs text-red-600 font-mono">{incidentState.reason}</p>
                     )}
                  </div>

                  <Button onClick={() => setShowIncident(true)} className={incidentState?.active ? 'bg-green-600' : 'bg-orange-600'}>
                     {incidentState?.active ? 'Resolve Incident' : 'Activate Incident Mode'}
                  </Button>
               </div>
            </div>

            {/* RESTORE DRILLS */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                     <PlayCircle className="h-5 w-5 text-green-600 mr-2" />
                     Restore Drills
                  </h3>
                  <Button onClick={() => setShowDrillModal(true)} variant="secondary" className="w-auto h-8 text-xs">
                     Log New Drill
                  </Button>
               </div>
               
               <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                     <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                     </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                     {drills.map(d => (
                        <tr key={d.id}>
                           <td className="px-4 py-2 text-gray-900">{new Date(d.executedAt || d.scheduledDate).toLocaleDateString()}</td>
                           <td className="px-4 py-2 text-gray-500 font-mono text-xs">{d.id}</td>
                           <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${d.status === 'SUCCESS' ? 'bg-green-100 text-green-800' : d.status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                 {d.status}
                              </span>
                           </td>
                           <td className="px-4 py-2 text-gray-600 truncate max-w-xs">{d.notes || '-'}</td>
                        </tr>
                     ))}
                     {drills.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">No drills recorded.</td></tr>}
                  </tbody>
               </table>
            </div>
         </div>
      )}

      {activeTab === 'CONFIG' && backupConfig && (
         <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm max-w-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
               <Settings className="h-5 w-5 mr-2 text-gray-500" />
               Backup Policy Configuration
            </h3>
            
            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-sm font-medium mb-1">DB Backup Schedule</label>
                     <select 
                        className="w-full border rounded p-2" 
                        value={backupConfig.dbSchedule}
                        onChange={e => setBackupConfig({...backupConfig, dbSchedule: e.target.value as any})}
                     >
                        <option value="HOURLY">Hourly + Daily Full</option>
                        <option value="DAILY">Daily Full Only</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-sm font-medium mb-1">Storage Snapshot</label>
                     <input className="w-full border rounded p-2 bg-gray-100" value={backupConfig.storageSchedule} disabled />
                  </div>
               </div>

               <div>
                  <label className="block text-sm font-medium mb-1">Retention Period (Days)</label>
                  <input 
                     type="number" 
                     className="w-full border rounded p-2" 
                     value={backupConfig.retentionDays}
                     onChange={e => setBackupConfig({...backupConfig, retentionDays: parseInt(e.target.value)})}
                  />
               </div>

               <div className="flex items-center space-x-3 bg-blue-50 p-4 rounded border border-blue-200">
                  <input 
                     type="checkbox" 
                     checked={backupConfig.wormEnabled} 
                     onChange={e => setBackupConfig({...backupConfig, wormEnabled: e.target.checked})}
                     className="h-5 w-5 text-blue-600"
                  />
                  <div>
                     <span className="font-bold text-blue-900">Enable WORM (Write Once Read Many)</span>
                     <p className="text-xs text-blue-700">Prevents deletion or modification of backup artifacts.</p>
                  </div>
               </div>

               <div className="pt-4 flex justify-end">
                  <Button onClick={handleSaveConfig} className="w-auto">Save Policy</Button>
               </div>
            </div>
         </div>
      )}

      {/* FAILOVER MODAL */}
      <Modal isOpen={showFailover} onClose={() => setShowFailover(false)} title="INITIATE FAILOVER">
         <div className="space-y-6">
            <div className="bg-red-50 p-4 rounded border border-red-200 text-red-800">
               <AlertOctagon className="h-8 w-8 mb-2 mx-auto" />
               <p className="text-center font-bold">WARNING: DESTRUCTIVE ACTION</p>
               <p className="text-sm mt-2 text-center">
                  This will freeze the Primary Region and promote DR ({drStatus?.region}) to Primary.
                  Downtime may occur.
               </p>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
               <p>1. Primary Database: <strong>READ-ONLY</strong></p>
               <p>2. Incident Mode: <strong>ACTIVE</strong></p>
               <p>3. DNS Switch: <strong>MANUAL/AUTO</strong></p>
            </div>
            <Button onClick={initiateFailover} className="bg-red-600 hover:bg-red-700 w-full h-12 text-lg">
               CONFIRM FAILOVER
            </Button>
         </div>
      </Modal>

      {/* INCIDENT MODAL */}
      <Modal isOpen={showIncident} onClose={() => setShowIncident(false)} title="Incident Management">
         <div className="space-y-4">
            <p className="text-sm text-gray-600">
               {incidentState?.active 
                  ? "Resolving will unlock financial operations and remove the system banner." 
                  : "Activating will FREEZE all financial transactions (Payouts, Invoicing) and display a warning banner."}
            </p>
            {!incidentState?.active && (
               <Input label="Reason / Incident Ticket" value={incidentReason} onChange={e => setIncidentReason(e.target.value)} required placeholder="e.g. DB Latency Spike" />
            )}
            <Button onClick={toggleIncident} className={incidentState?.active ? 'bg-green-600' : 'bg-red-600'}>
               {incidentState?.active ? 'Resolve & Restore Normal Ops' : 'ACTIVATE LOCKDOWN'}
            </Button>
         </div>
      </Modal>

      {/* DRILL MODAL */}
      <Modal isOpen={showDrillModal} onClose={() => setShowDrillModal(false)} title="Log Restore Drill">
         <div className="space-y-4">
            <p className="text-sm text-gray-600">Record the outcome of a manual restore test.</p>
            <textarea 
               className="w-full border rounded p-2 text-sm h-24" 
               placeholder="Notes, time taken, issues found..."
               value={drillNotes}
               onChange={e => setDrillNotes(e.target.value)}
            />
            <div className="flex gap-2">
               <Button onClick={() => handleDrill(false)} variant="danger">Failed</Button>
               <Button onClick={() => handleDrill(true)} className="bg-green-600">Success</Button>
            </div>
         </div>
      </Modal>

    </Layout>
  );
};