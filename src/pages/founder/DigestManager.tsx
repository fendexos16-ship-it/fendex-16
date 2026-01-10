
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { digestService } from '../../services/digestService';
import { DigestConfig, DigestLog, UserRole } from '../../types';
import { 
   Mail, 
   MessageSquare, 
   Slack, 
   Calendar, 
   Clock, 
   Send, 
   Settings, 
   History,
   CheckCircle,
   XCircle
} from 'lucide-react';
import { Input } from '../../components/Input';

export const DigestManager: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<DigestConfig | null>(null);
  const [logs, setLogs] = useState<DigestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Guard
  if (user?.role !== UserRole.FOUNDER) return <Layout><div className="p-8 text-red-600">Restricted</div></Layout>;

  useEffect(() => {
     loadData();
  }, [user]);

  const loadData = async () => {
     setLoading(true);
     const c = await digestService.getConfig(user!);
     const l = await digestService.getLogs(user!);
     setConfig(c);
     setLogs(l);
     setLoading(false);
  };

  const handleSave = async () => {
     if (!config) return;
     try {
        await digestService.updateConfig(user!, config);
        alert("Configuration Saved");
     } catch(e:any) { alert(e.message); }
  };

  const handleTestSend = async (type: 'DAILY' | 'WEEKLY') => {
     if (!confirm(`Send Test ${type} Digest Now?`)) return;
     setSending(true);
     try {
        await digestService.sendDigest(user!, type);
        alert("Digest Sent Successfully");
        loadData();
     } catch(e:any) {
        alert("Failed: " + e.message);
        loadData();
     } finally {
        setSending(false);
     }
  };

  if (loading || !config) return <Layout><div className="p-10 text-center">Loading...</div></Layout>;

  return (
    <Layout>
       <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex justify-between items-center">
             <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                   <Settings className="mr-3 h-8 w-8 text-brand-600" />
                   Automated KPI Digest
                </h1>
                <p className="text-sm text-gray-500 mt-1">Configure automated executive reports via Email/Slack.</p>
             </div>
             <div className="flex gap-2">
                <Button onClick={() => handleTestSend('DAILY')} variant="secondary" className="w-auto h-9 text-xs" isLoading={sending}>
                   <Send className="h-3 w-3 mr-2" /> Test Daily
                </Button>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             
             {/* LEFT: CONFIGURATION */}
             <div className="lg:col-span-2 space-y-6">
                
                {/* 1. CHANNELS */}
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                   <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                      <MessageSquare className="h-5 w-5 mr-2 text-brand-600" /> Delivery Channels
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className={`flex items-center p-3 rounded border ${config.channels.email ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                         <input type="checkbox" checked={config.channels.email} onChange={e => setConfig({...config, channels: {...config.channels, email: e.target.checked}})} className="h-4 w-4 text-brand-600 mr-3" />
                         <div className="flex items-center"><Mail className="h-4 w-4 mr-2 text-gray-600" /> Email</div>
                      </label>
                      <label className={`flex items-center p-3 rounded border ${config.channels.whatsapp ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                         <input type="checkbox" checked={config.channels.whatsapp} onChange={e => setConfig({...config, channels: {...config.channels, whatsapp: e.target.checked}})} className="h-4 w-4 text-brand-600 mr-3" />
                         <div className="flex items-center font-medium text-green-700">WhatsApp</div>
                      </label>
                      <label className={`flex items-center p-3 rounded border ${config.channels.slack ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                         <input type="checkbox" checked={config.channels.slack} onChange={e => setConfig({...config, channels: {...config.channels, slack: e.target.checked}})} className="h-4 w-4 text-brand-600 mr-3" />
                         <div className="flex items-center"><Slack className="h-4 w-4 mr-2 text-purple-600" /> Slack</div>
                      </label>
                   </div>
                </div>

                {/* 2. SCHEDULES */}
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                   <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-brand-600" /> Report Schedule
                   </h3>
                   
                   <div className="space-y-4">
                      {/* Daily */}
                      <div className="flex items-center justify-between p-3 border rounded">
                         <div className="flex items-center">
                            <input type="checkbox" checked={config.daily.enabled} onChange={e => setConfig({...config, daily: {...config.daily, enabled: e.target.checked}})} className="h-4 w-4 mr-3" />
                            <div>
                               <p className="font-bold text-sm">Daily Brief</p>
                               <p className="text-xs text-gray-500">Ops & Cash Snapshot</p>
                            </div>
                         </div>
                         <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-gray-400" />
                            <input type="time" value={config.daily.time} onChange={e => setConfig({...config, daily: {...config.daily, time: e.target.value}})} className="border rounded p-1 text-sm" />
                         </div>
                      </div>

                      {/* Weekly */}
                      <div className="flex items-center justify-between p-3 border rounded">
                         <div className="flex items-center">
                            <input type="checkbox" checked={config.weekly.enabled} onChange={e => setConfig({...config, weekly: {...config.weekly, enabled: e.target.checked}})} className="h-4 w-4 mr-3" />
                            <div>
                               <p className="font-bold text-sm">Weekly Trends</p>
                               <p className="text-xs text-gray-500">WoW Growth & SLA</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                            <select value={config.weekly.day} onChange={e => setConfig({...config, weekly: {...config.weekly, day: e.target.value}})} className="border rounded p-1 text-sm bg-white">
                               {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <input type="time" value={config.weekly.time} onChange={e => setConfig({...config, weekly: {...config.weekly, time: e.target.value}})} className="border rounded p-1 text-sm" />
                         </div>
                      </div>

                      {/* Monthly */}
                      <div className="flex items-center justify-between p-3 border rounded">
                         <div className="flex items-center">
                            <input type="checkbox" checked={config.monthly.enabled} onChange={e => setConfig({...config, monthly: {...config.monthly, enabled: e.target.checked}})} className="h-4 w-4 mr-3" />
                            <div>
                               <p className="font-bold text-sm">Monthly Board Pack</p>
                               <p className="text-xs text-gray-500">P&L Aggregates</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Day</span>
                            <input type="number" min="1" max="28" value={config.monthly.day} onChange={e => setConfig({...config, monthly: {...config.monthly, day: parseInt(e.target.value)}})} className="border rounded p-1 text-sm w-12" />
                            <input type="time" value={config.monthly.time} onChange={e => setConfig({...config, monthly: {...config.monthly, time: e.target.value}})} className="border rounded p-1 text-sm" />
                         </div>
                      </div>
                   </div>

                   <div className="mt-6 pt-4 border-t flex justify-end">
                      <Button onClick={handleSave} className="w-auto">Save Changes</Button>
                   </div>
                </div>
             </div>

             {/* RIGHT: HISTORY LOGS */}
             <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full max-h-[600px]">
                <div className="p-4 border-b bg-gray-50 font-bold text-gray-800 flex items-center">
                   <History className="h-4 w-4 mr-2" /> Sent History
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                   {logs.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-sm">No digests sent yet.</div>
                   ) : (
                      <table className="w-full text-xs text-left">
                         <thead className="bg-white sticky top-0">
                            <tr>
                               <th className="p-2 border-b">Time</th>
                               <th className="p-2 border-b">Type</th>
                               <th className="p-2 border-b">Status</th>
                            </tr>
                         </thead>
                         <tbody>
                            {logs.map(log => (
                               <tr key={log.id} className="border-b hover:bg-gray-50">
                                  <td className="p-2 text-gray-500">
                                     {new Date(log.generatedAt).toLocaleDateString()}<br/>
                                     {new Date(log.generatedAt).toLocaleTimeString()}
                                  </td>
                                  <td className="p-2 font-bold text-gray-700">{log.type}</td>
                                  <td className="p-2">
                                     {log.status === 'SENT' ? (
                                        <span className="text-green-600 flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Sent</span>
                                     ) : (
                                        <span className="text-red-600 flex items-center"><XCircle className="h-3 w-3 mr-1" /> Fail</span>
                                     )}
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   )}
                </div>
             </div>

          </div>
       </div>
    </Layout>
  );
};
