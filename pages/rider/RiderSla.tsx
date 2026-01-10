
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { slaService } from '../../services/slaService';
import { SlaRecord, SlaBucket, SlaState } from '../../types';
import { Gauge, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

export const RiderSla: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<SlaRecord[]>([]);
  
  useEffect(() => {
    const load = async () => {
       if(user) {
          const data = await slaService.getRecords(user);
          setRecords(data);
       }
    }
    load();
  }, [user]);

  const met = records.filter(r => r.slaState === SlaState.SLA_MET).length;
  const total = records.length;
  const score = total > 0 ? Math.round((met/total)*100) : 100;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
           <Gauge className="mr-3 h-8 w-8 text-brand-600" /> My Performance
        </h1>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-center mb-6">
         <div className={`text-5xl font-extrabold mb-2 ${score >= 90 ? 'text-green-600' : score >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
            {score}%
         </div>
         <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">SLA Compliance Rate</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
         <div className="bg-green-50 p-3 rounded-lg text-center border border-green-100">
            <p className="text-xs font-bold text-green-700">D0 (Same Day)</p>
            <p className="text-xl font-bold text-green-900">{records.filter(r => r.slaBucket === SlaBucket.D0).length}</p>
         </div>
         <div className="bg-blue-50 p-3 rounded-lg text-center border border-blue-100">
            <p className="text-xs font-bold text-blue-700">D1 (Next Day)</p>
            <p className="text-xl font-bold text-blue-900">{records.filter(r => r.slaBucket === SlaBucket.D1).length}</p>
         </div>
         <div className="bg-red-50 p-3 rounded-lg text-center border border-red-100">
            <p className="text-xs font-bold text-red-700">Late (D2+)</p>
            <p className="text-xl font-bold text-red-900">{records.filter(r => r.slaBucket === SlaBucket.D2_PLUS).length}</p>
         </div>
      </div>

      <h3 className="font-bold text-gray-900 mb-3">Recent Deliveries</h3>
      <div className="space-y-3">
         {records.slice(0, 10).map((r, i) => (
            <div key={i} className="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center">
               <div>
                  <p className="text-xs font-mono font-bold text-gray-700">{r.shipmentId}</p>
                  <p className="text-[10px] text-gray-400">{new Date(r.actualDeliveryDate).toLocaleDateString()}</p>
               </div>
               <span className={`text-xs font-bold px-2 py-1 rounded flex items-center ${
                  r.slaState === SlaState.SLA_MET ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
               }`}>
                  {r.slaState === SlaState.SLA_MET ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                  {r.slaBucket}
               </span>
            </div>
         ))}
      </div>
    </Layout>
  );
};
