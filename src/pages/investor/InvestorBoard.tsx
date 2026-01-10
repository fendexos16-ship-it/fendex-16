
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { investorService } from '../../services/investorService';
import { clientService } from '../../services/clientService';
import { UserRole, NorthStarMetrics, UnitEconomics, InvestorSnapshot } from '../../types';
import { 
  PieChart, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  AlertTriangle, 
  Download, 
  Calendar,
  Lock,
  Archive,
  BarChart,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../../components/Button';

export const InvestorBoard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'SNAPSHOTS'>('DASHBOARD');
  
  // Data
  const [metrics, setMetrics] = useState<NorthStarMetrics | null>(null);
  const [unitEcon, setUnitEcon] = useState<UnitEconomics[]>([]);
  const [snapshots, setSnapshots] = useState<InvestorSnapshot[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});

  // Filter
  const [range, setRange] = useState({ 
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });

  // Security Guard
  if (user?.role !== UserRole.FOUNDER) {
     return <Layout><div className="p-8 text-red-600">Restricted Access: Board Members Only</div></Layout>;
  }

  useEffect(() => {
    loadData();
  }, [range]); // Reload on date change

  const loadData = async () => {
    setLoading(true);
    
    // Load Client Map
    const clients = await clientService.getClients();
    const cMap: Record<string, string> = {};
    clients.forEach(c => cMap[c.id] = c.name);
    setClientNames(cMap);

    // Compute Metrics
    const data = await investorService.computeMetrics(user!, range);
    setMetrics(data.northStar);
    
    // Map Client Names to Econ Data
    const mappedEcon = data.unitEconomics.map(e => ({
       ...e,
       label: cMap[e.id] || e.id
    }));
    setUnitEcon(mappedEcon);

    // Load History
    const snaps = await investorService.getSnapshots(user!);
    setSnapshots(snaps);

    setLoading(false);
  };

  const handleGenerateSnapshot = async () => {
     if(!confirm("Generate Immutable Snapshot for this period?")) return;
     try {
        await investorService.generateSnapshot(user!, range);
        alert("Snapshot Created & Logged.");
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const MetricBlock = ({ title, value, subtext, color }: any) => (
     <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{title}</p>
        <p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
     </div>
  );

  return (
    <Layout>
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
               <PieChart className="mr-3 h-8 w-8 text-brand-600" />
               Investor Board Pack
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center">
               <ShieldCheck className="h-3 w-3 mr-1 text-green-600" />
               Canonical Data Source. Read-Only View.
            </p>
         </div>
         
         <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setActiveTab('DASHBOARD')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'DASHBOARD' ? 'bg-white shadow text-brand-600' : 'text-gray-500'}`}>Live Metrics</button>
            <button onClick={() => setActiveTab('SNAPSHOTS')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'SNAPSHOTS' ? 'bg-white shadow text-brand-600' : 'text-gray-500'}`}>Snapshots</button>
         </div>
      </div>

      {activeTab === 'DASHBOARD' && (
         <div className="space-y-8 animate-fade-in-up">
            {/* Control Bar */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-wrap gap-4 items-end justify-between">
               <div className="flex gap-4 items-end">
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Period Start</label>
                     <input type="date" className="border rounded p-2 text-sm" value={range.start} onChange={e => setRange({...range, start: e.target.value})} />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Period End</label>
                     <input type="date" className="border rounded p-2 text-sm" value={range.end} onChange={e => setRange({...range, end: e.target.value})} />
                  </div>
                  <Button onClick={loadData} className="w-auto h-[38px] px-4">Refresh View</Button>
               </div>
               <Button onClick={handleGenerateSnapshot} variant="secondary" className="w-auto h-[38px] px-4">
                  <Archive className="h-4 w-4 mr-2" /> Lock Snapshot
               </Button>
            </div>

            {loading ? <div className="text-center p-10">Calculating Financials...</div> : metrics && (
               <>
                  {/* NORTH STAR METRICS */}
                  <div>
                     <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Activity className="h-5 w-5 mr-2 text-brand-600" /> North-Star KPIs
                     </h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        <MetricBlock title="Net Revenue" value={`₹${metrics.netRevenue.toLocaleString()}`} color="text-green-700" subtext={`Gross: ₹${metrics.grossRevenue.toLocaleString()}`} />
                        <MetricBlock title="Avg Shipments/Day" value={metrics.avgDailyShipments} color="text-blue-700" subtext={`Peak: ${metrics.peakDailyShipments}`} />
                        <MetricBlock title="Contribution Margin" value={`${metrics.contributionMarginPercent.toFixed(1)}%`} color={metrics.contributionMarginPercent > 20 ? 'text-green-600' : 'text-yellow-600'} />
                        <MetricBlock title="Cost / Delivery" value={`₹${metrics.costPerDelivery.toFixed(0)}`} color="text-red-600" subtext="Direct Ops Cost" />
                        <MetricBlock title="Cash Cycle (CCC)" value={`${metrics.cashConversionCycleDays.toFixed(0)} Days`} color="text-purple-600" subtext="Target: <30" />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     {/* QUALITY METRICS */}
                     <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Operations Quality</h3>
                        <div className="space-y-4">
                           <div className="flex justify-between items-center border-b pb-2">
                              <span className="text-sm text-gray-600">D0 Delivery %</span>
                              <span className={`font-bold ${metrics.d0Percent > 80 ? 'text-green-600' : 'text-yellow-600'}`}>{metrics.d0Percent.toFixed(1)}%</span>
                           </div>
                           <div className="flex justify-between items-center border-b pb-2">
                              <span className="text-sm text-gray-600">RTO Rate</span>
                              <span className={`font-bold ${metrics.rtoPercent < 15 ? 'text-green-600' : 'text-red-600'}`}>{metrics.rtoPercent.toFixed(1)}%</span>
                           </div>
                           <div className="flex justify-between items-center border-b pb-2">
                              <span className="text-sm text-gray-600">COD TAT (Collection to Verify)</span>
                              <span className="font-bold font-mono">{metrics.avgCodTatDays.toFixed(1)} Days</span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Receivables Outstanding</span>
                              <span className="font-bold text-red-600">₹{metrics.receivablesOutstanding.toLocaleString()}</span>
                           </div>
                        </div>
                     </div>

                     {/* UNIT ECONOMICS TABLE */}
                     <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Unit Economics (Top Clients)</h3>
                        <div className="flex-1 overflow-y-auto max-h-60">
                           <table className="w-full text-xs text-left">
                              <thead className="bg-gray-50 sticky top-0">
                                 <tr>
                                    <th className="p-2">Client</th>
                                    <th className="p-2 text-right">Revenue</th>
                                    <th className="p-2 text-right">Net Contrib.</th>
                                    <th className="p-2 text-right">Margin %</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {unitEcon.map((u, i) => (
                                    <tr key={i} className="border-b">
                                       <td className="p-2 font-medium">{u.label}</td>
                                       <td className="p-2 text-right">₹{u.totalRevenue.toLocaleString()}</td>
                                       <td className="p-2 text-right font-bold">₹{u.netContribution.toFixed(0)}</td>
                                       <td className={`p-2 text-right font-bold ${u.marginPercent >= 20 ? 'text-green-600' : u.marginPercent > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {u.marginPercent.toFixed(1)}%
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>
               </>
            )}
         </div>
      )}

      {activeTab === 'SNAPSHOTS' && (
         <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
               <h3 className="font-bold text-gray-800">Archived Board Reports</h3>
            </div>
            <div className="overflow-x-auto">
               <table className="min-w-full text-sm">
                  <thead className="bg-white">
                     <tr>
                        <th className="px-6 py-3 text-left font-medium text-gray-500">Date Generated</th>
                        <th className="px-6 py-3 text-left font-medium text-gray-500">Period Covered</th>
                        <th className="px-6 py-3 text-left font-medium text-gray-500">Revenue (Net)</th>
                        <th className="px-6 py-3 text-left font-medium text-gray-500">Margin %</th>
                        <th className="px-6 py-3 text-left font-medium text-gray-500">Integrity Hash</th>
                        <th className="px-6 py-3 text-right font-medium text-gray-500">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                     {snapshots.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-gray-500">No snapshots archived.</td></tr>
                     ) : (
                        snapshots.map(s => (
                           <tr key={s.id}>
                              <td className="px-6 py-4">{new Date(s.generatedAt).toLocaleDateString()}</td>
                              <td className="px-6 py-4">{new Date(s.periodStart).toLocaleDateString()} - {new Date(s.periodEnd).toLocaleDateString()}</td>
                              <td className="px-6 py-4 font-bold">₹{s.metrics.netRevenue.toLocaleString()}</td>
                              <td className="px-6 py-4">{s.metrics.contributionMarginPercent.toFixed(1)}%</td>
                              <td className="px-6 py-4 font-mono text-xs text-gray-400">{s.metricsHash}</td>
                              <td className="px-6 py-4 text-right">
                                 <button className="text-blue-600 hover:underline font-bold text-xs flex items-center justify-end">
                                    <Download className="h-3 w-3 mr-1" /> PDF
                                 </button>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      )}
    </Layout>
  );
};
