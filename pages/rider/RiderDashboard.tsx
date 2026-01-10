
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { runsheetService } from '../../services/runsheetService';
import { Runsheet, RunsheetStatus, RunsheetType } from '../../types';
import { Truck, Package, RotateCcw, AlertTriangle, ChevronRight } from 'lucide-react';

export const RiderDashboard: React.FC = () => {
  const { user } = useAuth();
  const [runsheets, setRunsheets] = useState<Runsheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      const data = await runsheetService.getRiderRunsheets(user.id);
      setRunsheets(data);
      setLoading(false);
    };
    loadData();
  }, [user]);

  const getRunsheetByType = (type: RunsheetType) => runsheets.find(r => r.type === type);

  const RunsheetCard = ({ type, title, icon: Icon, link, color }: any) => {
     const rs = getRunsheetByType(type);
     
     if (!rs) {
        return (
           <div className={`border-2 border-dashed ${color.border} rounded-xl p-6 flex flex-col items-center justify-center text-center opacity-60`}>
              <Icon className={`h-8 w-8 ${color.text} mb-2`} />
              <p className="font-bold text-gray-500">{title}</p>
              <p className="text-xs text-gray-400 mt-1">No active assignment</p>
           </div>
        );
     }

     const count = type === 'FM' ? (rs.pickupIds?.length || 0) : rs.shipmentIds.length;

     return (
        <Link to={link} className={`bg-white p-6 rounded-xl border ${color.border} shadow-sm active:scale-95 transition-transform relative overflow-hidden group`}>
           <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20`}>
              <Icon className={`h-16 w-16 ${color.text}`} />
           </div>
           <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                 <div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-600`}>{rs.runsheetCode}</span>
                    <h3 className="text-lg font-bold text-gray-900 mt-2">{title}</h3>
                 </div>
                 <div className={`p-2 rounded-full ${color.bg}`}>
                    <Icon className={`h-5 w-5 ${color.text}`} />
                 </div>
              </div>
              
              <div className="flex items-end justify-between">
                 <div>
                    <span className="text-3xl font-extrabold text-gray-900">{count}</span>
                    <span className="text-xs text-gray-500 font-medium ml-1">Tasks</span>
                 </div>
                 <div className={`flex items-center text-xs font-bold ${color.text}`}>
                    Start <ChevronRight className="h-3 w-3 ml-1" />
                 </div>
              </div>
           </div>
        </Link>
     );
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hello, {user?.name.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500">Your Assigned Runsheets</p>
      </div>

      {runsheets.length === 0 && !loading && (
         <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center mb-6">
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-red-900">No Active Runsheets</h3>
            <p className="text-sm text-red-700 mt-1">Please contact your DC Manager to get assigned work.</p>
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <RunsheetCard 
            type="FWD" 
            title="Forward Delivery" 
            icon={Package} 
            link="/rider/deliveries"
            color={{ border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-600' }}
         />
         <RunsheetCard 
            type="FM" 
            title="First Mile Pickup" 
            icon={Truck} 
            link="/rider/pickups"
            color={{ border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-600' }}
         />
         <RunsheetCard 
            type="RVP" 
            title="Reverse Pickup" 
            icon={RotateCcw} 
            link="/rider/rvp"
            color={{ border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-600' }}
         />
      </div>
    </Layout>
  );
};
