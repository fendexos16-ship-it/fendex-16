
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { rateCardService } from '../../services/rateCardService';
import { clientService } from '../../services/clientService';
import { ClientRateCard, Client, UserRole, GeoType, LmdcShipmentType, FeeType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus, Percent, Archive } from 'lucide-react';

export const ClientRateCardManager: React.FC = () => {
  const { user } = useAuth();
  const [rates, setRates] = useState<ClientRateCard[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRate, setCurrentRate] = useState<Partial<ClientRateCard>>({ 
     status: 'ACTIVE',
     rules: [] 
  });

  const [activeRule, setActiveRule] = useState<{
     geoType: GeoType,
     shipmentType: LmdcShipmentType,
     baseRate: number,
     codFeeType: FeeType,
     codFeeValue: number,
     rtoRate: number
  }>({
     geoType: GeoType.CITY,
     shipmentType: LmdcShipmentType.DELIVERY,
     baseRate: 0,
     codFeeType: FeeType.PERCENTAGE,
     codFeeValue: 0,
     rtoRate: 0
  });

  const canEdit = user?.role === UserRole.FOUNDER;

  const loadData = async () => {
    setLoading(true);
    const [rateData, clientData] = await Promise.all([
      rateCardService.getClientRates(user!),
      clientService.getClients()
    ]);
    setRates(rateData);
    setClients(clientData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRate.clientId || !currentRate.name || !currentRate.effectiveDate) return;
    
    try {
       await rateCardService.saveClientRateCard(user!, currentRate as ClientRateCard);
       setIsModalOpen(false);
       loadData();
    } catch(e:any) { alert(e.message); }
  };

  const addRule = () => {
     if (activeRule.baseRate < 0) return alert("Negative rates not allowed");
     
     const newRules = [...(currentRate.rules || [])];
     // Remove duplicate if exists for same geo/type
     const idx = newRules.findIndex(r => r.geoType === activeRule.geoType && r.shipmentType === activeRule.shipmentType);
     if (idx !== -1) newRules.splice(idx, 1);
     
     newRules.push({ ...activeRule });
     setCurrentRate({ ...currentRate, rules: newRules });
  };

  const removeRule = (idx: number) => {
     const newRules = [...(currentRate.rules || [])];
     newRules.splice(idx, 1);
     setCurrentRate({ ...currentRate, rules: newRules });
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || id;

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
             <Percent className="mr-3 h-8 w-8 text-brand-600" /> Client Rate Cards
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage billing rules for clients (Freight, COD Fees, RTO)</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setCurrentRate({ status: 'ACTIVE', rules: [], effectiveDate: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); }} className="w-auto">
            <Plus className="h-4 w-4 mr-2" /> New Rate Card
          </Button>
        )}
      </div>

      <Table<ClientRateCard>
        data={rates}
        isLoading={loading}
        columns={[
           { header: 'Rate Name', accessor: 'name', className: 'font-bold' },
           { header: 'Client', accessor: (r) => getClientName(r.clientId) },
           { header: 'Effective From', accessor: 'effectiveDate' },
           { header: 'Rules', accessor: (r) => r.rules.length },
           { 
              header: 'Status', 
              accessor: (r) => (
                 <span className={`px-2 py-1 rounded text-xs font-bold ${r.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {r.status}
                 </span>
              ) 
           }
        ]}
        actions={(r) => (
           <button onClick={() => { setCurrentRate(r); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 font-bold text-xs">View / Edit</button>
        )}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentRate.id ? 'Edit Rate Card' : 'New Client Rate Card'}>
         <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium mb-1">Client</label>
                  <select 
                     className="w-full border rounded p-2"
                     value={currentRate.clientId || ''}
                     onChange={e => setCurrentRate({...currentRate, clientId: e.target.value})}
                     disabled={!!currentRate.id} // Lock client on edit
                     required
                  >
                     <option value="">Select Client</option>
                     {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
               </div>
               <Input label="Rate Name" value={currentRate.name || ''} onChange={e => setCurrentRate({...currentRate, name: e.target.value})} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <Input label="Effective Date" type="date" value={currentRate.effectiveDate || ''} onChange={e => setCurrentRate({...currentRate, effectiveDate: e.target.value})} required />
               <Input label="Expiry Date (Optional)" type="date" value={currentRate.expiryDate || ''} onChange={e => setCurrentRate({...currentRate, expiryDate: e.target.value})} />
            </div>

            <div className="bg-gray-50 p-4 rounded border border-gray-200">
               <h4 className="font-bold text-sm mb-3">Add Pricing Rule</h4>
               <div className="grid grid-cols-2 gap-3 mb-3">
                  <select className="border rounded p-1 text-sm" value={activeRule.geoType} onChange={e => setActiveRule({...activeRule, geoType: e.target.value as GeoType})}>
                     {Object.values(GeoType).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select className="border rounded p-1 text-sm" value={activeRule.shipmentType} onChange={e => setActiveRule({...activeRule, shipmentType: e.target.value as LmdcShipmentType})}>
                     {Object.values(LmdcShipmentType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
               </div>
               
               <div className="grid grid-cols-3 gap-3 mb-3">
                  <Input label="Base Rate" type="number" value={activeRule.baseRate} onChange={e => setActiveRule({...activeRule, baseRate: parseFloat(e.target.value)})} className="bg-white" />
                  <Input label="RTO Rate" type="number" value={activeRule.rtoRate} onChange={e => setActiveRule({...activeRule, rtoRate: parseFloat(e.target.value)})} className="bg-white" />
                  
                  <div>
                     <label className="block text-xs font-medium mb-1">COD Fee</label>
                     <div className="flex">
                        <input type="number" className="w-16 border rounded-l p-1 text-sm" value={activeRule.codFeeValue} onChange={e => setActiveRule({...activeRule, codFeeValue: parseFloat(e.target.value)})} />
                        <select className="border-t border-b border-r rounded-r p-1 text-xs bg-gray-100" value={activeRule.codFeeType} onChange={e => setActiveRule({...activeRule, codFeeType: e.target.value as FeeType})}>
                           <option value={FeeType.PERCENTAGE}>%</option>
                           <option value={FeeType.FLAT}>₹</option>
                        </select>
                     </div>
                  </div>
               </div>
               <Button type="button" onClick={addRule} variant="secondary" className="text-xs h-8 w-auto">Add Rule</Button>
            </div>

            <div className="max-h-40 overflow-y-auto border rounded">
               <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 font-bold">
                     <tr>
                        <th className="p-2">Geo</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Base</th>
                        <th className="p-2">RTO</th>
                        <th className="p-2">COD Fee</th>
                        <th className="p-2"></th>
                     </tr>
                  </thead>
                  <tbody>
                     {currentRate.rules?.map((r, i) => (
                        <tr key={i} className="border-t">
                           <td className="p-2">{r.geoType}</td>
                           <td className="p-2">{r.shipmentType}</td>
                           <td className="p-2">₹{r.baseRate}</td>
                           <td className="p-2">₹{r.rtoRate}</td>
                           <td className="p-2">{r.codFeeValue}{r.codFeeType === FeeType.PERCENTAGE ? '%' : '₹'}</td>
                           <td className="p-2 text-right">
                              <button type="button" onClick={() => removeRule(i)} className="text-red-600 hover:text-red-800">x</button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            <div className="pt-2 flex justify-end gap-2">
               <Button onClick={() => setIsModalOpen(false)} type="button" variant="secondary">Cancel</Button>
               <Button type="submit">Save Rate Card</Button>
            </div>
         </form>
      </Modal>
    </Layout>
  );
};
