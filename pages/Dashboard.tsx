
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Layout } from '../components/Layout';
import { Link } from 'react-router-dom';
import { 
  UserRole, 
  Shipment, 
  ShipmentStatus, 
  PayoutBatch, 
  PayoutBatchStatus,
  CodDeposit,
  SlaRecord,
  SlaState,
  PaymentMode,
  LastMileDC,
  RunsheetStatus,
  LedgerStatus,
  CodState
} from '../types';
import { shipmentService } from '../services/shipmentService';
import { payoutService } from '../services/payoutService';
import { codService } from '../services/codService';
import { slaService } from '../services/slaService';
import { masterDataService } from '../services/masterDataService';
import { runsheetService } from '../services/runsheetService';
import { ledgerService } from '../services/ledgerService';
import { 
  AlertTriangle, 
  Clock, 
  Banknote, 
  Package, 
  CheckCircle,
  Truck,
  ShieldAlert,
  Lock,
  ArrowRight,
  Activity,
  TrendingUp,
  MapPin,
  Warehouse,
  Briefcase,
  RotateCcw,
  ClipboardList,
  Filter,
  DollarSign
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // State for metrics
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [codStats, setCodStats] = useState<any>({});
  const [slaStats, setSlaStats] = useState<any>({});
  const [alerts, setAlerts] = useState<string[]>([]);
  
  // New Aggregates for Finance
  const [financeStats, setFinanceStats] = useState({
     totalExpectedCod: 0,
     totalCollectedCod: 0,
     totalVerifiedCod: 0,
     totalPendingCod: 0,
     riderPayoutPending: 0,
     riderPayoutPaid: 0,
     lmdcPayoutPending: 0,
     lmdcPayoutPaid: 0
  });

  // Role Specific Data
  const [lmdcDeposits, setLmdcDeposits] = useState<CodDeposit[]>([]);
  const [riderSlaRecords, setRiderSlaRecords] = useState<SlaRecord[]>([]);
  const [linkedEntityName, setLinkedEntityName] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      
      try {
        const isFinance = user.role === UserRole.FOUNDER || user.role === UserRole.FINANCE_ADMIN;
        const isLMDC = user.role === UserRole.LMDC_MANAGER;
        const isMMDC = user.role === UserRole.MMDC_MANAGER;

        if (user.role === UserRole.AREA_MANAGER) {
           setLoading(false);
           return;
        }

        const [shpData, batchData, codData, slaData] = await Promise.all([
          shipmentService.getShipments(user),
          isFinance ? payoutService.getBatches() : Promise.resolve([]),
          (isFinance || isLMDC) ? codService.getStats() : Promise.resolve({} as any), 
          (user.role === UserRole.FOUNDER) ? slaService.getSlaStats() : Promise.resolve({} as any)
        ]);

        setShipments(shpData);
        setBatches(batchData);
        setCodStats(codData);
        setSlaStats(slaData);

        // --- AGGREGATED FINANCE STATS (FOUNDER VIEW) ---
        if (isFinance) {
           const codRecords = await codService.getAllRecords();
           const lmdcLedgers = await ledgerService.getLmdcLedgers(user);
           const riderLedgers = await ledgerService.getRiderLedgers(user);

           // COD Logic
           const expected = shpData
              .filter(s => s.paymentMode === PaymentMode.COD && s.status === ShipmentStatus.DELIVERED)
              .reduce((sum, s) => sum + s.codAmount, 0);
           
           const collected = Object.values(codRecords)
              .filter(r => r.state >= CodState.COD_COLLECTED)
              .reduce((sum, r) => sum + r.codAmount, 0);

           const verified = Object.values(codRecords)
              .filter(r => r.state >= CodState.COD_VERIFIED)
              .reduce((sum, r) => sum + r.codAmount, 0);

           // Payout Logic
           const riderPending = riderLedgers.filter(l => l.ledgerStatus !== LedgerStatus.PAID && l.ledgerStatus !== LedgerStatus.VOID).reduce((s,l) => s + l.calculatedAmount, 0);
           const riderPaid = riderLedgers.filter(l => l.ledgerStatus === LedgerStatus.PAID).reduce((s,l) => s + l.calculatedAmount, 0);
           const lmdcPending = lmdcLedgers.filter(l => l.ledgerStatus !== LedgerStatus.PAID && l.ledgerStatus !== LedgerStatus.VOID).reduce((s,l) => s + l.calculatedAmount, 0);
           const lmdcPaid = lmdcLedgers.filter(l => l.ledgerStatus === LedgerStatus.PAID).reduce((s,l) => s + l.calculatedAmount, 0);

           setFinanceStats({
              totalExpectedCod: expected,
              totalCollectedCod: collected,
              totalVerifiedCod: verified,
              totalPendingCod: collected - verified,
              riderPayoutPending: riderPending,
              riderPayoutPaid: riderPaid,
              lmdcPayoutPending: lmdcPending,
              lmdcPayoutPaid: lmdcPaid
           });
        }

        // Fetch Role Specific Data
        if (isLMDC || isMMDC) {
             const deposits = await codService.getAllDeposits(user);
             setLmdcDeposits(deposits);
        }
        if (user.role === UserRole.RIDER) {
             const recs = await slaService.getRecords(user);
             setRiderSlaRecords(recs);
        }

        // Entity Name Resolution
        if (user.linkedEntityId) {
           if (isMMDC) {
              const mmdcs = await masterDataService.getMMDCs();
              setLinkedEntityName(mmdcs.find(m => m.id === user.linkedEntityId)?.name || 'Unknown MMDC');
           } else if (isLMDC) {
              const lmdcs = await masterDataService.getLMDCs();
              setLinkedEntityName(lmdcs.find(l => l.id === user.linkedEntityId)?.name || 'Unknown LMDC');
           }
        }

        // Generate Alerts
        const newAlerts = [];
        if (isFinance) {
          if (batchData.some(b => b.status === PayoutBatchStatus.FAILED)) {
            newAlerts.push('CRITICAL: One or more Payout Batches have FAILED.');
          }
          if (codData.shortage && codData.shortage > 0) {
            newAlerts.push(`COD Shortage detected: ₹${codData.shortage}`);
          }
          if (slaData.d2plus && slaData.d2plus > 10) {
            newAlerts.push(`High SLA Breach Rate: ${slaData.d2plus} shipments > D2`);
          }
        }
        setAlerts(newAlerts);

      } catch (err) {
        console.error("Dashboard Load Error", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  if (!user) return null;

  // --- WIDGET HELPERS ---

  const MetricCard = ({ title, value, subtext, icon: Icon, color, link, bg = "bg-white" }: any) => (
    <div className={`${bg} p-6 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden group hover:border-brand-300 transition-all`}>
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
         <Icon className={`h-16 w-16 ${color}`} />
      </div>
      <div className="relative z-10">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        {subtext && <p className={`text-xs mt-1 font-medium ${color}`}>{subtext}</p>}
        {link && (
          <Link to={link} className="mt-4 inline-flex items-center text-xs font-bold text-brand-600 hover:text-brand-800">
            View Details <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        )}
      </div>
    </div>
  );

  const PayoutCalendarWidget = () => {
    const today = new Date();
    const dates = [];
    let currentMonth = today.getMonth();
    let currentYear = today.getFullYear();

    for(let i=0; i<2; i++) {
       const m = (currentMonth + i) % 12;
       const y = currentYear + Math.floor((currentMonth + i) / 12);
       [14, 21, 28, 4].forEach(d => {
           if (d === 4) {
               const nextM = (m + 1) % 12;
               const nextY = y + Math.floor((m + 1) / 12);
               const dateObj = new Date(nextY, nextM, d);
               if (dateObj >= today) dates.push(dateObj);
           } else {
               const dateObj = new Date(y, m, d);
               if (dateObj >= today) dates.push(dateObj);
           }
       });
    }
    
    dates.sort((a,b) => a.getTime() - b.getTime());
    const next4 = dates.slice(0, 4);

    return (
      <div className="bg-gray-900 text-white rounded-lg p-6 shadow-md">
         <h3 className="text-sm font-bold uppercase tracking-wider flex items-center text-gray-400 mb-4">
            <Lock className="h-4 w-4 mr-2" />
            System Locked Payout Calendar
         </h3>
         <div className="grid grid-cols-4 gap-4">
            {next4.map((d, idx) => (
               <div key={idx} className="bg-gray-800 rounded p-3 text-center border border-gray-700">
                  <p className="text-xs text-gray-400">{d.toLocaleString('default', { month: 'short' })}</p>
                  <p className="text-2xl font-bold text-white">{d.getDate()}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{d.toLocaleDateString('en-US', { weekday: 'short' })}</p>
               </div>
            ))}
         </div>
         <p className="text-xs text-gray-500 mt-4 text-center">
            Fixed Policy: Payouts release ONLY on these dates. No exceptions.
         </p>
      </div>
    );
  };

  // --- ROLE VIEWS ---

  const FounderFinanceView = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysShipments = shipments.filter(s => s.createdAt.startsWith(todayStr)).length;

    return (
      <div className="space-y-8">
         {/* FINANCE AGGREGATES */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
               title="COD Verified (Safe)" 
               value={`₹${financeStats.totalVerifiedCod.toLocaleString()}`} 
               subtext={`Pending: ₹${financeStats.totalPendingCod.toLocaleString()}`}
               icon={Banknote} 
               color="text-green-500"
               bg="bg-green-50"
               link="/finance/cod"
            />
            <MetricCard 
               title="Rider Payout (Pending)" 
               value={`₹${financeStats.riderPayoutPending.toLocaleString()}`} 
               subtext={`Paid: ₹${financeStats.riderPayoutPaid.toLocaleString()}`}
               icon={Truck} 
               color="text-blue-500"
               link="/finance/rider"
            />
            <MetricCard 
               title="LMDC Payout (Pending)" 
               value={`₹${financeStats.lmdcPayoutPending.toLocaleString()}`} 
               subtext={`Paid: ₹${financeStats.lmdcPayoutPaid.toLocaleString()}`}
               icon={Warehouse} 
               color="text-purple-500"
               link="/finance/lmdc"
            />
            <MetricCard 
               title="SLA Breach Rate" 
               value={`${slaStats.total > 0 ? ((slaStats.breached / slaStats.total) * 100).toFixed(1) : 0}%`}
               subtext={`${slaStats.breached || 0} Breaches`}
               icon={Activity} 
               color="text-red-500"
               link="/finance/sla"
            />
         </div>

         {/* OPERATIONS SUMMARY */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
               <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center mb-4">
                     <Package className="h-5 w-5 mr-2 text-gray-500" /> Operational Volume
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                     <div className="p-4 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500 uppercase">Today</p>
                        <p className="text-2xl font-bold">{todaysShipments}</p>
                     </div>
                     <div className="p-4 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500 uppercase">Total Delivered</p>
                        <p className="text-2xl font-bold text-green-600">{shipments.filter(s => s.status === 'Delivered').length}</p>
                     </div>
                     <div className="p-4 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500 uppercase">Exceptions (RTO/Undelivered)</p>
                        <p className="text-2xl font-bold text-red-600">{shipments.filter(s => s.status === 'RTO' || s.status === 'Undelivered').length}</p>
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <ShieldAlert className="h-5 w-5 text-brand-600 mr-2" />
                        Compliance Alerts
                     </h3>
                     <Link to="/finance/reports" className="text-xs font-bold text-brand-600 hover:underline">View Audit Logs</Link>
                  </div>
                  {alerts.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-20 text-gray-400">
                        <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
                        <p>No Critical Alerts</p>
                     </div>
                  ) : (
                     <div className="space-y-3">
                        {alerts.map((alert, idx) => (
                           <div key={idx} className="flex items-start p-3 bg-red-50 border border-red-100 rounded text-sm text-red-800">
                              <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                              <span>{alert}</span>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
            
            <div className="lg:col-span-1">
               <PayoutCalendarWidget />
            </div>
         </div>
      </div>
    );
  };

  const AreaManagerView = () => {
    const [lmdcs, setLmdcs] = useState<LastMileDC[]>([]);
    const [selectedLmdcIds, setSelectedLmdcIds] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState({ 
      start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
      end: new Date().toISOString().split('T')[0] 
    });
    
    const [metrics, setMetrics] = useState({
      totalShipments: 0,
      delivered: 0,
      rto: 0,
      undelivered: 0,
      codCollected: 0,
      activeRiders: 0,
      openRunsheets: 0
    });

    useEffect(() => {
      const loadMeta = async () => {
         const allMmdcs = await masterDataService.getMMDCs();
         const myMmdcs = allMmdcs.filter(m => m.linkedDcId === user?.linkedEntityId);
         const mmdcIds = myMmdcs.map(m => m.id);
         const allLmdcs = await masterDataService.getLMDCs();
         const myLmdcs = allLmdcs.filter(l => mmdcIds.includes(l.linkedMmdcId));
         setLmdcs(myLmdcs);
         setSelectedLmdcIds(myLmdcs.map(l => l.id));
      };
      loadMeta();
    }, [user]);

    useEffect(() => {
       const fetchData = async () => {
          if(selectedLmdcIds.length === 0) return;

          const allShipments = await shipmentService.getShipments(user!);
          const start = new Date(dateRange.start).setHours(0,0,0,0);
          const end = new Date(dateRange.end).setHours(23,59,59,999);
          
          const filteredShipments = allShipments.filter(s => {
             const d = new Date(s.createdAt).getTime();
             return d >= start && d <= end && selectedLmdcIds.includes(s.linkedLmdcId);
          });

          const allRiders = await masterDataService.getRiders();
          const activeRiders = allRiders.filter(r => 
             selectedLmdcIds.includes(r.linkedLmdcId) && r.status === 'Active'
          );

          let openRunsheetsCount = 0;
          for (const lmdcId of selectedLmdcIds) {
             const sheets = await runsheetService.getRunsheets(lmdcId);
             openRunsheetsCount += sheets.filter(r => r.status === RunsheetStatus.IN_PROGRESS).length;
          }

          const delivered = filteredShipments.filter(s => s.status === 'Delivered');
          const cod = delivered
             .filter(s => s.paymentMode === 'COD')
             .reduce((sum, s) => sum + s.codAmount, 0);

          setMetrics({
             totalShipments: filteredShipments.length,
             delivered: delivered.length,
             rto: filteredShipments.filter(s => s.status === 'RTO').length,
             undelivered: filteredShipments.filter(s => s.status === 'Undelivered').length,
             codCollected: cod,
             activeRiders: activeRiders.length,
             openRunsheets: openRunsheetsCount
          });
       };
       fetchData();
    }, [selectedLmdcIds, dateRange, user]);

    const toggleLmdc = (id: string) => {
       if (selectedLmdcIds.includes(id)) {
          setSelectedLmdcIds(selectedLmdcIds.filter(i => i !== id));
       } else {
          setSelectedLmdcIds([...selectedLmdcIds, id]);
       }
    };

    return (
       <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-wrap gap-4 items-end">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date Range</label>
                <div className="flex gap-2">
                   <input type="date" className="border rounded p-2 text-sm" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                   <input type="date" className="border rounded p-2 text-sm" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                </div>
             </div>
             
             <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filter Stations (LMDC)</label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto border rounded p-2 bg-gray-50">
                   {lmdcs.map(l => (
                      <button 
                         key={l.id}
                         onClick={() => toggleLmdc(l.id)}
                         className={`text-xs px-2 py-1 rounded border ${selectedLmdcIds.includes(l.id) ? 'bg-brand-100 text-brand-800 border-brand-200' : 'bg-white text-gray-600 border-gray-200'}`}
                      >
                         {l.name}
                      </button>
                   ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{selectedLmdcIds.length} stations selected.</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <MetricCard title="Total Shipments" value={metrics.totalShipments} icon={Package} color="text-blue-600" />
             <MetricCard title="Delivered" value={metrics.delivered} icon={CheckCircle} color="text-green-600" />
             <MetricCard title="COD Collected" value={`₹${metrics.codCollected.toLocaleString()}`} icon={Banknote} color="text-orange-600" />
             <MetricCard title="Active Riders" value={metrics.activeRiders} icon={Truck} color="text-purple-600" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <MetricCard title="RTO" value={metrics.rto} icon={RotateCcw} color="text-red-600" />
             <MetricCard title="Undelivered" value={metrics.undelivered} icon={AlertTriangle} color="text-yellow-600" />
             <MetricCard title="Open Runsheets" value={metrics.openRunsheets} icon={ClipboardList} color="text-teal-600" />
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center text-sm text-gray-500">
             <Filter className="h-4 w-4 inline mr-2" />
             Metrics reflect filtered data range and selected stations only.
          </div>
       </div>
    );
  };

  const MMDCView = () => {
    const total = shipments.length;
    const delivered = shipments.filter(s => s.status === ShipmentStatus.DELIVERED).length;
    const rto = shipments.filter(s => s.status === ShipmentStatus.RTO).length;
    const pendingDeposits = lmdcDeposits.filter(d => d.status === 'PENDING').length;

    return (
       <div className="space-y-6">
          <div className="mb-2">
             <h2 className="text-xl font-bold text-gray-800">{linkedEntityName}</h2>
             <p className="text-sm text-gray-500">Mid-Mile Control Center</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <MetricCard title="Total Managed" value={total} icon={Package} color="text-blue-500" link="/shipments" />
             <MetricCard title="Delivered (Network)" value={delivered} icon={CheckCircle} color="text-green-500" link="/shipments" />
             <MetricCard title="Network RTO" value={rto} icon={AlertTriangle} color="text-red-500" link="/shipments" />
             <MetricCard title="Pending LMDC Deposits" value={pendingDeposits} subtext="Child Station Deposits" icon={Banknote} color="text-orange-500" link="/finance/cod" />
          </div>
       </div>
    );
  };

  const LMDCView = () => {
    const received = shipments.length;
    const codOnHand = shipments
        .filter(s => s.paymentMode === PaymentMode.COD && s.status === ShipmentStatus.DELIVERED)
        .reduce((sum, s) => sum + (s.codAmount || 0), 0);
    const todayStr = new Date().toISOString().split('T')[0];
    const depositedToday = lmdcDeposits
        .filter(d => d.depositDate.startsWith(todayStr))
        .reduce((sum, d) => sum + d.declaredAmount, 0);

    return (
       <div className="space-y-6">
          <div className="mb-2">
             <h2 className="text-xl font-bold text-gray-800">{linkedEntityName}</h2>
             <p className="text-sm text-gray-500">Last-Mile Station Dashboard</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <MetricCard title="Shipments Received" value={received} icon={Package} color="text-blue-500" link="/shipments" />
             <MetricCard title="COD Cash-in-Hand" value={`₹${codOnHand.toLocaleString()}`} subtext="Pending Deposit" icon={Banknote} color="text-orange-500" link="/finance/cod" />
             <MetricCard title="Deposited Today" value={`₹${depositedToday.toLocaleString()}`} subtext={todayStr} icon={TrendingUp} color="text-green-500" link="/finance/cod" />
          </div>
          <div className="bg-brand-600 rounded-lg p-6 text-white shadow-md flex justify-between items-center">
             <div>
                <h3 className="text-lg font-bold">Quick Action: Deposit Cash</h3>
                <p className="text-sm opacity-90 mt-1">Submit collected cash references to HQ for reconciliation.</p>
             </div>
             <Link to="/finance/cod" className="bg-white text-brand-700 px-6 py-3 rounded font-bold text-sm hover:bg-gray-100">Start Deposit</Link>
          </div>
       </div>
    );
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview for {user.name} ({user.role})
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
           <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          {(user.role === UserRole.FOUNDER || user.role === UserRole.FINANCE_ADMIN) && <FounderFinanceView />}
          {(user.role === UserRole.AREA_MANAGER) && <AreaManagerView />}
          {(user.role === UserRole.MMDC_MANAGER) && <MMDCView />}
          {(user.role === UserRole.LMDC_MANAGER) && <LMDCView />}
          {/* Riders have separate dashboard, but fallback just in case */}
        </>
      )}
    </Layout>
  );
};
