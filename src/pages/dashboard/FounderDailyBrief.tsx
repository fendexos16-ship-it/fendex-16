
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { founderService, DailyMetrics, RedFlag } from '../../services/founderService';
import { UserRole } from '../../types';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Download, 
  Save, 
  Activity, 
  CheckCircle, 
  DollarSign, 
  Clock,
  ChevronRight
} from 'lucide-react';
import { Button } from '../../components/Button';

export const FounderDailyBrief: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentDate] = useState(new Date());
  
  // Data State
  const [yesterdayMetrics, setYesterdayMetrics] = useState<DailyMetrics | null>(null);
  const [mtdMetrics, setMtdMetrics] = useState<DailyMetrics | null>(null);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [leaderboards, setLeaderboards] = useState<any>(null);
  const [dailyNote, setDailyNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  // Guard
  if (user?.role !== UserRole.FOUNDER) return <Layout><div className="p-8 text-red-600">Executive Access Only</div></Layout>;

  useEffect(() => {
     loadData();
  }, []);

  const loadData = async () => {
     setLoading(true);
     
     // 1. Dates
     const today = new Date();
     const yesterday = new Date(today);
     yesterday.setDate(today.getDate() - 1);
     const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

     // 2. Fetch
     const yStr = yesterday.toISOString().split('T')[0];
     const [yData, mtdData, flags, boards, note] = await Promise.all([
        founderService.getSnapshot(user!, { start: yStr, end: yStr }),
        founderService.getSnapshot(user!, { start: startOfMonth.toISOString().split('T')[0], end: today.toISOString().split('T')[0] }),
        founderService.analyzeRisks(user!),
        founderService.getLeaderboards(user!),
        founderService.getNote(today.toISOString().split('T')[0])
     ]);

     setYesterdayMetrics(yData);
     setMtdMetrics(mtdData);
     setRedFlags(flags);
     setLeaderboards(boards);
     setDailyNote(note);

     setLoading(false);
  };

  const handleSaveNote = async () => {
     const dateStr = new Date().toISOString().split('T')[0];
     await founderService.saveNote(dateStr, dailyNote);
     setNoteSaved(true);
     setTimeout(() => setNoteSaved(false), 2000);
  };

  const handleExport = () => {
     alert("PDF/Excel Generation Initiated. (Simulated)");
     // In real app, generate Blob and download
  };

  const MetricRow = ({ label, yVal, mVal, format = 'number', highlight = false }: any) => (
     <div className={`flex justify-between items-center py-3 border-b border-gray-100 ${highlight ? 'bg-blue-50 px-2 rounded font-medium' : ''}`}>
        <span className="text-sm text-gray-600">{label}</span>
        <div className="flex gap-8 text-sm">
           <span className="w-24 text-right font-bold text-gray-900">
              {format === 'currency' ? `₹${yVal.toLocaleString()}` : format === 'percent' ? `${yVal.toFixed(1)}%` : yVal.toLocaleString()}
           </span>
           <span className="w-24 text-right font-bold text-gray-700">
              {format === 'currency' ? `₹${mVal.toLocaleString()}` : format === 'percent' ? `${mVal.toFixed(1)}%` : mVal.toLocaleString()}
           </span>
        </div>
     </div>
  );

  if (loading) return <Layout><div className="p-10 text-center">Generating Executive Brief...</div></Layout>;

  return (
    <Layout>
       <div className="max-w-5xl mx-auto">
          {/* HEADER */}
          <div className="flex justify-between items-start mb-8">
             <div>
                <div className="flex items-center gap-2 mb-1">
                   <Calendar className="h-5 w-5 text-brand-600" />
                   <h1 className="text-2xl font-bold text-gray-900">Founder Daily Ritual</h1>
                </div>
                <p className="text-sm text-gray-500">
                   Executive Snapshot for {currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
             </div>
             <div className="flex gap-2">
                <Button onClick={loadData} variant="secondary" className="h-9 text-xs w-auto">Refresh Live</Button>
                <Button onClick={handleExport} className="h-9 text-xs w-auto"><Download className="h-4 w-4 mr-2" /> Export Brief</Button>
             </div>
          </div>

          {/* RED FLAGS */}
          {redFlags.length > 0 && (
             <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
                <h3 className="font-bold text-red-800 flex items-center mb-3">
                   <AlertTriangle className="h-5 w-5 mr-2" /> Critical Attention Required
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {redFlags.map((flag, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-red-100 flex justify-between items-center">
                         <div>
                            <p className="text-xs font-bold text-red-600 uppercase">{flag.metric}</p>
                            <p className="text-sm font-medium text-gray-800">{flag.message}</p>
                         </div>
                         <span className="text-lg font-bold text-red-700">{flag.value}</span>
                      </div>
                   ))}
                </div>
             </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             
             {/* LEFT: METRICS TABLE */}
             <div className="lg:col-span-2 space-y-6">
                
                {/* OPERATIONS */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                   <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between">
                      <h3 className="font-bold text-gray-800 flex items-center"><Activity className="h-4 w-4 mr-2" /> Operational Pulse</h3>
                      <div className="flex gap-8 text-xs font-bold text-gray-500 uppercase tracking-wider">
                         <span className="w-24 text-right">Yesterday</span>
                         <span className="w-24 text-right">MTD</span>
                      </div>
                   </div>
                   <div className="p-6 pt-2">
                      <MetricRow label="Total Shipments" yVal={yesterdayMetrics?.shipments.total} mVal={mtdMetrics?.shipments.total} highlight />
                      <MetricRow label="Delivered" yVal={yesterdayMetrics?.shipments.delivered} mVal={mtdMetrics?.shipments.delivered} />
                      <MetricRow label="Exceptions (RTO/Undel)" yVal={(yesterdayMetrics?.shipments.rto || 0) + (yesterdayMetrics?.shipments.undelivered || 0)} mVal={(mtdMetrics?.shipments.rto || 0) + (mtdMetrics?.shipments.undelivered || 0)} />
                      <MetricRow label="D0 Compliance" yVal={yesterdayMetrics?.sla.d0Percent} mVal={mtdMetrics?.sla.d0Percent} format="percent" />
                   </div>
                </div>

                {/* FINANCIALS */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                   <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between">
                      <h3 className="font-bold text-gray-800 flex items-center"><DollarSign className="h-4 w-4 mr-2" /> Financial Health</h3>
                      <div className="flex gap-8 text-xs font-bold text-gray-500 uppercase tracking-wider">
                         <span className="w-24 text-right">Activity</span>
                         <span className="w-24 text-right">Current State</span>
                      </div>
                   </div>
                   <div className="p-6 pt-2">
                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                         <span className="text-sm text-gray-600">COD Verified</span>
                         <div className="flex gap-8 text-sm">
                            <span className="w-24 text-right font-bold text-green-600">₹{yesterdayMetrics?.cod.verified.toLocaleString()}</span>
                            <span className="w-24 text-right font-bold text-green-700">₹{mtdMetrics?.cod.verified.toLocaleString()}</span>
                         </div>
                      </div>
                      
                      <div className="flex justify-between items-center py-3 border-b border-gray-100 bg-yellow-50 px-2 rounded">
                         <span className="text-sm font-bold text-yellow-800">COD Pending (Risk)</span>
                         <div className="text-sm font-bold text-yellow-700">
                            Global: ₹{mtdMetrics?.cod.pending.toLocaleString()}
                         </div>
                      </div>

                      <div className="flex justify-between items-center py-3 border-b border-gray-100">
                         <span className="text-sm text-gray-600">Payouts Pending</span>
                         <div className="text-sm font-bold text-gray-700">
                            Rider: ₹{mtdMetrics?.payouts.riderPending.toLocaleString()} | LMDC: ₹{mtdMetrics?.payouts.lmdcPending.toLocaleString()}
                         </div>
                      </div>

                      <div className="flex justify-between items-center py-3">
                         <span className="text-sm text-gray-600">Invoiced Value</span>
                         <div className="flex gap-8 text-sm">
                            <span className="w-24 text-right font-bold text-gray-900">₹{yesterdayMetrics?.finance.receivablesOutstanding.toLocaleString()}</span>
                            <span className="w-24 text-right font-bold text-gray-900">₹{mtdMetrics?.finance.receivablesOutstanding.toLocaleString()}</span>
                         </div>
                      </div>
                   </div>
                </div>

             </div>

             {/* RIGHT: LEADERBOARDS & NOTES */}
             <div className="space-y-6">
                
                {/* ACTION NOTES */}
                <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 shadow-sm">
                   <h3 className="font-bold text-yellow-900 mb-2 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2" /> Founder's Log
                   </h3>
                   <textarea 
                      className="w-full h-32 p-3 text-sm bg-white border border-yellow-300 rounded focus:ring-yellow-500 focus:border-yellow-500"
                      placeholder="Record strategic observations or follow-ups here..."
                      value={dailyNote}
                      onChange={e => setDailyNote(e.target.value)}
                   />
                   <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-yellow-700 italic">{noteSaved ? 'Saved.' : 'Auto-saves locally.'}</span>
                      <Button onClick={handleSaveNote} className="w-auto h-8 text-xs bg-yellow-600 hover:bg-yellow-700 border-none"><Save className="h-3 w-3 mr-1" /> Save</Button>
                   </div>
                </div>

                {/* TOP PERFORMERS */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                   <h3 className="font-bold text-gray-900 mb-4 flex items-center"><TrendingUp className="h-4 w-4 mr-2 text-green-600"/> Top LMDCs (SLA)</h3>
                   <div className="space-y-2">
                      {leaderboards?.topLmdc.map((l: any, i: number) => (
                         <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600">{i+1}. {l.name}</span>
                            <span className="font-bold text-green-700">{l.score.toFixed(0)}%</span>
                         </div>
                      ))}
                   </div>
                </div>

                {/* BOTTOM PERFORMERS */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                   <h3 className="font-bold text-gray-900 mb-4 flex items-center"><TrendingDown className="h-4 w-4 mr-2 text-red-600"/> Needs Attention</h3>
                   <div className="space-y-2">
                      {leaderboards?.bottomLmdc.map((l: any, i: number) => (
                         <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600">{i+1}. {l.name}</span>
                            <span className="font-bold text-red-600">{l.score.toFixed(0)}%</span>
                         </div>
                      ))}
                   </div>
                </div>

                {/* TOP CLIENTS */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                   <h3 className="font-bold text-gray-900 mb-4 flex items-center"><DollarSign className="h-4 w-4 mr-2 text-blue-600"/> Top Clients (Vol)</h3>
                   <div className="space-y-2">
                      {leaderboards?.topClients.map((c: any, i: number) => (
                         <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600 truncate w-32">{i+1}. {c.name}</span>
                            <span className="font-bold text-gray-900">{c.volume}</span>
                         </div>
                      ))}
                   </div>
                </div>

             </div>
          </div>
          
          <div className="mt-8 text-center text-xs text-gray-400">
             Fendex Executive System • Strictly Confidential • Generated {new Date().toLocaleString()}
          </div>
       </div>
    </Layout>
  );
};
