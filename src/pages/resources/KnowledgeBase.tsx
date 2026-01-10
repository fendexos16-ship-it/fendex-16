
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { knowledgeBaseService } from '../../services/knowledgeBaseService';
import { SOP, Runbook, SOPStatus, IncidentSeverity, UserRole } from '../../types';
import { BookOpen, AlertTriangle, FileText, CheckCircle, Shield, List, Search, Eye } from 'lucide-react';

export const KnowledgeBase: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'SOP' | 'RUNBOOK'>('SOP');
  const [sops, setSops] = useState<SOP[]>([]);
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [acks, setAcks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Viewer State
  const [viewSop, setViewSop] = useState<SOP | null>(null);
  const [viewRunbook, setViewRunbook] = useState<Runbook | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [sData, rData, aData] = await Promise.all([
       knowledgeBaseService.getSOPs(user),
       knowledgeBaseService.getRunbooks(user),
       knowledgeBaseService.getAcknowledgements(user)
    ]);
    setSops(sData);
    setRunbooks(rData);
    setAcks(aData);
    setLoading(false);
  };

  const handleAcknowledge = async (doc: SOP) => {
     if (!confirm("I confirm that I have read and understood this Standard Operating Procedure.")) return;
     try {
        await knowledgeBaseService.acknowledgeDoc(user!, doc.id, doc.version);
        loadData();
        setViewSop(null); // Close modal
     } catch(e:any) { alert(e.message); }
  };

  const getSeverityColor = (s: IncidentSeverity) => {
     switch(s) {
        case IncidentSeverity.P0: return 'bg-red-600 text-white';
        case IncidentSeverity.P1: return 'bg-orange-500 text-white';
        case IncidentSeverity.P2: return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-blue-100 text-blue-800';
     }
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
               <BookOpen className="mr-3 h-8 w-8 text-brand-600" /> Knowledge Base
            </h1>
            <p className="text-sm text-gray-500 mt-1">Operational Standards & Emergency Procedures</p>
         </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
         <nav className="-mb-px flex space-x-8">
            <button onClick={() => setActiveTab('SOP')} className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === 'SOP' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
               <FileText className="h-4 w-4 mr-2" /> Standard Operating Procedures
            </button>
            <button onClick={() => setActiveTab('RUNBOOK')} className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === 'RUNBOOK' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
               <AlertTriangle className="h-4 w-4 mr-2" /> Incident Runbooks
            </button>
         </nav>
      </div>

      {loading ? <div className="p-8 text-center text-gray-500">Loading documents...</div> : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTab === 'SOP' && sops.map(sop => (
               <div key={sop.id} onClick={() => setViewSop(sop)} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:border-brand-300 transition-colors group">
                  <div className="flex justify-between items-start mb-3">
                     <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{sop.code}</span>
                     {acks.includes(sop.id) ? (
                        <CheckCircle className="h-5 w-5 text-green-500" title="Acknowledged" />
                     ) : (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded animate-pulse">READ REQ</span>
                     )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-brand-600">{sop.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4">{sop.content.purpose}</p>
                  <div className="flex justify-between items-center text-xs text-gray-500 border-t pt-3">
                     <span>v{sop.version}</span>
                     <span className="uppercase">{sop.category}</span>
                  </div>
               </div>
            ))}

            {activeTab === 'RUNBOOK' && runbooks.map(rb => (
               <div key={rb.id} onClick={() => setViewRunbook(rb)} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:border-red-300 transition-colors group">
                  <div className="flex justify-between items-start mb-3">
                     <span className={`text-[10px] font-bold px-2 py-1 rounded ${getSeverityColor(rb.severity)}`}>{rb.severity}</span>
                     <Shield className="h-5 w-5 text-gray-400 group-hover:text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-red-700">{rb.title}</h3>
                  <div className="space-y-1 mb-4">
                     {rb.content.immediateActions.slice(0, 2).map((action, i) => (
                        <p key={i} className="text-xs text-gray-600 flex items-center"><List className="h-3 w-3 mr-1" /> {action}</p>
                     ))}
                     {rb.content.immediateActions.length > 2 && <p className="text-xs text-gray-400 italic">+{rb.content.immediateActions.length - 2} more actions</p>}
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 border-t pt-3">
                     <span className="font-mono">{rb.code}</span>
                     <span className="uppercase">{rb.category}</span>
                  </div>
               </div>
            ))}
         </div>
      )}

      {/* SOP VIEWER MODAL */}
      {viewSop && (
         <Modal isOpen={!!viewSop} onClose={() => setViewSop(null)} title={`${viewSop.code}: ${viewSop.title}`}>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
               <div className="bg-blue-50 p-4 rounded text-sm text-blue-900">
                  <h4 className="font-bold mb-1">Purpose</h4>
                  <p>{viewSop.content.purpose}</p>
               </div>
               
               <div>
                  <h4 className="font-bold text-gray-900 border-b pb-2 mb-3">Procedure Steps</h4>
                  <div className="space-y-3">
                     {viewSop.content.steps.map((step) => (
                        <div key={step.order} className="flex gap-3">
                           <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center">{step.order}</span>
                           <p className="text-sm text-gray-800">{step.action}</p>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-3 rounded border border-green-100">
                     <h5 className="text-xs font-bold text-green-800 uppercase mb-2">DO's</h5>
                     <ul className="list-disc ml-4 text-xs text-green-900 space-y-1">
                        {viewSop.content.dos.map((d, i) => <li key={i}>{d}</li>)}
                     </ul>
                  </div>
                  <div className="bg-red-50 p-3 rounded border border-red-100">
                     <h5 className="text-xs font-bold text-red-800 uppercase mb-2">DON'Ts</h5>
                     <ul className="list-disc ml-4 text-xs text-red-900 space-y-1">
                        {viewSop.content.donts.map((d, i) => <li key={i}>{d}</li>)}
                     </ul>
                  </div>
               </div>

               {!acks.includes(viewSop.id) && (
                  <div className="pt-4 border-t">
                     <Button onClick={() => handleAcknowledge(viewSop)} className="w-full">
                        <CheckCircle className="h-4 w-4 mr-2" /> Acknowledge & Mark Read
                     </Button>
                  </div>
               )}
            </div>
         </Modal>
      )}

      {/* RUNBOOK VIEWER MODAL */}
      {viewRunbook && (
         <Modal isOpen={!!viewRunbook} onClose={() => setViewRunbook(null)} title={`${viewRunbook.title} (${viewRunbook.severity})`}>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
               <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
                  <h4 className="font-bold text-red-900 mb-2">IMMEDIATE ACTIONS</h4>
                  <ul className="list-disc ml-4 text-sm text-red-800 font-medium space-y-1">
                     {viewRunbook.content.immediateActions.map((act, i) => <li key={i}>{act}</li>)}
                  </ul>
               </div>

               <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase mb-2">Data to Capture</h4>
                  <div className="flex flex-wrap gap-2">
                     {viewRunbook.content.dataToCapture.map((d, i) => (
                        <span key={i} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs border border-gray-300">{d}</span>
                     ))}
                  </div>
               </div>

               <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase mb-2">Communication Template</h4>
                  <div className="bg-gray-50 p-3 rounded border text-sm font-mono text-gray-700 whitespace-pre-wrap select-all">
                     {viewRunbook.content.communicationTemplate}
                  </div>
               </div>

               <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase mb-2">Resolution Path</h4>
                  <ol className="list-decimal ml-4 text-sm text-gray-700 space-y-1">
                     {viewRunbook.content.resolutionSteps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
               </div>
               
               <div className="text-xs text-gray-500 border-t pt-2 mt-2">
                  Closure: {viewRunbook.content.closureCriteria}
               </div>
            </div>
         </Modal>
      )}
    </Layout>
  );
};
