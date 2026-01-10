
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { anomalyService } from '../../services/anomalyService';
import { UserRole, Anomaly, AnomalySeverity, Baseline, AnomalyCategory } from '../../types';
import { 
  AlertOctagon, 
  CheckCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Activity, 
  Search, 
  Filter, 
  Eye, 
  ShieldAlert, 
  TrendingUp 
} from 'lucide-react';
import { Modal } from '../../components/Modal';

export const AnomalyDetection: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'BASELINES'>('ALERTS');
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  
  // Feedback Modal
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');

  // Security Check
  if (user?.role !== UserRole.FOUNDER && user?.role !== UserRole.FINANCE_ADMIN) {
     return <Layout><div className="p-8 text-red-600">Restricted Access: AI Watchtower</div></Layout>;
  }

  const loadData = async () => {
     setLoading(true);
     // Trigger detection run
     await anomalyService.runDetection(user!);
     const alerts = await anomalyService.getAnomalies();
     const bases = await anomalyService.getBaselines();
     
     setAnomalies(alerts.sort((a,b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()));
     setBaselines(bases);
     setLoading(false);
  };

  useEffect(() => {
     loadData();
  }, [user]);

  const handleFeedback = async (type: 'TRUE_POSITIVE' | 'FALSE_POSITIVE') => {
     if (!selectedAnomaly) return;
     try {
        await anomalyService.submitFeedback(user!, selectedAnomaly.id, type, feedbackNote);
        setSelectedAnomaly(null);
        setFeedbackNote('');
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const getSeverityBadge = (s: AnomalySeverity) => {
     switch(s) {
        case AnomalySeverity.HIGH: return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-bold">HIGH</span>;
        case AnomalySeverity.MEDIUM: return <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded font-bold">MED</span>;
        case AnomalySeverity.LOW: return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">LOW</span>;
     }
  };

  const getCategoryIcon = (c: AnomalyCategory) => {
     switch(c) {
        case AnomalyCategory.SECURITY: return <ShieldAlert className="h-5 w-5 text-red-600" />;
        case AnomalyCategory.OPS: return <Activity className="h-5 w-5 text-blue-600" />;
        case AnomalyCategory.FINANCE: return <TrendingUp className="h-5 w-5 text-green-600" />;
        default: return <AlertOctagon className="h-5 w-5 text-gray-600" />;
     }
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
               <Eye className="mr-3 h-8 w-8 text-purple-600" /> AI Watchtower
            </h1>
            <p className="text-sm text-gray-500 mt-1">Early Warning System & Anomaly Detection</p>
         </div>
         <Button onClick={loadData} className="w-auto h-9 text-xs">Run Scan</Button>
      </div>

      <div className="border-b border-gray-200 mb-6">
         <nav className="-mb-px flex space-x-8">
            <button onClick={() => setActiveTab('ALERTS')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'ALERTS' ? 'border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Active Alerts</button>
            <button onClick={() => setActiveTab('BASELINES')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'BASELINES' ? 'border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Model Baselines</button>
         </nav>
      </div>

      {loading ? (
         <div className="p-12 text-center text-gray-500 animate-pulse">Running Intelligence Engine...</div>
      ) : activeTab === 'ALERTS' ? (
         <div className="space-y-4">
            {anomalies.filter(a => a.status === 'NEW').length === 0 && (
               <div className="bg-green-50 p-6 rounded-lg text-center border border-green-200">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <h3 className="text-lg font-bold text-green-800">System Healthy</h3>
                  <p className="text-green-700">No active anomalies detected in the last scan.</p>
               </div>
            )}

            {anomalies.map(anomaly => (
               <div key={anomaly.id} className={`bg-white border rounded-lg p-4 shadow-sm flex flex-col md:flex-row gap-4 ${anomaly.status === 'NEW' ? 'border-l-4 border-l-red-500' : 'opacity-75 bg-gray-50'}`}>
                  <div className="flex-shrink-0 pt-1">
                     {getCategoryIcon(anomaly.category)}
                  </div>
                  
                  <div className="flex-1">
                     <div className="flex justify-between items-start">
                        <div>
                           <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                              {anomaly.metric.replace(/_/g, ' ')}
                              {getSeverityBadge(anomaly.severity)}
                           </h4>
                           <p className="text-sm text-gray-500 mt-1">
                              Entity: <span className="font-mono font-bold text-gray-700">{anomaly.entityName || anomaly.entityId}</span> | 
                              Detected: {new Date(anomaly.detectedAt).toLocaleString()}
                           </p>
                        </div>
                        <div className="text-right">
                           <div className="text-xs text-gray-400 uppercase font-bold mb-1">Confidence Score</div>
                           <div className="text-2xl font-black text-gray-800">{anomaly.confidence}%</div>
                        </div>
                     </div>
                     
                     <div className="mt-3 p-3 bg-red-50 rounded border border-red-100 text-sm text-red-900">
                        <strong>Insight:</strong> {anomaly.description}
                     </div>
                     
                     {anomaly.status === 'NEW' && (
                        <div className="mt-4 flex gap-2">
                           <button 
                              onClick={() => setSelectedAnomaly(anomaly)}
                              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-black font-bold flex items-center"
                           >
                              Review & Feedback
                           </button>
                        </div>
                     )}
                     
                     {anomaly.status !== 'NEW' && (
                        <div className="mt-2 text-xs text-gray-400 italic">
                           Resolved as {anomaly.status}
                        </div>
                     )}
                  </div>
               </div>
            ))}
         </div>
      ) : (
         <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full text-sm">
               <thead className="bg-gray-50">
                  <tr>
                     <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase">Entity</th>
                     <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase">Metric</th>
                     <th className="px-6 py-3 text-right font-bold text-gray-500 uppercase">Baseline (Mean)</th>
                     <th className="px-6 py-3 text-right font-bold text-gray-500 uppercase">Std Dev</th>
                     <th className="px-6 py-3 text-right font-bold text-gray-500 uppercase">Last Update</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-200">
                  {baselines.map(b => (
                     <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-mono text-gray-900">{b.entityId}</td>
                        <td className="px-6 py-4">{b.metric}</td>
                        <td className="px-6 py-4 text-right font-bold">{b.mean.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right text-gray-500">±{b.stdDev.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right text-gray-400">{new Date(b.lastUpdated).toLocaleDateString()}</td>
                     </tr>
                  ))}
                  {baselines.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">No baselines learned yet. Run a scan.</td></tr>}
               </tbody>
            </table>
         </div>
      )}

      {/* FEEDBACK MODAL */}
      <Modal isOpen={!!selectedAnomaly} onClose={() => setSelectedAnomaly(null)} title="Feedback Loop">
         <div className="space-y-4">
            <p className="text-sm text-gray-600">
               Help the AI learn. Is this anomaly alert useful and accurate?
            </p>
            <textarea 
               className="w-full border rounded p-2 text-sm h-20"
               placeholder="Optional notes for tuning..."
               value={feedbackNote}
               onChange={e => setFeedbackNote(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
               <button 
                  onClick={() => handleFeedback('TRUE_POSITIVE')}
                  className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex flex-col items-center hover:bg-green-100 transition-colors"
               >
                  <ThumbsUp className="h-6 w-6 mb-2" />
                  <span className="font-bold">Useful / Accurate</span>
                  <span className="text-xs opacity-75">Keep alerting like this</span>
               </button>
               <button 
                  onClick={() => handleFeedback('FALSE_POSITIVE')}
                  className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex flex-col items-center hover:bg-red-100 transition-colors"
               >
                  <ThumbsDown className="h-6 w-6 mb-2" />
                  <span className="font-bold">False Alarm</span>
                  <span className="text-xs opacity-75">Adjust baseline tolerance</span>
               </button>
            </div>
         </div>
      </Modal>

    </Layout>
  );
};
