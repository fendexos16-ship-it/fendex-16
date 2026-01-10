
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { cityService } from '../../services/cityService';
import { masterDataService } from '../../services/masterDataService';
import { useAuth } from '../../context/AuthContext';
import { City, CityStatus, UserRole, MMDC } from '../../types';
import { Map, Plus, PlayCircle, PauseCircle, ShieldAlert, Settings, Building2, CheckCircle } from 'lucide-react';

export const CityManager: React.FC = () => {
  const { user } = useAuth();
  const [cities, setCities] = useState<City[]>([]);
  const [mmdcs, setMmdcs] = useState<MMDC[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [configModal, setConfigModal] = useState(false);
  const [activeCity, setActiveCity] = useState<City | null>(null);

  // Forms
  const [newCity, setNewCity] = useState({ name: '', code: '', state: '', region: '' });
  const [opsConfig, setOpsConfig] = useState({ 
     enableFm: false, enableRvp: false, enableCod: false, 
     enableAggregators: false, enableEnterprise: false, 
     primaryMmdcId: '' 
  });

  // Access
  const canManage = user?.role === UserRole.FOUNDER;

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    const [cData, mData] = await Promise.all([
       cityService.getAllCities(),
       masterDataService.getMMDCs()
    ]);
    setCities(cData);
    setMmdcs(mData);
    setLoading(false);
  };

  const handleCreate = async () => {
     if (!newCity.name || !newCity.code) return;
     try {
        await cityService.createCity(user!, newCity);
        setCreateModal(false);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleOpenConfig = (city: City) => {
     setActiveCity(city);
     setOpsConfig({ 
        ...city.opsConfig, 
        primaryMmdcId: city.primaryMmdcId || '' 
     });
     setConfigModal(true);
  };

  const handleSaveConfig = async () => {
     if (!activeCity) return;
     try {
        await cityService.updateConfig(user!, activeCity.id, {
           opsConfig: {
              enableFm: opsConfig.enableFm,
              enableRvp: opsConfig.enableRvp,
              enableCod: opsConfig.enableCod,
              enableAggregators: opsConfig.enableAggregators,
              enableEnterprise: opsConfig.enableEnterprise
           },
           primaryMmdcId: opsConfig.primaryMmdcId
        });
        setConfigModal(false);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleGoLive = async (city: City) => {
     if (!confirm(`ACTIVATE ${city.name} (${city.code})? \n\nThis will enforce strict operational rules.`)) return;
     try {
        await cityService.activateCity(user!, city.id);
        alert("City is now LIVE.");
        loadData();
     } catch(e:any) { 
        alert(e.message); 
     }
  };

  const handlePause = async (city: City) => {
     const reason = prompt("Enter Reason for PAUSING operations:");
     if (!reason) return;
     try {
        await cityService.pauseCity(user!, city.id, reason);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  if (!canManage) return <Layout><div className="p-8">Access Restricted</div></Layout>;

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
         <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
               <Map className="mr-3 h-8 w-8 text-brand-600" /> City Rollout
            </h1>
            <p className="text-sm text-gray-500 mt-1">Manage Expansion & Territories</p>
         </div>
         <Button onClick={() => setCreateModal(true)} className="w-auto">
            <Plus className="h-4 w-4 mr-2" /> Add City
         </Button>
      </div>

      <Table<City>
         data={cities}
         isLoading={loading}
         columns={[
            { header: 'City Code', accessor: 'code', className: 'font-mono font-bold' },
            { header: 'Name', accessor: 'name' },
            { header: 'State', accessor: 'state' },
            { header: 'Primary Hub', accessor: (c) => mmdcs.find(m => m.id === c.primaryMmdcId)?.name || '-' },
            { 
               header: 'Status', 
               accessor: (c) => (
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                     c.status === CityStatus.LIVE ? 'bg-green-100 text-green-800' :
                     c.status === CityStatus.PAUSED ? 'bg-red-100 text-red-800' :
                     'bg-blue-100 text-blue-800'
                  }`}>
                     {c.status}
                  </span>
               ) 
            }
         ]}
         actions={(c) => (
            <div className="flex gap-2 justify-end">
               <button onClick={() => handleOpenConfig(c)} className="text-gray-600 hover:text-blue-600 font-bold text-xs flex items-center border border-gray-300 px-2 py-1 rounded">
                  <Settings className="h-3 w-3 mr-1" /> Config
               </button>
               
               {c.status === CityStatus.PLANNED && (
                  <button onClick={() => handleGoLive(c)} className="text-white bg-green-600 hover:bg-green-700 font-bold text-xs flex items-center px-2 py-1 rounded shadow-sm">
                     <PlayCircle className="h-3 w-3 mr-1" /> Go Live
                  </button>
               )}
               
               {c.status === CityStatus.LIVE && (
                  <button onClick={() => handlePause(c)} className="text-white bg-red-600 hover:bg-red-700 font-bold text-xs flex items-center px-2 py-1 rounded shadow-sm">
                     <PauseCircle className="h-3 w-3 mr-1" /> Pause
                  </button>
               )}
            </div>
         )}
      />

      {/* CREATE MODAL */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Initialize New City">
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <Input label="City Code (Unique)" value={newCity.code} onChange={e => setNewCity({...newCity, code: e.target.value.toUpperCase()})} placeholder="e.g. BLR" required />
               <Input label="City Name" value={newCity.name} onChange={e => setNewCity({...newCity, name: e.target.value})} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <Input label="State" value={newCity.state} onChange={e => setNewCity({...newCity, state: e.target.value})} required />
               <Input label="Region / Zone" value={newCity.region} onChange={e => setNewCity({...newCity, region: e.target.value})} required />
            </div>
            <Button onClick={handleCreate}>Create Record (Planned)</Button>
         </div>
      </Modal>

      {/* CONFIG MODAL */}
      <Modal isOpen={configModal} onClose={() => setConfigModal(false)} title={`Configure: ${activeCity?.name}`}>
         <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded border border-blue-200">
               <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center"><Building2 className="h-4 w-4 mr-2" /> Hub Linkage</h4>
               <select 
                  className="w-full border rounded p-2 text-sm"
                  value={opsConfig.primaryMmdcId}
                  onChange={e => setOpsConfig({...opsConfig, primaryMmdcId: e.target.value})}
               >
                  <option value="">-- Select Primary MMDC --</option>
                  {mmdcs.map(m => <option key={m.id} value={m.id}>{m.name} ({m.city})</option>)}
               </select>
               <p className="text-xs text-blue-700 mt-1">This Hub will handle all inter-city flow for {activeCity?.code}.</p>
            </div>

            <div className="bg-gray-50 p-4 rounded border border-gray-200">
               <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center"><ShieldAlert className="h-4 w-4 mr-2" /> Operational Switches</h4>
               <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                     <input type="checkbox" checked={opsConfig.enableFm} onChange={e => setOpsConfig({...opsConfig, enableFm: e.target.checked})} className="rounded text-brand-600" />
                     <span className="text-sm">Enable First Mile Pickups</span>
                  </label>
                  <label className="flex items-center space-x-2">
                     <input type="checkbox" checked={opsConfig.enableRvp} onChange={e => setOpsConfig({...opsConfig, enableRvp: e.target.checked})} className="rounded text-brand-600" />
                     <span className="text-sm">Enable Reverse Pickups</span>
                  </label>
                  <label className="flex items-center space-x-2">
                     <input type="checkbox" checked={opsConfig.enableCod} onChange={e => setOpsConfig({...opsConfig, enableCod: e.target.checked})} className="rounded text-brand-600" />
                     <span className="text-sm">Enable Cash on Delivery</span>
                  </label>
                  <hr className="border-gray-300 my-2" />
                  <label className="flex items-center space-x-2">
                     <input type="checkbox" checked={opsConfig.enableAggregators} onChange={e => setOpsConfig({...opsConfig, enableAggregators: e.target.checked})} className="rounded text-brand-600" />
                     <span className="text-sm">Allow Aggregator Traffic</span>
                  </label>
               </div>
            </div>

            <Button onClick={handleSaveConfig}>Save Configuration</Button>
         </div>
      </Modal>
    </Layout>
  );
};
