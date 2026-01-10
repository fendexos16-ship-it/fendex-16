import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { pincodeService } from '../../services/pincodeService';
import { masterDataService } from '../../services/masterDataService';
import { PincodeMaster, ZoneType, LastMileDC, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus, MapPin } from 'lucide-react';

export const PincodeManager: React.FC = () => {
  const { user } = useAuth();
  const [pincodes, setPincodes] = useState<PincodeMaster[]>([]);
  const [lmdcs, setLmdcs] = useState<LastMileDC[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [current, setCurrent] = useState<Partial<PincodeMaster>>({});
  
  const canEdit = user?.role === UserRole.FOUNDER;

  const loadData = async () => {
    setLoading(true);
    const [pinData, lmdcData] = await Promise.all([
      pincodeService.getAll(),
      masterDataService.getLMDCs()
    ]);
    setPincodes(pinData);
    setLmdcs(lmdcData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.pincode || !current.city) return;
    
    // Check if new or edit
    const exists = pincodes.find(p => p.pincode === current.pincode);
    if (exists) {
      await pincodeService.update(current as PincodeMaster);
    } else {
      await pincodeService.create(current as PincodeMaster);
    }
    
    setIsModalOpen(false);
    loadData();
  };

  const openNew = () => {
    setCurrent({ serviceable: true, zone: ZoneType.METRO });
    setIsModalOpen(true);
  };

  const openEdit = (item: PincodeMaster) => {
    setCurrent({ ...item });
    setIsModalOpen(true);
  };

  const getLMDCName = (id?: string) => {
    if (!id) return <span className="text-red-500 font-bold">Unmapped</span>;
    const lmdc = lmdcs.find(l => l.id === id);
    return lmdc ? lmdc.name : id;
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <MapPin className="mr-3 h-8 w-8 text-brand-600" />
            Pincode Master
          </h1>
          <p className="text-sm text-gray-500 mt-1">Routing Matrix: Map Pincodes to Active LMDCs</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Pincode
          </Button>
        )}
      </div>

      <Table<PincodeMaster & { id: string }>
        data={pincodes.map(p => ({...p, id: p.pincode}))} // Adapter for Table
        isLoading={loading}
        columns={[
          { header: 'Pincode', accessor: 'pincode', className: 'font-mono font-bold' },
          { header: 'City', accessor: 'city' },
          { header: 'State', accessor: 'state' },
          { header: 'Zone', accessor: 'zone' },
          { header: 'Mapped LMDC', accessor: (row) => getLMDCName(row.linkedLmdcId) },
          { 
            header: 'Serviceable', 
            accessor: (row) => (
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${row.serviceable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {row.serviceable ? 'Yes' : 'No'}
              </span>
            )
          },
        ]}
        actions={canEdit ? (row) => (
           <button onClick={() => openEdit(row)} className="text-brand-600 hover:text-brand-900 font-medium text-sm">Edit / Map</button>
        ) : undefined}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={current.pincode ? `Edit Pincode: ${current.pincode}` : 'Add New Pincode'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <Input 
               label="Pincode" 
               value={current.pincode || ''} 
               onChange={e => setCurrent({...current, pincode: e.target.value})} 
               required 
               disabled={!!pincodes.find(p => p.pincode === current.pincode && p.pincode === current.pincode)} // Disable if editing existing PK logic
             />
             <Input 
               label="City" 
               value={current.city || ''} 
               onChange={e => setCurrent({...current, city: e.target.value})} 
               required 
             />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <Input 
               label="State" 
               value={current.state || ''} 
               onChange={e => setCurrent({...current, state: e.target.value})} 
               required 
             />
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Zone</label>
                <select 
                   className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                   value={current.zone}
                   onChange={e => setCurrent({...current, zone: e.target.value as ZoneType})}
                >
                   {Object.values(ZoneType).map(z => <option key={z} value={z}>{z}</option>)}
                </select>
             </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
             <h4 className="text-sm font-bold text-yellow-900 mb-3">Routing Assignment (Phase E)</h4>
             <div className="w-full mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned LMDC</label>
                <select
                   className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                   value={current.linkedLmdcId || ''}
                   onChange={e => setCurrent({...current, linkedLmdcId: e.target.value, serviceable: !!e.target.value})}
                >
                   <option value="">-- No Assignment (Unserviceable) --</option>
                   {lmdcs.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                   ))}
                </select>
             </div>
             
             <label className="flex items-center space-x-2">
                <input 
                   type="checkbox" 
                   checked={current.serviceable} 
                   onChange={e => setCurrent({...current, serviceable: e.target.checked})}
                   className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-700 font-medium">Mark Serviceable</span>
             </label>
          </div>

          <div className="pt-2">
            <Button type="submit">Save Pincode Mapping</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};