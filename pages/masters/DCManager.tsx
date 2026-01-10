import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { masterDataService } from '../../services/masterDataService';
import { DistributionCenter, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus } from 'lucide-react';

export const DCManager: React.FC = () => {
  const { user } = useAuth();
  const [dcs, setDcs] = useState<DistributionCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDC, setCurrentDC] = useState<Partial<DistributionCenter>>({});
  
  const canEdit = user?.role === UserRole.FOUNDER;

  const loadData = async () => {
    setLoading(true);
    const data = await masterDataService.getDCs();
    setDcs(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDC.code || !currentDC.name) return;
    
    await masterDataService.saveDC({
      ...currentDC,
      status: currentDC.status || 'Active'
    } as DistributionCenter);
    
    setIsModalOpen(false);
    loadData();
  };

  const openNew = () => {
    setCurrentDC({ status: 'Active' });
    setIsModalOpen(true);
  };

  const openEdit = (dc: DistributionCenter) => {
    setCurrentDC({ ...dc });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (dc: DistributionCenter) => {
    if (!canEdit) return;
    await masterDataService.toggleDCStatus(dc.id);
    loadData();
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Distribution Centers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage regional DC hubs</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add DC
          </Button>
        )}
      </div>

      <Table
        data={dcs}
        isLoading={loading}
        columns={[
          { header: 'DC Code', accessor: 'code', className: 'w-24' },
          { header: 'Name', accessor: 'name' },
          { header: 'City', accessor: 'city' },
          { header: 'State', accessor: 'state' },
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
        onToggleStatus={canEdit ? handleToggleStatus : undefined}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentDC.id ? 'Edit Distribution Center' : 'Add New DC'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input 
            label="DC Code" 
            value={currentDC.code || ''} 
            onChange={e => setCurrentDC({...currentDC, code: e.target.value})} 
            placeholder="e.g. DC001"
            required 
          />
          <Input 
            label="DC Name" 
            value={currentDC.name || ''} 
            onChange={e => setCurrentDC({...currentDC, name: e.target.value})} 
            placeholder="e.g. North Hub"
            required 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="City" 
              value={currentDC.city || ''} 
              onChange={e => setCurrentDC({...currentDC, city: e.target.value})} 
              required 
            />
            <Input 
              label="State" 
              value={currentDC.state || ''} 
              onChange={e => setCurrentDC({...currentDC, state: e.target.value})} 
              required 
            />
          </div>
          <div className="pt-4">
            <Button type="submit">Save DC</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};