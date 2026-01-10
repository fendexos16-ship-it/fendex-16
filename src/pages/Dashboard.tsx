
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
  PaymentMode
} from '../types';
import { shipmentService } from '../services/shipmentService';
import { payoutService } from '../services/payoutService';
import { codService } from '../services/codService';
import { slaService } from '../services/slaService';
import { masterDataService } from '../services/masterDataService';
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
  Briefcase
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

  // Role Specific Data
  const [lmdcDeposits, setLmdcDeposits] = useState<CodDeposit[]>([]);
  const [riderSlaRecords, setRiderSlaRecords] = useState<SlaRecord[]>([]);
  const [linkedEntityName, setLinkedEntityName] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      
      try {
        const [shpData, batchData, codData, slaData] = await Promise.all([
          shipmentService.getShipments(user),
          (user.role === UserRole.FOUNDER || user.role === UserRole.FINANCE_ADMIN) ? payoutService.getBatches() : Promise.resolve([]),
          (user.role === UserRole.FOUNDER || user.role === UserRole.FINANCE_ADMIN || user.role === UserRole.LMDC_MANAGER) ? codService.getStats() : Promise.resolve({} as any), 
          (user.role === UserRole.FOUNDER) ? slaService.getSlaStats() : Promise.resolve({} as any)
        ]);

        setShipments(shpData);
        setBatches(batchData);
        setCodStats(codData);
        setSlaStats(slaData);

        // Fetch Role Specific Data
        if (user.role === UserRole.LMDC_MANAGER || user.role === UserRole.MMDC_MANAGER) {
             const deposits = await codService.getAllDeposits(user);
             setLmdcDeposits(deposits);
        }
        if (user.role === UserRole.RIDER) {
             const recs = await slaService.getRecords(user);
             setRiderSlaRecords(recs);
        }

        // Entity Name Resolution
        if (user.linkedEntityId) {
           if (user.role === UserRole.MMDC_MANAGER) {
              const mmdcs = await masterDataService.getMMDCs();
              setLinkedEntityName(mmdcs.find(m => m.id === user.linkedEntityId)?.name || 'Unknown MMDC');
           } else if (user.role === UserRole.LMDC_MANAGER) {
              const lmdcs = await masterDataService.getLMDCs();
              setLinkedEntityName(lmdcs.find(l => l.id === user.linkedEntityId)?.name || 'Unknown LMDC');
           }
        }

        // Generate Alerts (Founder Only)
        const newAlerts = [];
        if (user.role === UserRole.FOUNDER || user.role === UserRole.FINANCE_ADMIN) {
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

  const MetricCard = ({ title, value, subtext, icon: Icon, color, link }: any) => (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden group hover:border-brand-300 transition-all">
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
    // Determine next 4 payout dates
    const today = new Date();
    const dates = [];
    let currentMonth = today.getMonth();
    let currentYear = today.getFullYear();

    // Logic for next 2 months of fixed dates
    for(let i=0; i<2; i++) {
       const m = (currentMonth + i) % 12;
       const y = currentYear + Math.floor((currentMonth + i) / 12);
       [14, 21, 28, 4].forEach(d => {
           if (d === 4) {
               // 4th of Next Month
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
    const lockedCycles = batches.filter(b => b.status === PayoutBatchStatus.LOCKED).length;
    const pendingCod = codStats.deposited || 0; 
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysShipments = shipments.filter(s => s.createdAt.startsWith(todayStr)).length;

    return (
      <div className="space-y-8">
         {/* Top Row Stats */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
               title="Total Shipments (Today)" 
               value={todaysShipments} 
               subtext={`${shipments.length} Total Volume`}
               icon={Package} 
               color="text-blue-500"
               link="/shipments"
            />
            <MetricCard 
               title="Pending Payout Cycles" 
               value={lockedCycles} 
               subtext="Waiting for Release Date"
               icon={Clock} 
               color="text-yellow-500"
               link="/finance/payouts"
            />
            <MetricCard 
               title="COD Pending Recon" 
               value={`₹${pendingCod.toLocaleString()}`} 
               subtext={`Shortage: ₹${codStats.shortage || 0}`}
               icon={Banknote} 
               color="text-green-500"
               link="/finance/cod"
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

         {/* Middle Section */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
               <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 h-full">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <ShieldAlert className="h-5 w-5 text-brand-600 mr-2" />
                        Compliance & Audit Alerts
                     </h3>
                     <Link to="/finance/reports" className="text-xs font-bold text-brand-600 hover:underline">View All Logs</Link>
                  </div>
                  {alerts.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <CheckCircle className="h-10 w-10 mb-2 text-green-500" />
                        <p>All Systems Nominal</p>
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
            
            {/* Calendar Widget */}
            <div className="lg:col-span-1">
               <PayoutCalendarWidget />
            </div>
         </div>
      </div>
    );
  };

  const AreaManagerView = () => {
    const inbound = shipments.filter(s => s.status === ShipmentStatus.INBOUND).length;
    const delivered = shipments.filter(s => s.status === ShipmentStatus.DELIVERED).length;
    const exceptions = shipments.filter(s => s.status === ShipmentStatus.UNDELIVERED || s.status === ShipmentStatus.RTO).length;

    return (
       <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <MetricCard 
                title="Regional Inbound" 
                value={inbound} 
                subtext="Pending Assignment"
                icon={Package} 
                color="text-blue-500"
                link="/shipments"
             />
             <MetricCard 
                title="Delivered Total" 
                value={delivered} 
                subtext="Completed Shipments"
                icon={CheckCircle} 
                color="text-green-500"
                link="/shipments"
             />
             <MetricCard 
                title="Regional Exceptions" 
                value={exceptions} 
                subtext="RTO / Undelivered"
                icon={AlertTriangle} 
                color="text-red-500"
                link="/shipments"
             />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                   <MapPin className="h-5 w-5 mr-2 text-brand-600" />
                   Territory Management
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                   Optimize service areas for your LMDCs. Changes require Founder approval.
                </p>
                <Link to="/masters/atlas" className="bg-brand-600 text-white px-4 py-2 rounded text-sm font-bold inline-block hover:bg-brand-700">
                   Open Atlas Map
                </Link>
             </div>
             
             <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                   <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                   MMDC & LMDC Performance
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                   View payout eligibility and operational capacity of your centers.
                </p>
                <div className="flex gap-4">
                   <Link to="/masters/mmdc" className="text-brand-600 font-bold text-sm hover:underline">MMDC Master</Link>
                   <Link to="/masters/lmdc" className="text-brand-600 font-bold text-sm hover:underline">LMDC Master</Link>
                </div>
             </div>
          </div>
       </div>
    );
  };

  const MMDCView = () => {
    // MMDC sees aggregated stats of their LMDCs
    const total = shipments.length;
    const delivered = shipments.filter(s => s.status === ShipmentStatus.DELIVERED).length;
    const rto = shipments.filter(s => s.status === ShipmentStatus.RTO).length;
    
    // Calculate pending deposits from child LMDCs
    const pendingDeposits = lmdcDeposits.filter(d => d.status === 'PENDING').length;

    return (
       <div className="space-y-6">
          <div className="mb-2">
             <h2 className="text-xl font-bold text-gray-800">{linkedEntityName}</h2>
             <p className="text-sm text-gray-500">Mid-Mile Control Center</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <MetricCard 
                title="Total Managed" 
                value={total} 
                icon={Package} 
                color="text-blue-500"
                link="/shipments"
             />
             <MetricCard 
                title="Delivered (Network)" 
                value={delivered} 
                icon={CheckCircle} 
                color="text-green-500"
                link="/shipments"
             />
             <MetricCard 
                title="Network RTO" 
                value={rto} 
                icon={AlertTriangle} 
                color="text-red-500"
                link="/shipments"
             />
             <MetricCard 
                title="Pending LMDC Deposits" 
                value={pendingDeposits} 
                subtext="Child Station Deposits"
                icon={Banknote} 
                color="text-orange-500"
                link="/finance/cod"
             />
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
             <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                <Warehouse className="h-5 w-5 mr-2 text-brand-600" />
                Network Health
             </h3>
             <p className="text-sm text-gray-500">
                You are overseeing the flow for {linkedEntityName}. Ensure all child LMDCs are depositing cash daily.
             </p>
          </div>
       </div>
    );
  };

  const LMDCView = () => {
    const received = shipments.length;
    
    // Calculate COD on Hand (Collected but not yet Deposited state tracked in dashboard approximation)
    const codOnHand = shipments
        .filter(s => s.paymentMode === PaymentMode.COD && s.status === ShipmentStatus.DELIVERED)
        .reduce((sum, s) => sum + (s.codAmount || 0), 0);

    // Calculate Deposited Today
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
             <MetricCard 
                title="Shipments Received" 
                value={received} 
                icon={Package} 
                color="text-blue-500"
                link="/shipments"
             />
             <MetricCard 
                title="COD Cash-in-Hand" 
                value={`₹${codOnHand.toLocaleString()}`} 
                subtext="Pending Deposit"
                icon={Banknote} 
                color="text-orange-500"
                link="/finance/cod"
             />
             <MetricCard 
                title="Deposited Today" 
                value={`₹${depositedToday.toLocaleString()}`} 
                subtext={todayStr}
                icon={TrendingUp} 
                color="text-green-500"
                link="/finance/cod"
             />
          </div>
          
          <div className="bg-brand-600 rounded-lg p-6 text-white shadow-md flex justify-between items-center">
             <div>
                <h3 className="text-lg font-bold">Quick Action: Deposit Cash</h3>
                <p className="text-sm opacity-90 mt-1">Submit collected cash references to HQ for reconciliation.</p>
             </div>
             <Link to="/finance/cod" className="bg-white text-brand-700 px-6 py-3 rounded font-bold text-sm hover:bg-gray-100">
                Start Deposit
             </Link>
          </div>
       </div>
    );
  };

  const RiderView = () => {
     // Rider sees their own stats
     const todayStr = new Date().toISOString().split('T')[0];
     const deliveriesToday = shipments.filter(s => s.status === ShipmentStatus.DELIVERED && s.updatedAt.startsWith(todayStr)).length;
     const codCollectedToday = shipments
        .filter(s => s.status === ShipmentStatus.DELIVERED && s.updatedAt.startsWith(todayStr) && s.paymentMode === PaymentMode.COD)
        .reduce((sum, s) => sum + (s.codAmount || 0), 0);

     // Calculate Real SLA Score
     const totalSla = riderSlaRecords.length;
     const metSla = riderSlaRecords.filter(r => r.slaState === SlaState.SLA_MET).length;
     const score = totalSla > 0 ? Math.round((metSla / totalSla) * 100) : 100;

     return (
        <div className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard 
                 title="Deliveries Today" 
                 value={deliveriesToday} 
                 icon={Truck} 
                 color="text-blue-500"
                 link="/shipments"
              />
              <MetricCard 
                 title="COD Collected Today" 
                 value={`₹${codCollectedToday.toLocaleString()}`} 
                 icon={Banknote} 
                 color="text-green-500"
              />
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                 <h3 className="text-xs font-bold text-gray-500 uppercase">My SLA Score</h3>
                 <div className="mt-4 flex items-end">
                    <span className={`text-4xl font-bold ${score >= 90 ? 'text-green-600' : score >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>{score}%</span>
                    <span className="text-sm text-gray-500 font-bold mb-1 ml-2">Lifetime</span>
                 </div>
                 <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                    <div className={`h-2 rounded-full ${score >= 90 ? 'bg-green-500' : score >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${score}%` }}></div>
                 </div>
              </div>
           </div>

           <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center">
                 <Package className="h-5 w-5 text-blue-600 mr-3" />
                 <div>
                    <h4 className="font-bold text-blue-900">Active Deliveries</h4>
                    <p className="text-xs text-blue-700">You have {shipments.filter(s => s.status === ShipmentStatus.ASSIGNED).length} shipments assigned.</p>
                 </div>
              </div>
              <Link to="/shipments" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold">
                 View List
              </Link>
           </div>
        </div>
     );
  };

  const ClientView = () => {
     const total = shipments.length;
     const delivered = shipments.filter(s => s.status === ShipmentStatus.DELIVERED).length;
     const inTransit = shipments.filter(s => s.status === ShipmentStatus.INBOUND || s.status === ShipmentStatus.ASSIGNED).length;
     const exceptions = shipments.filter(s => s.status === ShipmentStatus.UNDELIVERED || s.status === ShipmentStatus.RTO).length;

     // Calculate Pending COD Remittance (For Client)
     // Assumption: Client prepaid vs postpaid logic handled in Billing.
     // Here we show total COD delivered.
     const codPending = shipments
        .filter(s => s.paymentMode === PaymentMode.COD && s.status === ShipmentStatus.DELIVERED)
        .reduce((sum, s) => sum + (s.codAmount || 0), 0);

     return (
        <div className="space-y-6">
           <div className="mb-2">
              <h2 className="text-xl font-bold text-gray-800">Welcome, Partner</h2>
              <p className="text-sm text-gray-500">Live Shipment Tracking</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <MetricCard 
                 title="Total Shipments" 
                 value={total} 
                 icon={Package} 
                 color="text-gray-700"
                 link="/shipments"
              />
              <MetricCard 
                 title="Delivered" 
                 value={delivered} 
                 icon={CheckCircle} 
                 color="text-green-600"
                 link="/shipments"
              />
              <MetricCard 
                 title="Exceptions" 
                 value={exceptions} 
                 subtext="RTO / Undelivered"
                 icon={AlertTriangle} 
                 color="text-red-500"
                 link="/shipments"
              />
              <MetricCard 
                 title="COD Recovered" 
                 value={`₹${codPending.toLocaleString()}`} 
                 subtext="Pending Remittance"
                 icon={Banknote} 
                 color="text-blue-600"
              />
           </div>

           <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                 <h3 className="font-bold text-gray-900 flex items-center">
                    <Briefcase className="h-5 w-5 mr-2 text-brand-600" />
                    Integration Status
                 </h3>
                 <p className="text-sm text-gray-500 mt-1">API Key active. Webhooks enabled.</p>
              </div>
              <div className="text-right">
                 <p className="text-xs text-gray-400">Environment</p>
                 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Activity className="h-3 w-3 mr-1" />
                    Operational
                 </span>
              </div>
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
          {(user.role === UserRole.RIDER) && <RiderView />}
          {(user.role === UserRole.CLIENT_VIEW) && <ClientView />}
        </>
      )}
    </Layout>
  );
};
