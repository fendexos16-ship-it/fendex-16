
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { bagService } from '../../services/bagService';
import { tripService } from '../../services/tripService';
import { connectionSheetService } from '../../services/connectionSheetService';
import { Bag, Trip, BagStatus, TripStatus } from '../../types';
import { Link } from 'react-router-dom';
import { 
  ArrowDownCircle, 
  Truck, 
  AlertTriangle, 
  Layers, 
  Send
} from 'lucide-react';

export const MMDCDashboard: React.FC = () => {
  const { user } = useAuth();
  const [inboundTrips, setInboundTrips] = useState<Trip[]>([]);
  const [openSheets, setOpenSheets] = useState(0);
  const [closedSheets, setClosedSheets] = useState(0);
  const [exceptions, setExceptions] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.linkedEntityId) return;
      const mmdcId = user.linkedEntityId;
      
      const allBags = await bagService.getBags(mmdcId);
      const allTrips = await tripService.getTrips(mmdcId);
      const sheets = await connectionSheetService.getSheets(mmdcId);

      setInboundTrips(allTrips.filter(t => t.destinationEntityId === mmdcId && t.status === TripStatus.IN_TRANSIT));
      setOpenSheets(sheets.filter(s => s.status === 'CREATED' || s.status === 'IN_PROGRESS').length);
      setClosedSheets(sheets.filter(s => s.status === 'CLOSED').length);
      
      // Strict Custody Exception Count
      const exCount = allBags.reduce((acc, b) => acc + (b.shortageCount + b.damageCount), 0);
      setExceptions(exCount);
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
        <h1 className="text-2xl font-bold text-gray-900">Hub Operations Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
           MMDC: <strong className="text-gray-900">{user?.linkedEntityId}</strong> | Station Manager: {user?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
         <StatWidget 
            title="Inbound Trips" 
            count={inboundTrips.length} 
            icon={ArrowDownCircle} 
            color={{ bg: 'bg-blue-100', text: 'text-blue-600' }}
            link="/ops/mmdc/inbound"
            linkText="Inbound Dock"
         />
         <StatWidget 
            title="Open Sorting Sheets" 
            count={openSheets} 
            icon={Layers} 
            color={{ bg: 'bg-indigo-100', text: 'text-indigo-600' }}
            link="/ops/mmdc/connection"
            linkText="Sorting Area"
         />
         <StatWidget 
            title="Ready for Dispatch" 
            count={closedSheets} 
            icon={Send} 
            color={{ bg: 'bg-green-100', text: 'text-green-600' }}
            link="/ops/mmdc/outbound"
            linkText="Outbound Dock"
         />
         <StatWidget 
            title="Exceptions Today" 
            count={exceptions} 
            icon={AlertTriangle} 
            color={{ bg: 'bg-red-100', text: 'text-red-600' }}
            link="/ops/audit"
            linkText="View Logs"
         />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
         <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Truck className="h-5 w-5 mr-2 text-gray-500" />
            Inbound Traffic (Live)
         </h3>
         <div className="space-y-4">
            {inboundTrips.length === 0 ? (
               <p className="text-gray-500 italic text-sm">No vehicles currently en route.</p>
            ) : (
               inboundTrips.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                     <div className="flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 animate-pulse"></span>
                        <div>
                           <p className="font-bold text-sm text-gray-900">{t.tripCode}</p>
                           <p className="text-xs text-gray-500">Vehicle: {t.vehicleNumber}</p>
                        </div>
                     </div>
                     <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">IN TRANSIT</span>
                  </div>
               ))
            )}
         </div>
      </div>
    </Layout>
  );
};
