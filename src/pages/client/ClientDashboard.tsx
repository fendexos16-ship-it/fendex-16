
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { shipmentService } from '../../services/shipmentService';
import { portalService, PortalStats } from '../../services/portalService';
import { Shipment, ShipmentStatus, PaymentMode } from '../../types';
import { Link } from 'react-router-dom';
import { 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  Banknote,
  FileText,
  TrendingUp,
  Clock,
  Briefcase,
  AlertOctagon
} from 'lucide-react';
import { Button } from '../../components/Button';

export const ClientDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [opsStats, setOpsStats] = useState({ total: 0, delivered: 0, exceptions: 0, cod: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
       if (!user?.linkedEntityId) return;
       const [pStats, sData] = await Promise.all([
          portalService.getDashboardStats(user),
          shipmentService.getShipments(user)
       ]);

       setStats(pStats);
       
       const delivered = sData.filter(s => s.status === ShipmentStatus.DELIVERED);
       const cod = delivered.filter(s => s.paymentMode === PaymentMode.COD).reduce((s, c) => s + c.codAmount, 0);

       setOpsStats({
          total: sData.length,
          delivered: delivered.length,
          exceptions: sData.filter(s => s.status === ShipmentStatus.RTO || s.status === ShipmentStatus.UNDELIVERED).length,
          cod
       });

       setLoading(false);
    };
    load();
  }, [user]);

  const StatWidget = ({ title, value, icon: Icon, color, link, subtext, action }: any) => (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden group hover:border-brand-300 transition-all">
       <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
          <Icon className={`h-16 w-16 ${color.text}`} />
       </div>
       <div className="relative z-10 flex flex-col h-full justify-between">
          <div>
             <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
             <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
             {subtext && <p className={`text-xs mt-1 font-medium ${color.text}`}>{subtext}</p>}
          </div>
          <div className="mt-4">
             {link && (
                <Link to={link} className={`text-xs font-bold ${color.text} hover:underline inline-block`}>
                   View Details &rarr;
                </Link>
             )}
             {action}
          </div>
       </div>
    </div>
  );

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Partner Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview for {user?.name}</p>
      </div>

      {stats && stats.activeDisputes > 0 && (
         <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center text-red-800">
            <AlertOctagon className="h-5 w-5 mr-2" />
            <span className="font-bold">Action Required:</span>
            <span className="ml-1">You have {stats.activeDisputes} active invoice dispute(s).</span>
            <Link to="/client/billing" className="ml-auto text-sm underline font-bold hover:text-red-900">Resolve Now</Link>
         </div>
      )}

      {/* FINANCIAL HEALTH ROW */}
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
         <Banknote className="h-5 w-5 mr-2 text-green-600" /> Financial Overview
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <StatWidget 
            title="Outstanding Dues" 
            value={`₹${(stats?.outstandingBalance || 0).toLocaleString()}`} 
            icon={TrendingUp} 
            color={{ text: 'text-red-600' }}
            subtext={`Next Due: ${stats?.nextDueDate}`}
            action={
               stats?.outstandingBalance ? (
                  <Link to="/client/billing" className="mt-2 block w-full bg-red-600 text-white text-center py-2 rounded text-sm font-bold hover:bg-red-700 shadow-sm">
                     Pay Now
                  </Link>
               ) : null
            }
         />
         <StatWidget 
            title="Open Invoices" 
            value={stats?.openInvoices || 0} 
            icon={FileText} 
            color={{ text: 'text-blue-600' }}
            link="/client/billing"
            subtext="Pending Payment"
         />
         <StatWidget 
            title="Last Payment" 
            value={stats?.lastPaymentDate} 
            icon={CheckCircle} 
            color={{ text: 'text-green-600' }}
            link="/client/billing"
            subtext="View History"
         />
      </div>

      {/* OPERATIONS ROW */}
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
         <Package className="h-5 w-5 mr-2 text-brand-600" /> Operational Metrics
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
         <StatWidget 
            title="Total Shipments" 
            value={opsStats.total} 
            icon={Package} 
            color={{ text: 'text-gray-700' }}
            link="/client/shipments"
         />
         <StatWidget 
            title="Delivered" 
            value={opsStats.delivered} 
            icon={CheckCircle} 
            color={{ text: 'text-green-600' }}
            link="/client/shipments"
         />
         <StatWidget 
            title="Exceptions" 
            value={opsStats.exceptions} 
            icon={AlertTriangle} 
            color={{ text: 'text-orange-600' }}
            link="/client/shipments"
            subtext="RTO / Undelivered"
         />
         <StatWidget 
            title="COD Recovered" 
            value={`₹${opsStats.cod.toLocaleString()}`} 
            icon={Banknote} 
            color={{ text: 'text-blue-600' }}
            subtext="Delivered Cash"
         />
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
         <div>
            <h3 className="font-bold text-gray-900 flex items-center">
               <Briefcase className="h-5 w-5 mr-2 text-brand-600" />
               Integration Status
            </h3>
            <p className="text-sm text-gray-500 mt-1">API Key active. Webhooks enabled.</p>
         </div>
         <div className="text-right">
            <p className="text-xs text-gray-400">Environment</p>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
               Operational
            </span>
         </div>
      </div>
    </Layout>
  );
};
