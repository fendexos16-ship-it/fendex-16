
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { salesPlaybookService } from '../../services/salesPlaybookService';
import { UserRole } from '../../types';
import { 
  BookOpen, 
  Target, 
  TrendingUp, 
  MessageSquare, 
  ShieldAlert, 
  Rocket, 
  CheckCircle,
  Zap
} from 'lucide-react';

export const SalesPlaybook: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'SEGMENTS' | 'MOTION' | 'SCRIPTS' | 'OBJECTIONS' | 'PILOT'>('SEGMENTS');
  const [content, setContent] = useState<any>(null);
  const [liveAmmo, setLiveAmmo] = useState<any>(null);
  
  // Guard
  if (user?.role !== UserRole.FOUNDER && user?.role !== UserRole.SALES_AGENT) {
     return <Layout><div className="p-8 text-red-600">Restricted Access</div></Layout>;
  }

  useEffect(() => {
     const load = async () => {
        const data = salesPlaybookService.getPlaybookContent();
        setContent(data);
        
        try {
           const ammo = await salesPlaybookService.getLiveAmmo(user!);
           setLiveAmmo(ammo);
        } catch(e) {
           console.error("Failed to load live metrics", e);
        }

        salesPlaybookService.logAccess(user!);
     };
     load();
  }, [user]);

  if (!content) return <Layout><div className="p-8">Loading Playbook...</div></Layout>;

  return (
    <Layout>
       <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
             <BookOpen className="mr-3 h-8 w-8 text-brand-600" /> Sales Playbook
          </h1>
          <p className="text-sm text-gray-500 mt-1">Standard Operating Procedures for Sales Excellence</p>
       </div>

       <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar Nav */}
          <div className="w-full md:w-64 flex-shrink-0 space-y-1">
             <NavButton active={activeTab === 'SEGMENTS'} onClick={() => setActiveTab('SEGMENTS')} icon={Target} label="Target Segments" />
             <NavButton active={activeTab === 'MOTION'} onClick={() => setActiveTab('MOTION')} icon={TrendingUp} label="Sales Motion" />
             <NavButton active={activeTab === 'SCRIPTS'} onClick={() => setActiveTab('SCRIPTS')} icon={MessageSquare} label="Pitch Scripts" />
             <NavButton active={activeTab === 'OBJECTIONS'} onClick={() => setActiveTab('OBJECTIONS')} icon={ShieldAlert} label="Objection Handling" />
             <NavButton active={activeTab === 'PILOT'} onClick={() => setActiveTab('PILOT')} icon={Rocket} label="Pilot Framework" />
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm p-6 min-h-[500px]">
             
             {activeTab === 'SEGMENTS' && (
                <div className="space-y-6">
                   <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Target Segments & ICP</h2>
                   <div className="grid grid-cols-1 gap-4">
                      {content.segments.map((seg: any, i: number) => (
                         <div key={i} className="bg-gray-50 p-4 rounded border border-gray-200">
                            <h3 className="font-bold text-brand-700">{seg.name}</h3>
                            <p className="text-sm text-gray-700 mt-1"><strong>ICP:</strong> {seg.icp}</p>
                            <p className="text-sm text-gray-600 mt-2 bg-white p-2 rounded border border-gray-100 italic">
                               Value Prop: "{seg.valueProp}"
                            </p>
                         </div>
                      ))}
                   </div>
                </div>
             )}

             {activeTab === 'MOTION' && (
                <div className="space-y-6">
                   <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Sales Process Motion</h2>
                   <div className="space-y-4">
                      {content.motion.map((step: any, i: number) => (
                         <div key={i} className="flex items-start">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm mr-4">
                               {i + 1}
                            </div>
                            <div className="flex-1 pb-4 border-b border-gray-100">
                               <h3 className="font-bold text-gray-800">{step.step}</h3>
                               <p className="text-sm text-gray-600 mt-1">{step.obj}</p>
                               <p className="text-xs text-green-600 font-bold mt-2 flex items-center">
                                  <CheckCircle className="h-3 w-3 mr-1" /> Exit Criteria: {step.exit}
                               </p>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             )}

             {activeTab === 'SCRIPTS' && (
                <div className="space-y-8">
                   <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Pitch Scripts</h2>
                   
                   <div>
                      <h3 className="font-bold text-gray-700 mb-2">First Call (The Hook)</h3>
                      <div className="bg-blue-50 p-4 rounded text-blue-900 text-sm whitespace-pre-wrap font-medium">
                         {content.scripts.firstCall}
                      </div>
                   </div>

                   <div>
                      <h3 className="font-bold text-gray-700 mb-2">Technical Deep Dive</h3>
                      <div className="bg-gray-50 p-4 rounded text-gray-800 text-sm whitespace-pre-wrap">
                         {content.scripts.techDive}
                      </div>
                   </div>

                   <div>
                      <h3 className="font-bold text-gray-700 mb-2">Finance / Procurement</h3>
                      <div className="bg-green-50 p-4 rounded text-green-900 text-sm whitespace-pre-wrap">
                         {content.scripts.finance}
                      </div>
                   </div>
                </div>
             )}

             {activeTab === 'OBJECTIONS' && (
                <div className="space-y-6">
                   <div className="flex justify-between items-center border-b pb-2">
                      <h2 className="text-xl font-bold text-gray-900">Objection Handling</h2>
                      {liveAmmo && (
                         <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-bold flex items-center animate-pulse">
                            <Zap className="h-3 w-3 mr-1" /> LIVE METRICS ACTIVE
                         </span>
                      )}
                   </div>

                   <div className="grid gap-6">
                      {content.objections.map((obj: any, i: number) => {
                         // Inject Live Data
                         let counter = obj.counter;
                         if (liveAmmo) {
                            counter = counter.replace('[LIVE_RTO]', liveAmmo.rto);
                            counter = counter.replace('[LIVE_COD_RECON]', liveAmmo.codReconciled);
                         }
                         
                         return (
                            <div key={i} className="bg-white border border-gray-200 rounded p-4 shadow-sm">
                               <p className="text-red-600 font-bold text-sm mb-2">"{obj.claim}"</p>
                               <p className="text-gray-700 text-sm pl-4 border-l-4 border-green-500">
                                  {counter}
                               </p>
                            </div>
                         );
                      })}
                   </div>
                </div>
             )}

             {activeTab === 'PILOT' && (
                <div className="space-y-6">
                   <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Pilot Framework</h2>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                         <p className="text-xs font-bold text-gray-500 uppercase">Duration</p>
                         <p className="text-xl font-bold text-brand-600">{content.pilot.duration}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
                         <p className="text-xs font-bold text-gray-500 uppercase">Volume Cap</p>
                         <p className="text-xl font-bold text-brand-600">{content.pilot.volumeCap}</p>
                      </div>
                   </div>

                   <div className="bg-green-50 p-4 rounded border border-green-200">
                      <h3 className="font-bold text-green-900 mb-2">Success KPIs</h3>
                      <ul className="list-disc ml-5 text-green-800 text-sm">
                         {content.pilot.successKPIs.map((k: string, i: number) => <li key={i}>{k}</li>)}
                      </ul>
                   </div>

                   <div className="bg-yellow-50 p-4 rounded border border-yellow-200 text-sm text-yellow-900">
                      <strong>Pricing Rule:</strong> {content.pilot.pricing}. No discounts allowed during pilot phase to establish value baseline.
                   </div>
                </div>
             )}

          </div>
       </div>
    </Layout>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
   <button 
      onClick={onClick}
      className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
         active ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
   >
      <Icon className={`h-5 w-5 mr-3 ${active ? 'text-brand-600' : 'text-gray-400'}`} />
      {label}
   </button>
);
