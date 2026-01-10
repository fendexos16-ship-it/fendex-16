
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { shipmentService } from '../../services/shipmentService';
import { settlementService } from '../../services/settlementService';
import { Shipment, ShipmentStatus, PaymentMode, SettlementState } from '../../types';
import { Link } from 'react-router-dom';
import { 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  Banknote,
  FileText,
  TrendingUp,
  Clock
} from 'lucide-react';

export const ClientDashboard: React.FC = () => {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState({
     total: 0,
     delivered: 0,
     exceptions: 0,
     codCollected: 0,
     pendingSettlement: 0,
     paidSettlement: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
       if (!user?.linkedEntityId) return;
       const data = await shipmentService.getShipments(user);
       const batches = await settlementService.getBatches(user.linkedEntityId, user.role);
       
       const delivered = data.filter(s => s.status === ShipmentStatus.DELIVERED);
       const collected = delivered
          .filter(s => s.paymentMode === PaymentMode.COD)
          .reduce((sum, s) => sum + s.codAmount, 0);
          
       // Settlement Stats
       const pendingSettlement = batches
          .filter(b => b.status !== SettlementState.SETTLED && b.status !== SettlementState.DRAFT)
          .reduce((sum, b) => sum + b.netAmount, 0);
          
       const paidSettlement = batches
          .filter(b => b.status === SettlementState.SETTLED)
          .reduce((sum, b) => sum + b.netAmount, 0);

       setShipments(data);
       setStats({
          total: data.length,
          delivered: delivered.length,
          exceptions: data.filter(s => [ShipmentStatus.UNDELIVERED, ShipmentStatus.RTO].includes(s.status)).length,
          codCollected: collected,
          pendingSettlement,
          paidSettlement
       });
       setLoading(false);
    };
    load();
  }, [user]);

  const StatWidget = ({ title, value, icon: Icon, color, link, subtext }: any) => (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden group">
       <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
          <Icon className={`h-16 w-16 ${color.text}`} />
       </div>
       <div className="relative z-10">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtext && <p className={`text-xs mt-1 font-medium ${color.text}`}>{subtext}</p>}
          {link && (
             <Link to={link} className={`text-xs font-bold ${color.text} hover:underline mt-4 inline-block`}>
                View Details &rarr;
             </Link>
          )}
       </div>
    </div>
  );

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Partner Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <StatWidget 
            title="Total Shipments" 
            value={stats.total} 
            icon={Package} 
            color={{ text: 'text-blue-600' }}
            link="/client/shipments"
            subtext={`${stats.delivered} Delivered`}
         />
         <StatWidget 
            title="Active Exceptions" 
            value={stats.exceptions} 
            icon={AlertTriangle} 
            color={{ text: 'text-red-600' }}
            link="/client/shipments"
            subtext="RTO / Undelivered"
         />
         <StatWidget 
            title="COD Collected" 
            value={`₹${stats.codCollected.toLocaleString()}`} 
            icon={Banknote} 
            color={{ text: 'text-green-600' }}
            subtext="Total Delivered COD"
         />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
         <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-brand-600" /> Financial Summary
         </h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
               <div className="flex justify-between items-center">
                  <div>
                     <p className="text-xs font-bold text-yellow-800 uppercase">Pending Settlement</p>
                     <p className="text-2xl font-bold text-yellow-900 mt-1">₹{stats.pendingSettlement.toLocaleString()}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-400" />
               </div>
               <p className="text-xs text-yellow-700 mt-2">Processing or awaiting bank transfer.</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
               <div className="flex justify-between items-center">
                  <div>
                     <p className="text-xs font-bold text-green-800 uppercase">Total Settled</p>
                     <p className="text-2xl font-bold text-green-900 mt-1">₹{stats.paidSettlement.toLocaleString()}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-400" />
               </div>
               <p className="text-xs text-green-700 mt-2">Successfully remitted to your account.</p>
            </div>
         </div>
         <div className="mt-4 text-right">
            <Link to="/client/settlements" className="text-sm font-bold text-brand-600 hover:text-brand-800">
               View All Statements &rarr;
            </Link>
         </div>
      </div>
    </Layout>
  );
};
