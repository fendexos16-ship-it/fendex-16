import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { masterDataService } from '../../services/masterDataService';
import { rateCardService } from '../../services/rateCardService';
import { 
  RiderRateCard, 
  DistributionCenter, 
  LastMileDC, 
  UserRole, 
  GeoType, 
  RiderJobType 
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus } from 'lucide-react';

export const RiderRateManager: React.FC = () => {
  const { user } = useAuth();
  const [rates, setRates] = useState<RiderRateCard[]>([]);
  const [dcs, setDcs] = useState<DistributionCenter[]>([]);
  const [lmdcs, setLmdcs] = useState<LastMileDC[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRate, setCurrentRate] = useState<Partial<RiderRateCard>>({});
  
  const [availableLmdcs, setAvailableLmdcs] = useState<LastMileDC[]>([]);

  const canEdit = user?.role === UserRole.FOUNDER;

  const loadData = async () => {
    setLoading(true);
    const [rateData, dcData, lmdcData] = await Promise.all([
      rateCardService.getRiderRates(),
      masterDataService.getDCs(),
      masterDataService.getLMDCs()
    ]);
    setRates(rateData);
    setDcs(dcData);
    setLmdcs(lmdcData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentRate.linkedDcId) {
      setAvailableLmdcs(lmdcs.filter(l => l.linkedDcId === currentRate.linkedDcId));
    } else {
      setAvailableLmdcs([]);
    }
  }, [currentRate.linkedDcId, lmdcs]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRate.name || !currentRate.linkedDcId || !currentRate.amount) return;
    
    await rateCardService.saveRiderRate({
      ...currentRate,
      status: currentRate.status || 'Active'
    } as RiderRateCard);
    
    setIsModalOpen(false);
    loadData();
  };

  const openNew = () => {
    setCurrentRate({ status: 'Active', effectiveDate: new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
  };

  const openEdit = (rate: RiderRateCard) => {
    setCurrentRate({ ...rate });
    setIsModalOpen(true);
  };

  const getDCName = (id: string) => dcs.find(d => d.id === id)?.name || id;
  const getLMDCName = (id?: string) => {
    if (!id) return 'All Linked LMDCs';
    return lmdcs.find(l => l.id === id)?.name || id;
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rider Commercials</h1>
          <p className="text-sm text-gray-500 mt-1">Manage payout rates for Rider Fleet</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Rate Card
          </Button>
        )}
      </div>

      <Table
        data={rates}
        isLoading={loading}
        columns={[
          { header: 'Rate Name', accessor: 'name' },
          { header: 'DC Scope', accessor: (row) => getDCName(row.linkedDcId) },
          { header: 'LMDC Scope', accessor: (row) => getLMDCName(row.linkedLmdcId) },
          { header: 'Geography', accessor: 'geoType' },
          { header: 'Job Type', accessor: 'jobType' },
          { header: 'Rate (₹)', accessor: (row) => `₹${row.amount}`, className: 'font-mono font-medium text-gray-900' },
          { 
            header: 'Status', 
            accessor: (row) => (
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${row.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {row.status}
              </span>
            )
          },
        ]}
        onEdit={canEdit ? openEdit : undefined}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentRate.id ? 'Edit Rider Rate' : 'Create Rider Rate'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input 
            label="Rate Card Name" 
            value={currentRate.name || ''} 
            onChange={e => setCurrentRate({...currentRate, name: e.target.value})} 
            placeholder="e.g. City Bike Delivery"
            required 
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Linked DC</label>
              <select
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                value={currentRate.linkedDcId || ''}
                onChange={e => setCurrentRate({...currentRate, linkedDcId: e.target.value, linkedLmdcId: ''})}
                required
              >
                <option value="">Select DC</option>
                {dcs.map(dc => (
                  <option key={dc.id} value={dc.id}>{dc.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">LMDC (Optional)</label>
              <select
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                value={currentRate.linkedLmdcId || ''}
                onChange={e => setCurrentRate({...currentRate, linkedLmdcId: e.target.value})}
                disabled={!currentRate.linkedDcId}
              >
                <option value="">All LMDCs in DC</option>
                {availableLmdcs.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Geography</label>
              <select
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                value={currentRate.geoType || ''}
                onChange={e => setCurrentRate({...currentRate, geoType: e.target.value as GeoType})}
                required
              >
                <option value="">Select Type</option>
                {Object.values(GeoType).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Type</label>
              <select
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                value={currentRate.jobType || ''}
                onChange={e => setCurrentRate({...currentRate, jobType: e.target.value as RiderJobType})}
                required
              >
                <option value="">Select Job</option>
                {Object.values(RiderJobType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Rate Amount (₹)" 
              type="number"
              min="0"
              value={currentRate.amount || ''} 
              onChange={e => setCurrentRate({...currentRate, amount: parseFloat(e.target.value)})} 
              required 
            />
             <Input 
              label="Effective From" 
              type="date"
              value={currentRate.effectiveDate || ''} 
              onChange={e => setCurrentRate({...currentRate, effectiveDate: e.target.value})} 
              required 
            />
          </div>

          <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                value={currentRate.status || 'Active'}
                onChange={e => setCurrentRate({...currentRate, status: e.target.value as any})}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

          <div className="pt-4">
            <Button type="submit">Save Rate Card</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};