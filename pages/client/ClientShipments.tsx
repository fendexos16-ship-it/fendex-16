
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { useAuth } from '../../context/AuthContext';
import { shipmentService } from '../../services/shipmentService';
import { Shipment, ShipmentStatus, PaymentMode } from '../../types';
import { Package, Search } from 'lucide-react';

export const ClientShipments: React.FC = () => {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filtered, setFiltered] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
       if (!user) return;
       setLoading(true);
       const data = await shipmentService.getShipments(user);
       setShipments(data);
       setFiltered(data);
       setLoading(false);
    };
    load();
  }, [user]);

  useEffect(() => {
     if (!search) {
        setFiltered(shipments);
     } else {
        const lower = search.toLowerCase();
        setFiltered(shipments.filter(s => 
           s.awb.toLowerCase().includes(lower) || 
           s.destinationPincode.includes(lower) ||
           s.customerName?.toLowerCase().includes(lower)
        ));
     }
  }, [search, shipments]);

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Package className="mr-3 h-8 w-8 text-brand-600" /> My Shipments
           </h1>
           <p className="text-sm text-gray-500 mt-1">Track all your deliveries in real-time</p>
        </div>
        <div className="relative">
           <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
           <input 
              type="text" 
              placeholder="Search AWB, Pincode..." 
              className="pl-9 pr-4 py-2 border rounded-md text-sm w-64 focus:ring-brand-500 focus:border-brand-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
           />
        </div>
      </div>

      <Table<Shipment>
         data={filtered}
         isLoading={loading}
         columns={[
            { header: 'AWB', accessor: 'awb', className: 'font-mono font-bold' },
            { header: 'Date', accessor: (s) => new Date(s.createdAt).toLocaleDateString() },
            { header: 'Pincode', accessor: 'destinationPincode' },
            { header: 'Type', accessor: 'shipmentType' },
            { 
               header: 'Mode', 
               accessor: (s) => (
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                     s.paymentMode === PaymentMode.COD ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                     {s.paymentMode}
                  </span>
               )
            },
            { header: 'Amount', accessor: (s) => s.paymentMode === PaymentMode.COD ? `₹${s.codAmount}` : '-' },
            { 
               header: 'Status', 
               accessor: (row) => {
                 const colors: Record<string, string> = {
                   [ShipmentStatus.INBOUND]: 'bg-blue-100 text-blue-800',
                   [ShipmentStatus.ASSIGNED]: 'bg-yellow-100 text-yellow-800',
                   [ShipmentStatus.DELIVERED]: 'bg-green-100 text-green-800',
                   [ShipmentStatus.UNDELIVERED]: 'bg-red-100 text-red-800',
                   [ShipmentStatus.RTO]: 'bg-gray-100 text-gray-800',
                 };
                 return (
                   <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colors[row.status] || 'bg-gray-100'}`}>
                     {row.status}
                   </span>
                 );
               }
            },
            { header: 'Last Update', accessor: (s) => new Date(s.updatedAt).toLocaleString() }
         ]}
      />
    </Layout>
  );
};
