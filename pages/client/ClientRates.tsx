
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { rateCardService } from '../../services/rateCardService';
import { ClientRateCard, FeeType } from '../../types';
import { Percent, Info } from 'lucide-react';

export const ClientRates: React.FC = () => {
  const { user } = useAuth();
  const [rates, setRates] = useState<ClientRateCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
       if (!user) return;
       setLoading(true);
       try {
          const data = await rateCardService.getClientRates(user);
          setRates(data);
       } catch(e) { console.error(e); }
       setLoading(false);
    };
    load();
  }, [user]);

  return (
    <Layout>
      <div className="mb-6">
         <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Percent className="mr-3 h-8 w-8 text-brand-600" /> Active Rate Card
         </h1>
         <p className="text-sm text-gray-500 mt-1">Your current commercial terms</p>
      </div>

      {loading ? (
         <div className="p-8 text-center text-gray-500">Loading...</div>
      ) : rates.length === 0 ? (
         <div className="bg-gray-50 p-8 rounded-lg border border-gray-200 text-center">
            <p className="text-gray-500">No active rate card found. Standard rates apply.</p>
         </div>
      ) : (
         <div className="space-y-6">
            {rates.map(card => (
               <div key={card.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                     <div>
                        <h3 className="font-bold text-gray-900">{card.name}</h3>
                        <p className="text-xs text-gray-500">Effective: {new Date(card.effectiveDate).toLocaleDateString()}</p>
                     </div>
                     <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">ACTIVE</span>
                  </div>
                  
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                     <thead className="bg-white">
                        <tr>
                           <th className="px-6 py-3 text-left font-medium text-gray-500">Geography</th>
                           <th className="px-6 py-3 text-left font-medium text-gray-500">Service Type</th>
                           <th className="px-6 py-3 text-left font-medium text-gray-500">Base Freight</th>
                           <th className="px-6 py-3 text-left font-medium text-gray-500">RTO Charge</th>
                           <th className="px-6 py-3 text-left font-medium text-gray-500">COD Fee</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-200">
                        {card.rules.map((rule, idx) => (
                           <tr key={idx}>
                              <td className="px-6 py-4">{rule.geoType}</td>
                              <td className="px-6 py-4">{rule.shipmentType}</td>
                              <td className="px-6 py-4 font-bold">₹{rule.baseRate}</td>
                              <td className="px-6 py-4 text-gray-600">₹{rule.rtoRate}</td>
                              <td className="px-6 py-4 text-gray-600">
                                 {rule.codFeeValue}{rule.codFeeType === FeeType.PERCENTAGE ? '%' : '₹'}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
                  
                  <div className="p-4 bg-blue-50 text-xs text-blue-800 flex items-start">
                     <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                     <p>
                        <strong>Note:</strong> Rates are subject to GST. COD Fees are applied on collected amount. RTO charges apply if shipment is undelivered after attempts.
                     </p>
                  </div>
               </div>
            ))}
         </div>
      )}
    </Layout>
  );
};
