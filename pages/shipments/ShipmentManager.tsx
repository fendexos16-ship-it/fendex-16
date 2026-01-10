
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { shipmentService } from '../../services/shipmentService';
import { masterDataService } from '../../services/masterDataService';
import { pincodeService } from '../../services/pincodeService';
import { clientService } from '../../services/clientService';
import { complianceService } from '../../services/complianceService'; // Added for Audit
import { 
  Shipment, 
  ShipmentStatus, 
  UserRole, 
  LmdcShipmentType, 
  GeoType, 
  DistributionCenter, 
  LastMileDC,
  RiderProfile,
  PaymentMode,
  Client
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus, Upload, Package, Truck, AlertCircle, FileText, IndianRupee, MapPin, Printer, Filter, X, FileSpreadsheet } from 'lucide-react';

export const ShipmentManager: React.FC = () => {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Master Data
  const [dcs, setDcs] = useState<DistributionCenter[]>([]);
  const [lmdcs, setLmdcs] = useState<LastMileDC[]>([]);
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  // Forms
  const [newShipment, setNewShipment] = useState<Partial<Shipment>>({});
  const [csvContent, setCsvContent] = useState('');
  const [uploadStats, setUploadStats] = useState<{success: number, failed: number, errors: string[]} | null>(null);
  
  // Auto-Routing Check
  const [routingPreview, setRoutingPreview] = useState<string | null>(null);

  // Status Update State
  const [statusUpdate, setStatusUpdate] = useState<{status: ShipmentStatus, riderId?: string, codCollected?: number, transactionId?: string}>({
    status: ShipmentStatus.INBOUND
  });

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState({ start: '', end: '' });

  // PERMISSION CHECKS
  const isFounder = user?.role === UserRole.FOUNDER;
  const isClient = user?.role === UserRole.CLIENT;
  
  // Async check for client create permission
  const [clientCanCreate, setClientCanCreate] = useState(false);

  useEffect(() => {
     const check = async () => {
        if (isClient && user.linkedEntityId) {
           const allowed = await clientService.checkPermission(user.linkedEntityId, 'canCreateShipment');
           setClientCanCreate(allowed);
        } else if (isFounder || user?.role === UserRole.LMDC_MANAGER || user?.role === UserRole.MMDC_MANAGER) {
           setClientCanCreate(true); // Internal ops can always create
        }
     };
     check();
  }, [user]);

  const canEdit = clientCanCreate; // Controls Create Button
  const canUpdateStatus = user && (user.role === UserRole.FOUNDER || user.role === UserRole.LMDC_MANAGER || user.role === UserRole.RIDER);
  const canPrintLabel = user && (user.role === UserRole.FOUNDER || user.role === UserRole.MMDC_MANAGER || user.role === UserRole.LMDC_MANAGER);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [shpData, dcData, lmdcData, riderData, clientData] = await Promise.all([
      shipmentService.getShipments(user),
      masterDataService.getDCs(),
      masterDataService.getLMDCs(),
      masterDataService.getRiders(),
      (isFounder || isClient) ? clientService.getClients() : Promise.resolve([])
    ]);
    setShipments(shpData);
    setDcs(dcData);
    setLmdcs(lmdcData);
    setRiders(riderData);
    setClients(clientData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Filtering Logic
  useEffect(() => {
    let res = shipments;

    // Status Filter
    if (filterStatus !== 'ALL') {
      res = res.filter(s => s.status === filterStatus);
    }

    // Start Date Filter
    if (filterDate.start) {
      res = res.filter(s => s.createdAt >= filterDate.start);
    }

    // End Date Filter (Inclusive of the day)
    if (filterDate.end) {
      res = res.filter(s => s.createdAt.split('T')[0] <= filterDate.end);
    }

    setFilteredShipments(res);
  }, [shipments, filterStatus, filterDate]);

  // Check Pincode Routing
  useEffect(() => {
    const checkRouting = async () => {
      if (newShipment.destinationPincode && newShipment.destinationPincode.length === 6) {
        try {
          const lmdc = await pincodeService.findLmdcForRouting(newShipment.destinationPincode);
          setRoutingPreview(`Routed to: ${lmdc.name} (${lmdc.code})`);
        } catch (e: any) {
          setRoutingPreview(`Routing Error: ${e.message}`);
        }
      } else {
        setRoutingPreview(null);
      }
    };
    const timer = setTimeout(checkRouting, 500);
    return () => clearTimeout(timer);
  }, [newShipment.destinationPincode]);

  // --- Actions ---

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShipment.awb || !newShipment.destinationPincode) return;
    
    // Inject Client ID for logged-in Client
    if (isClient) {
       newShipment.clientId = user.linkedEntityId;
    }

    try {
      await shipmentService.createShipment(newShipment as any, user!);
      setShowCreate(false);
      setNewShipment({});
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDownloadSample = () => {
     const headers = "AWB, Type, DC_ID, DestinationPincode, GeoType, ClientID";
     const blob = new Blob([headers], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = "Shipment_Import_Sample.csv";
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
  };

  const handleUpload = async () => {
    if (!csvContent) return;
    try {
      const result = await shipmentService.bulkCreateShipments(csvContent);
      setUploadStats(result);
      if (result.success > 0) loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;
    try {
      await shipmentService.updateStatus(
        selectedShipment.id, 
        statusUpdate.status, 
        user!.id,
        statusUpdate.codCollected,
        statusUpdate.transactionId
      );
      setShowStatus(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePrintLabel = async (shipment: Shipment) => {
    if (!canPrintLabel || !user) return;
    // Simulate generation
    const confirmed = confirm(`Generate & Print Label for ${shipment.awb}?`);
    if (confirmed) {
       await complianceService.logEvent(
          'EXPORT',
          user,
          `Printed Label for ${shipment.awb}`,
          { awb: shipment.awb, dest: shipment.destinationPincode }
       );
       alert(`Label Sent to Printer: ${shipment.awb}.pdf\n\n(Logged in Audit Trail)`);
    }
  };

  const resetFilters = () => {
    setFilterStatus('ALL');
    setFilterDate({ start: '', end: '' });
  };

  // --- Helpers ---
  const getDCName = (id: string) => dcs.find(d => d.id === id)?.name || id;
  const getLMDCName = (id: string) => lmdcs.find(l => l.id === id)?.name || id;
  const getRiderName = (id?: string) => {
    if (!id) return '-';
    return riders.find(r => r.id === id)?.name || id;
  };
  const getClientName = (id?: string) => {
     if (!id) return '-';
     return clients.find(c => c.id === id)?.name || id;
  }

  // Determine available next statuses based on current
  const getNextStatuses = (current: ShipmentStatus): ShipmentStatus[] => {
    switch(current) {
      case ShipmentStatus.INBOUND: return [ShipmentStatus.ASSIGNED];
      case ShipmentStatus.ASSIGNED: return [ShipmentStatus.DELIVERED, ShipmentStatus.UNDELIVERED];
      case ShipmentStatus.UNDELIVERED: return [ShipmentStatus.RTO];
      // RVP Flow
      case ShipmentStatus.RVP_SCHEDULED: return [ShipmentStatus.ASSIGNED];
      case ShipmentStatus.RVP_PICKED: return [ShipmentStatus.RVP_QC_FAILED]; // Or Inbound at Hub
      default: return [];
    }
  };

  const availableStatuses = selectedShipment ? getNextStatuses(selectedShipment.status) : [];

  return (
    <Layout>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Inbound, Outbound and Returns</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
               <Button onClick={() => { setUploadStats(null); setCsvContent(''); setShowUpload(true); }} variant="secondary" className="w-auto">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button onClick={() => { setNewShipment({ status: ShipmentStatus.INBOUND, paymentMode: PaymentMode.PREPAID }); setShowCreate(true); }} className="w-auto">
                <Plus className="h-4 w-4 mr-2" />
                New Shipment
              </Button>
            </>
          )}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center text-gray-500 font-medium text-sm">
          <Filter className="h-4 w-4 mr-2" /> Filter
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 w-full">
          <div>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="ALL">All Statuses</option>
              {Object.values(ShipmentStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <input 
              type="date" 
              value={filterDate.start}
              onChange={(e) => setFilterDate({...filterDate, start: e.target.value})}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="Start Date"
            />
          </div>
          <div>
            <input 
              type="date" 
              value={filterDate.end}
              onChange={(e) => setFilterDate({...filterDate, end: e.target.value})}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500"
              placeholder="End Date"
            />
          </div>
          <div className="flex items-center">
            {(filterStatus !== 'ALL' || filterDate.start || filterDate.end) && (
              <button 
                onClick={resetFilters} 
                className="text-sm text-red-600 hover:text-red-800 flex items-center"
              >
                <X className="h-4 w-4 mr-1" /> Clear Filters
              </button>
            )}
          </div>
        </div>
        
        <div className="text-right text-xs text-gray-500 whitespace-nowrap">
          Showing {filteredShipments.length} of {shipments.length}
        </div>
      </div>

      <Table<Shipment>
        data={filteredShipments}
        isLoading={loading}
        columns={[
          { header: 'AWB', accessor: 'awb', className: 'font-mono' },
          ...(isFounder ? [{ header: 'Client', accessor: (s: Shipment) => getClientName(s.clientId) }] : []),
          { header: 'Pincode', accessor: 'destinationPincode', className: 'font-mono' },
          { header: 'Type', accessor: 'shipmentType' },
          // Hide Internal LMDC info from Clients unless authorized (here assumed hidden by default for cleaner portal view)
          ...(!isClient ? [{ header: 'LMDC', accessor: (s: Shipment) => getLMDCName(s.linkedLmdcId) }] : []),
          { 
            header: 'Pay Mode', 
            accessor: (s) => (
              <span className={`text-xs px-2 py-0.5 rounded border ${
                s.paymentMode === PaymentMode.COD ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
                {s.paymentMode || PaymentMode.PREPAID}
              </span>
            )
          },
          { 
            header: 'COD Amount', 
            accessor: (s) => s.paymentMode === PaymentMode.COD ? `₹${s.codAmount}` : '-',
            className: 'text-right font-mono'
          },
          ...(!isClient ? [{ header: 'Rider', accessor: (s: Shipment) => getRiderName(s.assignedRiderId) }] : []),
          { header: 'Updated', accessor: (s) => new Date(s.updatedAt).toLocaleDateString() },
          { header: 'Txn ID', accessor: (s) => s.transactionId || '-', className: 'font-mono text-xs text-gray-500' },
          { 
            header: 'Status', 
            accessor: (row) => {
              const colors: Record<string, string> = {
                [ShipmentStatus.INBOUND]: 'bg-blue-100 text-blue-800',
                [ShipmentStatus.ASSIGNED]: 'bg-yellow-100 text-yellow-800',
                [ShipmentStatus.DELIVERED]: 'bg-green-100 text-green-800',
                [ShipmentStatus.UNDELIVERED]: 'bg-red-100 text-red-800',
                [ShipmentStatus.RTO]: 'bg-gray-100 text-gray-800',
                [ShipmentStatus.RVP_PICKED]: 'bg-purple-100 text-purple-800'
              };
              return (
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colors[row.status] || 'bg-gray-100'}`}>
                  {row.status}
                </span>
              );
            }
          },
        ]}
        actions={(row) => (
          <div className="flex items-center gap-2 justify-end">
             {canPrintLabel && (
                <button 
                   onClick={() => handlePrintLabel(row)} 
                   className="text-gray-500 hover:text-gray-900" 
                   title="Print Label"
                >
                   <Printer className="h-4 w-4" />
                </button>
             )}
             {canUpdateStatus && getNextStatuses(row.status).length > 0 && (
                <button 
                  className="text-brand-600 hover:text-brand-800 text-sm font-medium"
                  onClick={() => {
                    setSelectedShipment(row);
                    const next = getNextStatuses(row.status)[0];
                    if (next) {
                      setStatusUpdate({ 
                        status: next, 
                        codCollected: row.paymentMode === PaymentMode.COD ? row.codAmount : 0,
                        transactionId: row.transactionId || ''
                      });
                      setShowStatus(true);
                    }
                  }}
                >
                  Update
                </button>
             )}
          </div>
        )}
      />

      {/* CREATE SHIPMENT MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Shipment">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input 
            label="AWB Number" 
            value={newShipment.awb || ''} 
            onChange={e => setNewShipment({...newShipment, awb: e.target.value})} 
            placeholder="e.g. FDX-99887766"
            required
          />
          
          {/* Client Selection for Admin/Founder */}
          {isFounder && (
             <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Client</label>
                <select
                   className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                   value={newShipment.clientId || ''}
                   onChange={e => setNewShipment({...newShipment, clientId: e.target.value})}
                >
                   <option value="">-- Select Client (Optional) --</option>
                   {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             </div>
          )}

          <div className="grid grid-cols-2 gap-4">
             <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                <select 
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                  value={newShipment.shipmentType || ''}
                  onChange={e => setNewShipment({...newShipment, shipmentType: e.target.value as LmdcShipmentType})}
                  required
                >
                  <option value="">Select Type</option>
                  {Object.values(LmdcShipmentType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
             </div>
             <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Geography</label>
                <select 
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                  value={newShipment.geoType || ''}
                  onChange={e => setNewShipment({...newShipment, geoType: e.target.value as GeoType})}
                  required
                >
                  <option value="">Select Geo</option>
                  {Object.values(GeoType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
             </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
             <div className="grid grid-cols-2 gap-4">
               <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Mode</label>
                  <select 
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                    value={newShipment.paymentMode || PaymentMode.PREPAID}
                    onChange={e => {
                       const mode = e.target.value as PaymentMode;
                       setNewShipment({...newShipment, paymentMode: mode, codAmount: mode === PaymentMode.PREPAID ? 0 : newShipment.codAmount});
                    }}
                    required
                  >
                    {Object.values(PaymentMode).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
               </div>
               
               {newShipment.paymentMode === PaymentMode.COD && (
                 <div className="w-full">
                    <Input 
                      label="COD Amount (₹)" 
                      type="number" 
                      min="1"
                      value={newShipment.codAmount || ''} 
                      onChange={e => setNewShipment({...newShipment, codAmount: parseFloat(e.target.value)})} 
                      required
                      className="mb-0"
                    />
                 </div>
               )}
             </div>
          </div>

          {/* HIDE DC SELECTION FROM CLIENTS. SYSTEM AUTO-ROUTES. */}
          {!isClient && (
             <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Origin DC</label>
                <select 
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                  value={newShipment.linkedDcId || ''}
                  onChange={e => setNewShipment({...newShipment, linkedDcId: e.target.value})}
                  required
                >
                  <option value="">Select DC</option>
                  {dcs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
             </div>
          )}

           <div className="w-full bg-blue-50 p-4 rounded border border-blue-200">
              <div className="flex justify-between items-start">
                 <div className="w-full">
                    <Input 
                        label="Destination Pincode" 
                        value={newShipment.destinationPincode || ''} 
                        onChange={e => setNewShipment({...newShipment, destinationPincode: e.target.value})} 
                        required
                        placeholder="e.g. 110001"
                        maxLength={6}
                        className="mb-1"
                    />
                 </div>
                 <div className="mt-8 ml-3 text-brand-600">
                    <MapPin className="h-6 w-6" />
                 </div>
              </div>
              <p className={`text-xs font-bold mt-1 ${routingPreview?.includes('Error') ? 'text-red-600' : 'text-green-700'}`}>
                 {routingPreview || 'Enter valid 6-digit pincode to auto-route.'}
              </p>
           </div>

           <div className="pt-4">
             <Button type="submit" disabled={!routingPreview || routingPreview.includes('Error')}>Create Shipment</Button>
           </div>
        </form>
      </Modal>

      {/* CSV UPLOAD MODAL */}
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Bulk Upload Shipments">
        <div className="space-y-4">
           {!uploadStats ? (
             <>
               <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200 mb-2">
                  <span className="text-sm font-bold text-gray-700">Template Required</span>
                  <Button onClick={handleDownloadSample} variant="secondary" className="w-auto h-8 text-xs">
                     <FileSpreadsheet className="h-3 w-3 mr-2" /> Download Sample
                  </Button>
               </div>

               <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-sm text-blue-800">
                  <p className="font-bold mb-1">CSV Format (No Header Row if pasting data):</p>
                  <code className="block bg-white p-2 rounded border border-blue-200">AWB, Type, DC_ID, DestinationPincode, GeoType, ClientID (Optional)</code>
                  <p className="mt-2 text-xs italic">Note: Routing is automatic based on Pincode.</p>
               </div>
               <textarea
                  className="w-full h-40 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-brand-500 focus:border-brand-500"
                  placeholder={`FDX-001, Delivery, 1, 110001, City, CL-123\nFDX-002, First Mile, 1, 400050, Rural`}
                  value={csvContent}
                  onChange={e => setCsvContent(e.target.value)}
               />
               <Button onClick={handleUpload}>Process Upload</Button>
             </>
           ) : (
             <div className="text-center">
                {uploadStats.failed === 0 ? (
                   <div className="text-green-600 mb-4">
                      <Package className="h-12 w-12 mx-auto mb-2" />
                      <h3 className="text-lg font-bold">Upload Successful</h3>
                      <p>{uploadStats.success} shipments created.</p>
                   </div>
                ) : (
                   <div className="text-left">
                      <div className="flex items-center text-red-600 mb-2">
                         <AlertCircle className="h-5 w-5 mr-2" />
                         <span className="font-bold">{uploadStats.failed} Failed, {uploadStats.success} Created</span>
                      </div>
                      <div className="bg-red-50 p-3 rounded max-h-40 overflow-y-auto text-xs text-red-700 font-mono">
                         {uploadStats.errors.map((e, i) => <div key={i}>{e}</div>)}
                      </div>
                   </div>
                )}
                <Button onClick={() => setShowUpload(false)} variant="secondary" className="mt-4">Close</Button>
             </div>
           )}
        </div>
      </Modal>

      {/* STATUS UPDATE MODAL */}
      <Modal isOpen={showStatus} onClose={() => setShowStatus(false)} title={`Update Status: ${selectedShipment?.awb}`}>
        <form onSubmit={handleStatusUpdate} className="space-y-4">
           <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Status</label>
              <select
                 className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                 value={statusUpdate.status}
                 onChange={e => setStatusUpdate({...statusUpdate, status: e.target.value as ShipmentStatus})}
              >
                 {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
           </div>
           
           {/* Show Rider selection ONLY if transitioning to ASSIGNED */}
           {statusUpdate.status === ShipmentStatus.ASSIGNED && (
             <div className="w-full">
               <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Rider</label>
               <select
                 className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm"
                 value={statusUpdate.riderId || ''}
                 onChange={e => setStatusUpdate({...statusUpdate, riderId: e.target.value})}
                 required
               >
                 <option value="">Select Rider</option>
                 {/* In real app, filter riders by the shipment's LMDC */}
                 {riders.filter(r => r.linkedLmdcId === selectedShipment?.linkedLmdcId).map(r => (
                   <option key={r.id} value={r.id}>{r.name} ({r.phone})</option>
                 ))}
               </select>
             </div>
           )}

           {/* Show COD Input ONLY if transitioning to DELIVERED and PaymentMode is COD */}
           {statusUpdate.status === ShipmentStatus.DELIVERED && selectedShipment?.paymentMode === PaymentMode.COD && (
             <div className="w-full bg-orange-50 p-4 rounded border border-orange-200">
               <div className="flex items-start mb-3">
                  <IndianRupee className="h-5 w-5 text-orange-600 mr-2 mt-0.5" />
                  <div>
                     <h4 className="text-sm font-bold text-orange-900">COD Collection</h4>
                     <p className="text-xs text-orange-700">Please confirm the cash amount collected from customer.</p>
                  </div>
               </div>
               <Input 
                  label="Collected Amount" 
                  type="number"
                  min="0"
                  value={statusUpdate.codCollected}
                  onChange={e => setStatusUpdate({...statusUpdate, codCollected: parseFloat(e.target.value)})}
                  required
                  className="mb-0 bg-white"
               />
             </div>
           )}

           {/* Show Transaction ID for RVP */}
           {selectedShipment?.shipmentType === LmdcShipmentType.REVERSE_PICKUP && (
             <Input 
                label="Transaction / Refund Reference" 
                value={statusUpdate.transactionId || ''}
                onChange={e => setStatusUpdate({...statusUpdate, transactionId: e.target.value})}
                placeholder="Optional Ref ID"
             />
           )}

           <div className="pt-4">
              <Button type="submit">Update Status</Button>
           </div>
        </form>
      </Modal>
    </Layout>
  );
};
