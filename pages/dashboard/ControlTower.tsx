
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { performanceService } from '../../services/performanceService';
import { 
  UserRole, 
  PerformanceMetrics, 
  AlertThreshold 
} from '../../types';
import { 
  BarChart2, 
  Filter, 
  AlertOctagon, 
  Activity, 
  Clock, 
  MapPin, 
  Users, 
  Truck, 
  ChevronRight,
  TrendingUp,
  Download,
  AlertTriangle,
  Settings,
  Warehouse
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';

export const ControlTower: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [drillLevel, setDrillLevel] = useState<'NETWORK' | 'CITY' | 'LMDC'>('NETWORK');
  
  // Data State
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [drillData, setDrillData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  
  // Filters
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedLmdc, setSelectedLmdc] = useState('');

  // Config Modal
  const [showConfig, setShowConfig] = useState(false);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);

  // Permissions
  const isFounder = user?.role === UserRole.FOUNDER;

  // INITIAL LOAD
  useEffect(() => {
    const init = async () => {
       const t = await performanceService.getThresholds();
       setThresholds(t);
       refreshData();
    };
    init();
  }, []);

  // REFRESH ON FILTER CHANGE
  useEffect(() => {
     if (metrics) refreshData();
  }, [dateRange, selectedCity, selectedLmdc]);

  const refreshData = async () => {
    setLoading(true);
    try {
       // 1. Get Top Level Metrics
       const m = await performanceService.getMetrics(user!, { 
          start: dateRange.start, 
          end: dateRange.end,
          city: selectedCity || undefined,
          lmdcId: selectedLmdc || undefined
       });
       setMetrics(m);

       // 2. Check Alerts
       const activeAlerts = performanceService.checkAlerts(m, thresholds);
       setAlerts(activeAlerts);

       // 3. Get Drill Down Data based on Level
       let groupType: 'CITY' | 'LMDC' | 'RIDER' = 'CITY';
       let parentId = undefined;

       if (drillLevel === 'NETWORK') {
          groupType = 'CITY';
       } else if (drillLevel === 'CITY') {
          groupType = 'LMDC';
          parentId = selectedCity;
       } else if (drillLevel === 'LMDC') {
          groupType = 'RIDER';
          parentId = selectedLmdc;
       }

       const groupData = await performanceService.getGroupedView(user!, groupType, {
          start: dateRange.start,
          end: dateRange.end,
          parentId
       });
       setDrillData(groupData);

    } catch(e) { console.error(e); }
    setLoading(false);
  };

  // HANDLERS
  const handleDrillDown = (item: any) => {
     if (item.type === 'CITY') {
        setSelectedCity(item.id);
        setDrillLevel('CITY');
     } else if (item.type === 'LMDC') {
        setSelectedLmdc(item.id);
        setDrillLevel('LMDC');
     }
  };

  const handleResetDrill = () => {
     setSelectedCity('');
     setSelectedLmdc('');
     setDrillLevel('NETWORK');
  };

  const handleSaveConfig = async () => {
     await performanceService.updateThresholds(user!, thresholds);
     setShowConfig(false);
     refreshData();
  };

  // COMPONENTS
  const KpiCard = ({ title, value, subtext, color }: any) => (
     <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <p className="text-xs text-gray-500 font-bold uppercase">{title}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
     </div>
  );

  return (
    <Layout>
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
               <BarChart2 className="mr-3 h-8 w-8 text-brand-600" />
               Performance Control Tower
            </h1>
            <p className="text-sm text-gray-500 mt-1">Real-time SLA Monitoring & Operations Intelligence</p>
         </div>
         <div className="flex gap-2">
            {isFounder && (
               <Button onClick={() => setShowConfig(true)} variant="secondary" className="w-auto">
                  <Settings className="h-4 w-4 mr-2" /> Alerts
               </Button>
            )}
            <div className="bg-gray-100 p-1 rounded flex gap-2 items-center px-3">
               <span className="text-xs font-bold text-gray-500">REFRESHING LIVE</span>
               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            </div>
         </div>
      </div>

      {/* ALERTS BANNER */}
      {alerts.length > 0 && (
         <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 animate-fade-in-down">
            <div className="flex items-center mb-2">
               <AlertOctagon className="h-5 w-5 text-red-600 mr-2" />
               <h3 className="font-bold text-red-800">Operational Alerts Active</h3>
            </div>
            <div className="space-y-1">
               {alerts.map((a, i) => (
                  <p key={i} className="text-sm text-red-700 flex items-center">
                     <ChevronRight className="h-3 w-3 mr-1" /> {a}
                  </p>
               ))}
            </div>
         </div>
      )}

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
         <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date Range</label>
            <div className="flex gap-2">
               <input type="date" className="border rounded p-2 text-sm" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
               <input type="date" className="border rounded p-2 text-sm" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
            </div>
         </div>
         
         {/* Breadcrumbs for Drill Down */}
         <div className="flex-1 flex items-center bg-gray-50 px-4 py-2 rounded border border-gray-200">
            <button onClick={handleResetDrill} className={`text-sm font-bold ${drillLevel === 'NETWORK' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-800'}`}>Network</button>
            {drillLevel !== 'NETWORK' && (
               <>
                  <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                  <span className={`text-sm font-bold ${drillLevel === 'CITY' ? 'text-brand-600' : 'text-gray-500'}`}>{selectedCity}</span>
               </>
            )}
            {drillLevel === 'LMDC' && (
               <>
                  <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                  <span className="text-sm font-bold text-brand-600">Station View</span>
               </>
            )}
         </div>

         <Button onClick={refreshData} className="w-auto h-[40px]">
            <Activity className="h-4 w-4 mr-2" /> Update View
         </Button>
      </div>

      {loading ? (
         <div className="py-20 text-center text-gray-500">Computing Metrics...</div>
      ) : metrics && (
         <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
               <KpiCard title="Total Volume" value={metrics.total} subtext={`${metrics.delivered} Delivered`} color="text-blue-600" />
               <KpiCard title="D0 Performance" value={`${metrics.d0Percent.toFixed(1)}%`} subtext={`Target: >80%`} color={metrics.d0Percent > 80 ? 'text-green-600' : 'text-red-600'} />
               <KpiCard title="RTO Rate" value={`${metrics.rtoPercent.toFixed(1)}%`} subtext={`${metrics.rto} Returned`} color={metrics.rtoPercent > 15 ? 'text-red-600' : 'text-gray-700'} />
               <KpiCard title="Avg Delivery TAT" value={`${metrics.avgDeliveryTatHrs.toFixed(1)}h`} subtext="Order to Door" color="text-purple-600" />
               <KpiCard title="COD Verify TAT" value={`${metrics.avgCodVerifyHrs.toFixed(1)}h`} subtext="Cash to Bank" color="text-orange-600" />
            </div>

            {/* DRILL DOWN TABLE */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
               <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between">
                  <h3 className="font-bold text-gray-800 flex items-center">
                     {drillLevel === 'NETWORK' && <MapPin className="h-4 w-4 mr-2" />}
                     {drillLevel === 'CITY' && <Warehouse className="h-4 w-4 mr-2" />}
                     {drillLevel === 'LMDC' && <Users className="h-4 w-4 mr-2" />}
                     Performance Breakdown by {drillLevel === 'NETWORK' ? 'City' : (drillLevel === 'CITY' ? 'Station (LMDC)' : 'Rider')}
                  </h3>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">{drillData.length} Records</span>
               </div>
               
               <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                     <thead className="bg-gray-100">
                        <tr>
                           <th className="px-6 py-3 text-left font-bold text-gray-600">Name</th>
                           <th className="px-6 py-3 text-right font-bold text-gray-600">Volume</th>
                           <th className="px-6 py-3 text-right font-bold text-gray-600">Delivered</th>
                           <th className="px-6 py-3 text-right font-bold text-gray-600">D0 %</th>
                           <th className="px-6 py-3 text-right font-bold text-gray-600">RTO %</th>
                           <th className="px-6 py-3 text-right font-bold text-gray-600">COD Pending</th>
                           {drillLevel !== 'LMDC' && <th className="px-6 py-3"></th>}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-200">
                        {drillData.map((row) => (
                           <tr key={row.id} className="hover:bg-gray-50 transition-colors group">
                              <td className="px-6 py-4 font-medium text-gray-900">{row.name}</td>
                              <td className="px-6 py-4 text-right">{row.total}</td>
                              <td className="px-6 py-4 text-right text-green-700">{row.delivered}</td>
                              <td className="px-6 py-4 text-right">
                                 <span className={`px-2 py-1 rounded text-xs font-bold ${row.d0Percent >= 80 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {row.d0Percent.toFixed(1)}%
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-right text-red-600">{row.rtoPercent.toFixed(1)}%</td>
                              <td className="px-6 py-4 text-right font-mono">₹{row.codPendingAmount.toLocaleString()}</td>
                              
                              {drillLevel !== 'LMDC' && (
                                 <td className="px-6 py-4 text-right">
                                    <button 
                                       onClick={() => handleDrillDown(row)}
                                       className="text-brand-600 hover:text-brand-800 font-bold text-xs flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                       Drill Down <ChevronRight className="h-3 w-3 ml-1" />
                                    </button>
                                 </td>
                              )}
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </>
      )}

      {/* CONFIG MODAL */}
      <Modal isOpen={showConfig} onClose={() => setShowConfig(false)} title="Configure Alert Thresholds">
         <div className="space-y-4">
            <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
               <AlertTriangle className="h-4 w-4 inline mr-2" />
               Thresholds trigger visual alerts on the dashboard. They do not block operations.
            </div>
            
            {thresholds.map((t, idx) => (
               <div key={t.id} className="flex items-center gap-3 p-3 border rounded">
                  <div className="w-1/3">
                     <p className="font-bold text-sm">{t.metric}</p>
                  </div>
                  <div className="w-1/4">
                     <span className="text-xs bg-gray-100 px-2 py-1 rounded">{t.condition}</span>
                  </div>
                  <div className="flex-1">
                     <input 
                        type="number" 
                        className="w-full border rounded p-1 text-sm text-center"
                        value={t.value}
                        onChange={(e) => {
                           const newT = [...thresholds];
                           newT[idx].value = parseFloat(e.target.value);
                           setThresholds(newT);
                        }}
                     />
                  </div>
                  <input 
                     type="checkbox" 
                     checked={t.isActive} 
                     onChange={(e) => {
                        const newT = [...thresholds];
                        newT[idx].isActive = e.target.checked;
                        setThresholds(newT);
                     }}
                  />
               </div>
            ))}

            <div className="flex justify-end pt-4">
               <Button onClick={handleSaveConfig}>Save Configuration</Button>
            </div>
         </div>
      </Modal>
    </Layout>
  );
};
