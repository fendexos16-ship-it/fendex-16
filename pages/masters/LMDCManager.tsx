import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { masterDataService } from '../../services/masterDataService';
import { LastMileDC, MMDC, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus, CreditCard, User, Building2, MapPin, Warehouse } from 'lucide-react';

export const LMDCManager: React.FC = () => {
  const { user } = useAuth();
  const [lmdcs, setLmdcs] = useState<LastMileDC[]>([]);
  const [mmdcs, setMmdcs] = useState<MMDC[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentLMDC, setCurrentLMDC] = useState<Partial<LastMileDC>>({});
  
  const canEdit = user?.role === UserRole.FOUNDER;

  const loadData = async () => {
    setLoading(true);
    const [lmdcData, mmdcData] = await Promise.all([
      masterDataService.getLMDCs(),
      masterDataService.getMMDCs()
    ]);
    setLmdcs(lmdcData);
    setMmdcs(mmdcData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLMDC.code || !currentLMDC.name || !currentLMDC.linkedMmdcId) return;
    
    await masterDataService.saveLMDC({
      ...currentLMDC,
      status: currentLMDC.status || 'Active'
    } as LastMileDC);
    
    setIsModalOpen(false);
    loadData();
  };

  const openNew = () => {
    setCurrentLMDC({ status: 'Active' });
    setIsModalOpen(true);
  };

  const openEdit = (lmdc: LastMileDC) => {
    setCurrentLMDC({ ...lmdc });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (lmdc: LastMileDC) => {
    if (!canEdit) return;
    await masterDataService.toggleLMDCStatus(lmdc.id);
    loadData();
  };

  // Helper to find MMDC name
  const getMMDCName = (id: string) => mmdcs.find(m => m.id === id)?.name || 'Unknown';

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LMDC Master</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Last Mile Distribution Centers & Geolocation</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add LMDC
          </Button>
        )}
      </div>

      <Table
        data={lmdcs}
        isLoading={loading}
        columns={[
          { header: 'Code', accessor: 'code', className: 'w-24' },
          { header: 'Name', accessor: 'name' },
          { header: 'Parent MMDC', accessor: (row) => getMMDCName(row.linkedMmdcId) },
          { header: 'City', accessor: 'city' },
          { header: 'Owner', accessor: (row) => row.ownerName || '-' },
          { header: 'Coords', accessor: (row) => row.latitude ? `${row.latitude}, ${row.longitude}` : <span className="text-gray-400">Not Set</span>, className: 'text-xs font-mono' },
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
        title={currentLMDC.id ? 'Edit LMDC Profile' : 'Register New LMDC'}
      >
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Section 1: Basic Info */}
          <div>
             <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                <Building2 className="h-4 w-4 mr-1 text-gray-500" />
                Center Details
             </h4>
             <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="LMDC Code" 
                  value={currentLMDC.code || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, code: e.target.value})} 
                  required 
                />
                <Input 
                  label="Center Name" 
                  value={currentLMDC.name || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, name: e.target.value})} 
                  required 
                />
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Linked MMDC</label>
                  <select
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-600 focus:border-brand-600"
                    value={currentLMDC.linkedMmdcId || ''}
                    onChange={e => setCurrentLMDC({...currentLMDC, linkedMmdcId: e.target.value})}
                    required
                  >
                    <option value="">Select a Mid-Mile DC</option>
                    {mmdcs.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.city})</option>
                    ))}
                  </select>
                </div>
                <Input 
                  label="City" 
                  value={currentLMDC.city || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, city: e.target.value})} 
                  required 
                />
             </div>
          </div>

          {/* Section 2: Geo Info */}
          <div className="bg-blue-50 p-4 rounded border border-blue-200">
             <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                <MapPin className="h-4 w-4 mr-1 text-gray-500" />
                Geolocation (Atlas Phase D)
             </h4>
             <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Latitude" 
                  type="number"
                  step="any"
                  value={currentLMDC.latitude || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, latitude: parseFloat(e.target.value)})} 
                  className="bg-white"
                />
                <Input 
                  label="Longitude" 
                  type="number"
                  step="any"
                  value={currentLMDC.longitude || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, longitude: parseFloat(e.target.value)})} 
                  className="bg-white"
                />
             </div>
          </div>

          {/* Section 3: Owner Info */}
          <div>
             <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                <User className="h-4 w-4 mr-1 text-gray-500" />
                Owner Information
             </h4>
             <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Owner Name" 
                  value={currentLMDC.ownerName || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, ownerName: e.target.value})} 
                  required 
                />
                <Input 
                  label="Login Phone" 
                  type="tel"
                  value={currentLMDC.phone || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, phone: e.target.value})} 
                  required 
                />
             </div>
          </div>

          {/* Section 4: Financial & Compliance */}
          <div className="bg-gray-50 p-4 rounded border border-gray-200">
             <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                <CreditCard className="h-4 w-4 mr-1 text-gray-500" />
                Banking & Compliance
             </h4>
             <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Bank Account No" 
                  value={currentLMDC.bankAccount || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, bankAccount: e.target.value})} 
                  className="bg-white"
                  required 
                />
                <Input 
                  label="IFSC Code" 
                  value={currentLMDC.ifsc || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, ifsc: e.target.value.toUpperCase()})} 
                  className="bg-white"
                  required 
                />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="GSTIN" 
                  value={currentLMDC.gst || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, gst: e.target.value.toUpperCase()})} 
                  className="bg-white"
                  required 
                />
                <Input 
                  label="PAN" 
                  value={currentLMDC.pan || ''} 
                  onChange={e => setCurrentLMDC({...currentLMDC, pan: e.target.value.toUpperCase()})} 
                  className="bg-white"
                  required 
                />
             </div>
          </div>

          {!currentLMDC.id && (
             <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                <strong>Auto-Login Creation:</strong> <br/>
                Default Password will be <code>Password@123</code>
             </div>
          )}

          <div className="pt-2">
            <Button type="submit">Save LMDC Profile</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};