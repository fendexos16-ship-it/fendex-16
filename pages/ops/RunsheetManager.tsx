
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { runsheetService } from '../../services/runsheetService';
import { shipmentService } from '../../services/shipmentService';
import { pickupService } from '../../services/pickupService';
import { masterDataService } from '../../services/masterDataService';
import { codService } from '../../services/codService';
import { useAuth } from '../../context/AuthContext';
import { Runsheet, Shipment, RiderProfile, ShipmentStatus, PickupRequest, PickupStatus, RunsheetType, LmdcShipmentType, RunsheetStatus, PaymentMode, CodState } from '../../types';
import { ClipboardList, Plus, User, Truck, Package, RotateCcw, Lock, AlertTriangle, CheckCircle, Info, Upload, FileSpreadsheet, XCircle, Banknote, ShieldCheck } from 'lucide-react';

export const RunsheetManager: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<RunsheetType>('FWD');
  const [runsheets, setRunsheets] = useState<Runsheet[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Resources
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [activeRiderIds, setActiveRiderIds] = useState<string[]>([]);
  const [shipmentCache, setShipmentCache] = useState<Shipment[]>([]);
  const [codRecords, setCodRecords] = useState<any>({});
  
  // Pending Items for Creation
  const [fwdShipments, setFwdShipments] = useState<Shipment[]>([]);
  const [fmPickups, setFmPickups] = useState<PickupRequest[]>([]);
  const [rvpShipments, setRvpShipments] = useState<Shipment[]>([]);

  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRider, setSelectedRider] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Abandon Modal
  const [showAbandon, setShowAbandon] = useState(false);
  const [abandonRunsheetId, setAbandonRunsheetId] = useState('');
  const [abandonReason, setAbandonReason] = useState('');

  // Import Modal
  const [showImport, setShowImport] = useState(false);
  const [importContent, setImportContent] = useState('');

  // Cash Verify Modal
  const [showCashVerify, setShowCashVerify] = useState(false);
  const [verifyRunsheet, setVerifyRunsheet] = useState<Runsheet | null>(null);
  const [codVerifyData, setCodVerifyData] = useState({ expected: 0, received: 0 });

  const currentLmdcId = user?.linkedEntityId || 'LM1';

  const loadData = async () => {
    setLoading(true);
    const [rsData, sData, pData, rData, codData] = await Promise.all([
      runsheetService.getRunsheets(currentLmdcId),
      shipmentService.getShipments(user!),
      pickupService.getPickups(currentLmdcId),
      masterDataService.getRiders(),
      codService.getAllRecords()
    ]);
    
    setRunsheets(rsData);
    setShipmentCache(sData);
    setCodRecords(codData);

    const localRiders = rData.filter(r => r.linkedLmdcId === currentLmdcId && r.status === 'Active');
    setRiders(localRiders);

    // Determine Active Riders (those with CREATED or IN_PROGRESS runsheets)
    const activeIds = rsData
        .filter(r => r.status === RunsheetStatus.CREATED || r.status === RunsheetStatus.IN_PROGRESS)
        .map(r => r.riderId);
    setActiveRiderIds(activeIds);

    // Filter Pending Work
    setFwdShipments(sData.filter(s => 
       s.linkedLmdcId === currentLmdcId && 
       s.status === ShipmentStatus.INBOUND && 
       s.shipmentType === LmdcShipmentType.DELIVERY
    ));

    setFmPickups(pData.filter(p => p.status === PickupStatus.SCHEDULED));

    setRvpShipments(sData.filter(s => 
       s.linkedLmdcId === currentLmdcId && 
       (s.status === ShipmentStatus.INBOUND || s.status === ShipmentStatus.RVP_SCHEDULED) && 
       s.shipmentType === LmdcShipmentType.REVERSE_PICKUP
    ));
    
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleCreate = async () => {
    if (!selectedRider || selectedItems.length === 0) return alert("Select Rider and Items");
    try {
      await runsheetService.createRunsheet(user!, currentLmdcId, selectedRider, selectedItems, activeTab);
      setShowCreate(false);
      setSelectedRider('');
      setSelectedItems([]);
      loadData();
    } catch(e: any) { alert(e.message); }
  };

  const handleCloseRunsheet = async (id: string) => {
     if (!confirm("Close this Runsheet? Financial reconciliation will be verified.")) return;
     try {
        await runsheetService.closeRunsheet(user!, id);
        loadData();
     } catch(e: any) {
        alert("CLOSURE BLOCKED: " + e.message);
     }
  };

  const handleOpenCashVerify = (runsheet: Runsheet) => {
     // Calculate expected COD from delivered COD shipments
     const deliveredCod = shipmentCache.filter(s => 
        runsheet.shipmentIds.includes(s.id) && 
        s.status === ShipmentStatus.DELIVERED && 
        s.paymentMode === PaymentMode.COD
     );
     const expected = deliveredCod.reduce((sum, s) => sum + (s.codAmount || 0), 0);
     
     setVerifyRunsheet(runsheet);
     setCodVerifyData({ expected, received: 0 }); // Reset received
     setShowCashVerify(true);
  };

  const handleSubmitCashVerification = async () => {
     if (!verifyRunsheet) return;
     if (codVerifyData.received !== codVerifyData.expected) {
        alert(`Exact Amount Required. Expected: ₹${codVerifyData.expected}, Entered: ₹${codVerifyData.received}`);
        return;
     }

     const deliveredCodIds = shipmentCache.filter(s => 
        verifyRunsheet.shipmentIds.includes(s.id) && 
        s.status === ShipmentStatus.DELIVERED && 
        s.paymentMode === PaymentMode.COD
     ).map(s => s.id);

     try {
        await codService.verifyRunsheetCash(user!, verifyRunsheet.id, verifyRunsheet.riderId, deliveredCodIds, codVerifyData.received);
        setShowCashVerify(false);
        loadData(); // Refresh to update status
     } catch(e:any) {
        alert(e.message);
     }
  };

  const handleAbandon = async () => {
     if (!abandonReason) return alert("Reason is required.");
     if (!confirm("Confirm Abandonment? This will revert assignments and flag the rider.")) return;
     try {
        await runsheetService.abandonRunsheet(user!, abandonRunsheetId, abandonReason);
        setShowAbandon(false);
        setAbandonReason('');
        loadData();
     } catch(e: any) {
        alert(e.message);
     }
  };

  const handleDownloadSample = () => {
     const headers = "Runsheet_ID, Rider_ID";
     const blob = new Blob([headers], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = "LMDC_Runsheet_Sample.csv";
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
  };

  const handleImport = () => {
     if (!importContent) return;
     alert("Import Simulation: " + importContent.split('\n').length + " rows processed.");
     setShowImport(false);
     setImportContent('');
  };

  const getRiderName = (id: string) => riders.find(r => r.id === id)?.name || id;

  const filteredRunsheets = runsheets.filter(r => r.type === activeTab);

  // Render List Item for Selection
  const renderItemSelection = () => {
     if (activeTab === 'FWD') {
        if (fwdShipments.length === 0) return <p className="text-sm italic text-gray-400">No pending forward deliveries.</p>;
        return fwdShipments.map(s => (
           <label key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 px-2">
              <div className="flex items-center">
                 <input type="checkbox" checked={selectedItems.includes(s.id)} onChange={e => toggleItem(s.id, e.target.checked)} className="mr-3 text-brand-600 focus:ring-brand-500" />
                 <div><p className="text-sm font-bold font-mono text-gray-900">{s.awb}</p><p className="text-xs text-gray-500">{s.destinationPincode}</p></div>
              </div>
           </label>
        ));
     }
     if (activeTab === 'FM') {
        if (fmPickups.length === 0) return <p className="text-sm italic text-gray-400">No scheduled first mile pickups.</p>;
        return fmPickups.map(p => (
           <label key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 px-2">
              <div className="flex items-center">
                 <input type="checkbox" checked={selectedItems.includes(p.id)} onChange={e => toggleItem(p.id, e.target.checked)} className="mr-3 text-brand-600 focus:ring-brand-500" />
                 <div><p className="text-sm font-bold">#{p.id}</p><p className="text-xs text-gray-500">{p.address} ({p.expectedCount} items)</p></div>
              </div>
           </label>
        ));
     }
     if (activeTab === 'RVP') {
        if (rvpShipments.length === 0) return <p className="text-sm italic text-gray-400">No pending reverse pickups.</p>;
        return rvpShipments.map(s => (
           <label key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 px-2">
              <div className="flex items-center">
                 <input type="checkbox" checked={selectedItems.includes(s.id)} onChange={e => toggleItem(s.id, e.target.checked)} className="mr-3 text-brand-600 focus:ring-brand-500" />
                 <div><p className="text-sm font-bold font-mono">{s.awb}</p><p className="text-xs text-gray-500">{s.destinationPincode} (RVP)</p></div>
              </div>
           </label>
        ));
     }
  };

  const toggleItem = (id: string, checked: boolean) => {
     if(checked) setSelectedItems([...selectedItems, id]);
     else setSelectedItems(selectedItems.filter(i => i !== id));
  };

  // Helper to check COD status for runsheet row
  const getCodActionState = (runsheet: Runsheet) => {
     // Get all delivered COD shipments in this runsheet
     const deliveredCod = shipmentCache.filter(s => 
        runsheet.shipmentIds.includes(s.id) && 
        s.status === ShipmentStatus.DELIVERED && 
        s.paymentMode === PaymentMode.COD
     );
     
     if (deliveredCod.length === 0) return 'NO_COD'; // Safe to close if ops done

     // Check verification status
     const unverified = deliveredCod.filter(s => {
        const rec = codRecords[s.awb];
        return !rec || (rec.state !== CodState.COD_VERIFIED && rec.state !== CodState.COD_DEPOSITED && rec.state !== CodState.COD_SETTLED);
     });

     if (unverified.length > 0) return 'VERIFY_NEEDED';
     return 'VERIFIED';
  };

  return (
    <Layout>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <ClipboardList className="mr-3 h-8 w-8 text-brand-600" /> Runsheet Manager
           </h1>
           <p className="text-sm text-gray-500 mt-1">Assign deliveries and pickups to rider fleet</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => setShowImport(true)} variant="secondary" className="w-auto">
              <Upload className="h-4 w-4 mr-2" /> Import
           </Button>
           <Button onClick={() => { setSelectedItems([]); setShowCreate(true); }} className="w-auto">
              <Plus className="h-4 w-4 mr-2" /> Create {activeTab} Run
           </Button>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setActiveTab('FWD')} className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === 'FWD' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
             <Package className="h-4 w-4 mr-2" /> Forward Deliveries
          </button>
          <button onClick={() => setActiveTab('FM')} className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === 'FM' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
             <Truck className="h-4 w-4 mr-2" /> First Mile
          </button>
          <button onClick={() => setActiveTab('RVP')} className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === 'RVP' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
             <RotateCcw className="h-4 w-4 mr-2" /> Reverse Pickup
          </button>
        </nav>
      </div>

      <Table<Runsheet>
        data={filteredRunsheets}
        isLoading={loading}
        columns={[
           { header: 'Code', accessor: 'runsheetCode', className: 'font-mono font-bold' },
           { header: 'Type', accessor: 'type' },
           { header: 'Rider', accessor: (r) => getRiderName(r.riderId) },
           { header: 'Items', accessor: (r) => r.type === 'FM' ? (r.pickupIds?.length || 0) : r.shipmentIds.length },
           { 
              header: 'Status', 
              accessor: (r) => {
                 const statusColors: Record<string, string> = {
                    [RunsheetStatus.CREATED]: 'bg-blue-100 text-blue-800',
                    [RunsheetStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
                    [RunsheetStatus.COMPLETED]: 'bg-green-100 text-green-800',
                    [RunsheetStatus.CLOSED]: 'bg-gray-200 text-gray-600',
                    [RunsheetStatus.ABANDONED]: 'bg-red-100 text-red-800'
                 };
                 return (
                    <span className={`px-2 py-1 rounded text-xs font-bold ${statusColors[r.status] || 'bg-gray-100'}`}>
                       {r.status === RunsheetStatus.IN_PROGRESS ? 'IN PROGRESS' : r.status}
                    </span>
                 );
              }
           },
           { header: 'Date', accessor: (r) => new Date(r.createdAt).toLocaleDateString() }
        ]}
        actions={(r) => {
           const codState = getCodActionState(r);
           return (
              <div className="flex justify-end gap-2">
                 {r.status === RunsheetStatus.ABANDONED && <span className="text-red-500 text-xs italic">Abandoned</span>}
                 
                 {r.status !== RunsheetStatus.CLOSED && r.status !== RunsheetStatus.ABANDONED && (
                    <>
                       {codState === 'VERIFY_NEEDED' ? (
                          <button onClick={() => handleOpenCashVerify(r)} className="text-white bg-green-600 hover:bg-green-700 font-bold text-xs px-3 py-1 rounded shadow-sm flex items-center">
                             <Banknote className="h-3 w-3 mr-1" /> Verify Cash
                          </button>
                       ) : (
                          <button onClick={() => handleCloseRunsheet(r.id)} className="text-red-600 font-bold text-xs hover:text-red-800 flex items-center border border-red-200 px-2 py-1 rounded">
                             <Lock className="h-3 w-3 mr-1" /> Close
                          </button>
                       )}
                       
                       <button onClick={() => { setAbandonRunsheetId(r.id); setShowAbandon(true); }} className="text-gray-500 font-bold text-xs hover:text-red-600 border border-gray-200 px-2 py-1 rounded">
                          Abandon
                       </button>
                    </>
                 )}
                 {r.status === RunsheetStatus.CLOSED && (
                    <span className="text-gray-400 text-xs italic flex items-center"><Lock className="h-3 w-3 mr-1" /> Locked</span>
                 )}
              </div>
           );
        }}
      />

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={`New ${activeTab} Runsheet`}>
         <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800 flex items-start">
               <Info className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
               <p>Constraint: Riders with an active runsheet cannot be assigned another. Close existing runsheets first.</p>
            </div>

            <div>
               <label className="block text-sm font-medium mb-1">Assign Rider</label>
               <select 
                  className="w-full border rounded p-2 focus:ring-brand-500 focus:border-brand-500" 
                  value={selectedRider} 
                  onChange={e => setSelectedRider(e.target.value)}
               >
                  <option value="">-- Choose Rider --</option>
                  {riders.map(r => {
                     const isActive = activeRiderIds.includes(r.id);
                     return (
                        <option key={r.id} value={r.id} disabled={isActive}>
                           {r.name} {isActive ? '(Active)' : '(Available)'}
                        </option>
                     );
                  })}
               </select>
            </div>

            <div className="bg-gray-50 p-4 rounded border border-gray-200 max-h-60 overflow-y-auto">
               <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Pending Tasks</p>
               {renderItemSelection()}
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
               <span className="text-sm font-bold text-gray-700">Selected: {selectedItems.length}</span>
               <Button onClick={handleCreate} disabled={selectedItems.length === 0 || !selectedRider}>Generate Runsheet</Button>
            </div>
         </div>
      </Modal>

      {/* CASH VERIFY MODAL */}
      <Modal isOpen={showCashVerify} onClose={() => setShowCashVerify(false)} title="Receive Rider Cash">
         <div className="space-y-6">
            <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center">
               <p className="text-xs text-green-800 uppercase font-bold mb-1">Total Expected COD</p>
               <p className="text-4xl font-extrabold text-green-900">₹{codVerifyData.expected}</p>
               <p className="text-xs text-green-700 mt-2">From Delivered Shipments in Runsheet {verifyRunsheet?.runsheetCode}</p>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg text-sm text-yellow-800 flex items-start">
               <ShieldCheck className="h-5 w-5 mr-3 flex-shrink-0 text-yellow-600" />
               <div>
                  <p className="font-bold mb-1">Handover Protocol:</p>
                  <ul className="list-disc ml-4 space-y-1 text-xs">
                     <li>Verify physical cash count from Rider.</li>
                     <li>Amount MUST match expected total exactly.</li>
                     <li>This action logs receipt and locks COD records.</li>
                  </ul>
               </div>
            </div>

            <Input 
               label="Received Amount" 
               type="number" 
               value={codVerifyData.received} 
               onChange={e => setCodVerifyData({...codVerifyData, received: parseFloat(e.target.value)})} 
               autoFocus
               placeholder="Enter Counted Cash"
            />

            <Button onClick={handleSubmitCashVerification} className="h-12 text-lg bg-green-600 hover:bg-green-700">
               Confirm Receipt
            </Button>
         </div>
      </Modal>

      {/* ABANDON MODAL */}
      <Modal isOpen={showAbandon} onClose={() => setShowAbandon(false)} title="Abandon Runsheet">
         <div className="space-y-4">
            <div className="bg-red-50 p-3 rounded text-sm text-red-800 flex items-start">
               <XCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
               <p>
                  <strong>Warning:</strong> Abandoning this runsheet will revert all pending items to "At Station" status.
                  The rider will be flagged in audit logs.
               </p>
            </div>
            <div>
               <label className="block text-sm font-medium mb-1">Reason for Abandonment</label>
               <textarea 
                  className="w-full border rounded p-2 text-sm h-24"
                  placeholder="e.g. Rider emergency, vehicle breakdown..."
                  value={abandonReason}
                  onChange={e => setAbandonReason(e.target.value)}
               />
            </div>
            <div className="flex justify-end gap-2">
               <Button variant="secondary" onClick={() => setShowAbandon(false)}>Cancel</Button>
               <Button onClick={handleAbandon} variant="danger">Confirm Abandon</Button>
            </div>
         </div>
      </Modal>

      {/* IMPORT MODAL */}
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Bulk Import Runsheets">
         <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
               <span className="text-sm font-bold text-gray-700">Template Required</span>
               <Button onClick={handleDownloadSample} variant="secondary" className="w-auto h-8 text-xs">
                  <FileSpreadsheet className="h-3 w-3 mr-2" /> Download Sample
               </Button>
            </div>
            
            <div>
               <label className="block text-sm font-medium mb-1">Paste CSV Data</label>
               <textarea 
                  className="w-full h-32 border rounded p-2 text-sm font-mono"
                  placeholder="Runsheet_ID, Rider_ID..."
                  value={importContent}
                  onChange={e => setImportContent(e.target.value)}
               />
            </div>
            <Button onClick={handleImport} disabled={!importContent}>Process Import</Button>
         </div>
      </Modal>
    </Layout>
  );
};
