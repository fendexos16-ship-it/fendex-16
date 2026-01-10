import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { masterDataService } from '../../services/masterDataService';
import { MMDC, DistributionCenter, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus, Warehouse } from 'lucide-react';

export const MMDCManager: React.FC = () => {
  const { user } = useAuth();
  const [mmdcs, setMmdcs] = useState<MMDC[]>([]);
  const [dcs, setDcs] = useState<DistributionCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [current, setCurrent] = useState<Partial<MMDC>>({});
  
  const canEdit = user?.role === UserRole.FOUNDER;

  const loadData = async () => {
    setLoading(true);
    const [m, d] = await Promise.all([
      masterDataService.getMMDCs(),
      masterDataService.getDCs()
    ]);
    setMmdcs(m);
    setDcs(d);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.code || !current.name || !current.linkedDcId) return;
    
    await masterDataService.saveMMDC({
      ...current,
      status: current.status || 'Active'
    } as MMDC);
    
    setIsModalOpen(false);
    loadData();
  };

  const openNew = () => {
    setCurrent({ status: 'Active' });
    setIsModalOpen(true);
  };

  const openEdit = (mmdc: MMDC) => {
    setCurrent({ ...mmdc });
    setIsModalOpen(true);
  };

  const getDCName = (id: string) => dcs.find(d => d.id === id)?.name || id;

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Warehouse className="mr-3 h-8 w-8 text-brand-600" />
            Mid-Mile DCs (MMDC)
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage processing hubs and their managers</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add MMDC
          </Button>
        )}
      </div>

      <Table
        data={mmdcs}
        isLoading={loading}
        columns={[
          { header: 'Code', accessor: 'code', className: 'w-24 font-mono' },
          { header: 'Name', accessor: 'name' },
          { header: 'Parent Hub (DC)', accessor: (row) => getDCName(row.linkedDcId) },
          { header: 'Manager', accessor: (row) => row.managerName || '-' },
          { header: 'Phone', accessor: (row) => row.phone || '-' },
          { 
            header: 'Status', 
            accessor: (row) => (
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${row.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
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
        title={current.id ? 'Edit MMDC' : 'Register New MMDC'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <Input 
               label="MMDC Code" 
               value={current.code || ''} 
               onChange={e => setCurrent({...current, code: e.target.value})} 
               required 
             />
             <Input 
               label="MMDC Name" 
               value={current.name || ''} 
               onChange={e => setCurrent({...current, name: e.target.value})} 
               required 
             />
          </div>
          
          <div className="w-full">
             <label className="block text-sm font-medium text-gray-700 mb-1.5">Linked Regional DC</label>
             <select
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                value={current.linkedDcId || ''}
                onChange={e => setCurrent({...current, linkedDcId: e.target.value})}
                required
             >
                <option value="">Select Regional Hub</option>
                {dcs.map(d => <option key={d.id} value={d.id}>{d.name} ({d.city})</option>)}
             </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <Input 
               label="City" 
               value={current.city || ''} 
               onChange={e => setCurrent({...current, city: e.target.value})} 
               required 
             />
             <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select 
                   className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                   value={current.status || 'Active'}
                   onChange={e => setCurrent({...current, status: e.target.value as any})}
                >
                   <option value="Active">Active</option>
                   <option value="Inactive">Inactive</option>
                </select>
             </div>
          </div>

          <div className="bg-blue-50 p-4 rounded border border-blue-200">
             <h4 className="text-sm font-bold text-blue-900 mb-3">Manager Login (Auto-Created)</h4>
             <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Manager Name" 
                  value={current.managerName || ''} 
                  onChange={e => setCurrent({...current, managerName: e.target.value})} 
                  required 
                  className="bg-white"
                />
                <Input 
                  label="Login Phone" 
                  value={current.phone || ''} 
                  onChange={e => setCurrent({...current, phone: e.target.value})} 
                  required 
                  className="bg-white"
                />
             </div>
             <p className="text-xs text-blue-600 mt-1">Default Password: <strong>Password@123</strong></p>
          </div>

          <div className="pt-2">
            <Button type="submit">Save MMDC</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};