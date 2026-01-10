import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { pickupService } from '../../services/pickupService';
import { bagService } from '../../services/bagService';
import { runsheetService } from '../../services/runsheetService';
import { codService } from '../../services/codService';
import { PickupRequest, Bag, Runsheet, BagStatus, PickupStatus, RunsheetStatus } from '../../types';
import { Link } from 'react-router-dom';
import { 
  Truck, 
  ShoppingBag, 
  ClipboardList, 
  Banknote,
  MapPin,
  Users
} from 'lucide-react';

export const LMDCDashboard: React.FC = () => {
  const { user } = useAuth();
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [fmBags, setFmBags] = useState<Bag[]>([]);
  const [runsheets, setRunsheets] = useState<Runsheet[]>([]);
  const [codStats, setCodStats] = useState({ collected: 0 });

  useEffect(() => {
    const loadData = async () => {
      if (!user?.linkedEntityId) return;
      const lmdcId = user.linkedEntityId;
      
      const [pData, bData, rData, cData] = await Promise.all([
        pickupService.getPickups(lmdcId),
        bagService.getBags(lmdcId),
        runsheetService.getRunsheets(lmdcId),
        codService.getStats()
      ]);

      setPickups(pData.filter(p => p.status !== PickupStatus.CANCELLED));
      setFmBags(bData.filter(b => b.type === 'FIRST_MILE' && b.status !== BagStatus.IN_TRANSIT));
      setRunsheets(rData.filter(r => r.status === RunsheetStatus.IN_PROGRESS));
      setCodStats(cData);
    };
    loadData();
  }, [user]);

  const StatWidget = ({ title, count, icon: Icon, color, link, linkText }: any) => (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
       <div className="flex justify-between items-start mb-4">
          <div>
             <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
             <p className="text-3xl font-bold text-gray-900 mt-2">{count}</p>
          </div>
          <div className={`p-3 rounded-full ${color.bg}`}>
             <Icon className={`h-6 w-6 ${color.text}`} />
          </div>
       </div>
       <Link to={link} className={`text-sm font-medium ${color.text} hover:underline`}>
          {linkText} &rarr;
       </Link>
    </div>
  );

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Station Operations</h1>
        <p className="text-sm text-gray-500 mt-1">
           LMDC: <strong className="text-gray-900">{user?.linkedEntityId}</strong> | Manager: {user?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
         <StatWidget 
            title="Active Pickups" 
            count={pickups.filter(p => p.status === 'SCHEDULED' || p.status === 'ASSIGNED').length} 
            icon={Truck} 
            color={{ bg: 'bg-blue-100', text: 'text-blue-600' }}
            link="/ops/pickups"
            linkText="Manage Pickups"
         />
         <StatWidget 
            title="FM Bags Pending Seal" 
            count={fmBags.filter(b => b.status === BagStatus.CREATED || b.status === BagStatus.OPENED).length} 
            icon={ShoppingBag} 
            color={{ bg: 'bg-indigo-100', text: 'text-indigo-600' }}
            link="/ops/fm-bagging"
            linkText="Bag First Mile"
         />
         <StatWidget 
            title="Active Runsheets" 
            count={runsheets.length} 
            icon={ClipboardList} 
            color={{ bg: 'bg-green-100', text: 'text-green-600' }}
            link="/ops/runsheets"
            linkText="Track Deliveries"
         />
         <StatWidget 
            title="COD Collected (Network)" 
            count={`₹${codStats.collected.toLocaleString()}`} 
            icon={Banknote} 
            color={{ bg: 'bg-orange-100', text: 'text-orange-600' }}
            link="/finance/cod"
            linkText="Deposit Cash"
         />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col justify-center items-center text-center">
            <Users className="h-12 w-12 text-purple-200 mb-3" />
            <h3 className="text-gray-900 font-bold">Rider Fleet</h3>
            <p className="text-sm text-gray-500 mb-4">Onboard new riders and manage fleet status</p>
            <Link to="/masters/rider" className="text-purple-600 text-sm font-bold hover:underline">Manage Riders</Link>
         </div>

         <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col justify-center items-center text-center">
            <MapPin className="h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-gray-900 font-bold">Service Area Map</h3>
            <p className="text-sm text-gray-500 mb-4">View your assigned Pincodes and Zone boundaries</p>
            <Link to="/masters/atlas" className="text-brand-600 text-sm font-bold hover:underline">Open Atlas</Link>
         </div>
      </div>
    </Layout>
  );
};