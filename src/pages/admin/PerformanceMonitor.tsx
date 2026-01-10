
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { performanceService } from '../../services/performanceService';
import { cacheService } from '../../services/cacheService';
import { queueService } from '../../services/queueService';
import { useAuth } from '../../context/AuthContext';
import { UserRole, OptimizationConfig, QueueJob } from '../../types';
import { Activity, Zap, Database, DollarSign, RefreshCw, Server, AlertTriangle, Layers, Clock } from 'lucide-react';

export const PerformanceMonitor: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<OptimizationConfig>(performanceService.getOptimizationConfig());
  const [cacheStats, setCacheStats] = useState<any>(cacheService.getStats());
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(false);

  // Simulated Metrics
  const [latency, setLatency] = useState({ p50: 120, p95: 380 });
  const [cost, setCost] = useState({ current: 0, projected: 0 });

  if (user?.role !== UserRole.FOUNDER) return <div className="p-8 text-red-600">Restricted Area</div>;

  const refreshStats = () => {
     setCacheStats(cacheService.getStats());
     setQueueJobs(queueService.getAllJobs());
     
     // Simulate Real-time metrics
     const loadFactor = Math.random();
     setLatency({
        p50: Math.floor(100 + loadFactor * 50),
        p95: Math.floor(300 + loadFactor * 150)
     });
     
     // Cost Simulation based on "usage"
     const dailyUsage = 50 + (cacheStats.hitCount * 0.001);
     setCost({
        current: Math.floor(dailyUsage * 20), // Days elapsed sim
        projected: Math.floor(dailyUsage * 30)
     });
  };

  useEffect(() => {
     refreshStats();
     const interval = setInterval(refreshStats, 3000);
     return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = () => {
     performanceService.updateOptimizationConfig(config);
     alert("Optimization Config Updated");
     refreshStats();
  };

  const handleClearCache = () => {
     cacheService.flush();
     refreshStats();
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
               <Activity className="mr-3 h-8 w-8 text-brand-600" />
               Performance & Cost Control
            </h1>
            <p className="text-sm text-gray-500 mt-1">Infrastructure Tuning (Safe Mode)</p>
         </div>
         <Button onClick={refreshStats} variant="secondary" className="w-auto h-9 text-xs">
            <RefreshCw className="h-3 w-3 mr-2" /> Refresh
         </Button>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
         <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase flex items-center"><Zap className="h-3 w-3 mr-1" /> API Latency (p95)</p>
            <p className={`text-2xl font-bold mt-2 ${latency.p95 > 400 ? 'text-red-600' : 'text-green-600'}`}>{latency.p95}ms</p>
            <p className="text-xs text-gray-400 mt-1">Target: &lt; 400ms</p>
         </div>
         <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase flex items-center"><Database className="h-3 w-3 mr-1" /> Cache Hit Rate</p>
            <p className="text-2xl font-bold mt-2 text-blue-600">{cacheStats.hitRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-400 mt-1">{cacheStats.hitCount} hits / {cacheStats.keys} keys</p>
         </div>
         <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase flex items-center"><Layers className="h-3 w-3 mr-1" /> Queue Depth</p>
            <p className="text-2xl font-bold mt-2 text-purple-600">{queueService.getPendingCount()}</p>
            <p className="text-xs text-gray-400 mt-1">Background Workers Active</p>
         </div>
         <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase flex items-center"><DollarSign className="h-3 w-3 mr-1" /> Est. Cost (Mo)</p>
            <p className={`text-2xl font-bold mt-2 ${cost.projected > config.costBudgetMonthly ? 'text-red-600' : 'text-gray-800'}`}>₹{cost.projected}</p>
            <p className="text-xs text-gray-400 mt-1">Budget: ₹{config.costBudgetMonthly}</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         
         {/* CONFIGURATION PANEL */}
         <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center">
               <Server className="h-5 w-5 mr-2 text-brand-600" /> Infrastructure Tuning
            </h3>
            
            <div className="space-y-4">
               <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                  <div>
                     <span className="font-bold text-sm block">Read Caching</span>
                     <span className="text-xs text-gray-500">Cache expensive aggregations</span>
                  </div>
                  <input type="checkbox" checked={config.enableCache} onChange={e => setConfig({...config, enableCache: e.target.checked})} className="h-5 w-5 text-brand-600" />
               </div>

               <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                  <div>
                     <span className="font-bold text-sm block">Async Reporting</span>
                     <span className="text-xs text-gray-500">Offload PDF/CSV to Queue</span>
                  </div>
                  <input type="checkbox" checked={config.enableAsyncReports} onChange={e => setConfig({...config, enableAsyncReports: e.target.checked})} className="h-5 w-5 text-brand-600" />
               </div>

               <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Cache TTL (Seconds)</label>
                  <input type="number" className="w-full border rounded p-2" value={config.cacheTtlSeconds} onChange={e => setConfig({...config, cacheTtlSeconds: parseInt(e.target.value)})} />
               </div>

               <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Monthly Cost Budget (₹)</label>
                  <input type="number" className="w-full border rounded p-2" value={config.costBudgetMonthly} onChange={e => setConfig({...config, costBudgetMonthly: parseInt(e.target.value)})} />
               </div>

               <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveConfig} className="bg-brand-600 hover:bg-brand-700">Apply Configuration</Button>
                  <Button onClick={handleClearCache} variant="secondary" className="text-red-600 border-red-200 hover:bg-red-50">Flush Cache</Button>
               </div>
            </div>
         </div>

         {/* QUEUE MONITOR */}
         <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col h-[500px]">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center">
               <Clock className="h-5 w-5 mr-2 text-brand-600" /> Job Queue Monitor
            </h3>
            <div className="flex-1 overflow-y-auto">
               <table className="min-w-full text-xs text-left">
                  <thead className="bg-gray-50 sticky top-0">
                     <tr>
                        <th className="p-2">Job ID</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Time</th>
                     </tr>
                  </thead>
                  <tbody>
                     {queueJobs.map(job => (
                        <tr key={job.id} className="border-b">
                           <td className="p-2 font-mono text-gray-500">{job.id}</td>
                           <td className="p-2">{job.type}</td>
                           <td className="p-2">
                              <span className={`px-2 py-0.5 rounded font-bold ${
                                 job.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                 job.status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                                 job.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                 'bg-yellow-100 text-yellow-800'
                              }`}>
                                 {job.status}
                              </span>
                           </td>
                           <td className="p-2 text-gray-400">{new Date(job.createdAt).toLocaleTimeString()}</td>
                        </tr>
                     ))}
                     {queueJobs.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">Queue is idle.</td></tr>}
                  </tbody>
               </table>
            </div>
         </div>

      </div>
    </Layout>
  );
};
