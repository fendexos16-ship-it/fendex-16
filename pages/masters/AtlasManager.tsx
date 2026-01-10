
import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { masterDataService } from '../../services/masterDataService';
import { atlasService } from '../../services/atlasService';
import { LastMileDC, AtlasServiceArea, UserRole, AtlasAuditLog } from '../../types';
import { MapPin, Globe, CheckCircle, AlertTriangle, Save, Edit3, Eye, Layers, X, Navigation, Lock, Unlock, Send, ThumbsDown, History, List } from 'lucide-react';

declare const L: any; // Leaflet Global

export const AtlasManager: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'MAP' | 'APPROVALS' | 'LOGS'>('MAP');
  const [lmdcs, setLmdcs] = useState<LastMileDC[]>([]);
  const [selectedLmdcId, setSelectedLmdcId] = useState<string>('');
  
  // Atlas Data
  const [activeArea, setActiveArea] = useState<AtlasServiceArea | undefined>(undefined);
  const [draftArea, setDraftArea] = useState<AtlasServiceArea | undefined>(undefined);
  const [pendingList, setPendingList] = useState<AtlasServiceArea[]>([]);
  const [auditLogs, setAuditLogs] = useState<AtlasAuditLog[]>([]);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [pincodeInput, setPincodeInput] = useState('');
  const [polygonPoints, setPolygonPoints] = useState<any[]>([]); // Array of [lat, lng]
  const [metaInput, setMetaInput] = useState({ name: '', city: '', state: '' });
  
  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Map Refs
  const mapRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const neighborLayerRef = useRef<any>(null);
  const mapContainerId = 'atlas-map-container';

  // Access
  const isFounder = user?.role === UserRole.FOUNDER;
  const canDraw = isFounder; // STRICT: Area Manager is Read-Only

  // --- Initialization ---
  useEffect(() => {
    const loadData = async () => {
      const data = await masterDataService.getLMDCs();
      setLmdcs(data);
      if (data.length > 0) setSelectedLmdcId(data[0].id);
      
      if (isFounder) {
         const pending = await atlasService.getAllPendingApprovals();
         setPendingList(pending);
      }
    };
    loadData();
  }, []);

  // --- Load Service Area on Selection ---
  useEffect(() => {
    if (!selectedLmdcId) return;
    loadServiceArea(selectedLmdcId);
    loadLogs(selectedLmdcId);
  }, [selectedLmdcId]);

  const loadServiceArea = async (lmdcId: string) => {
    const areas = await atlasService.getServiceAreas(lmdcId);
    const active = areas.find(a => a.status === 'ACTIVE' || a.status === 'LOCKED');
    const draft = areas.find(a => a.status === 'DRAFT' || a.status === 'PENDING_APPROVAL');
    
    setActiveArea(active);
    setDraftArea(draft);
    
    // Reset Edit State
    setIsEditing(false);
    
    // Determine what to show: Draft/Pending takes precedence for viewing work-in-progress
    const target = draft || active;
    
    if (target) {
       setPincodeInput(target.pincodes.join(', '));
       setPolygonPoints(target.polygon.map(p => [p.lat, p.lng]));
       setMetaInput({ name: target.name, city: target.city, state: target.state });
    } else {
       setPincodeInput('');
       setPolygonPoints([]);
       setMetaInput({ name: '', city: '', state: '' });
    }
    
    // Update Map View
    updateMap(target);
    loadNeighbors(lmdcId);
  };

  const loadLogs = async (lmdcId: string) => {
     const logs = await atlasService.getAuditLogs(lmdcId);
     setAuditLogs(logs);
  };

  const loadNeighbors = async (excludeLmdcId: string) => {
     // Load all other active polygons to show context
     if (!mapRef.current) return;
     const all = await atlasService.getServiceAreas();
     const neighbors = all.filter(a => (a.status === 'ACTIVE' || a.status === 'LOCKED') && a.lmdcId !== excludeLmdcId);
     
     if (neighborLayerRef.current) mapRef.current.removeLayer(neighborLayerRef.current);
     
     const neighborGroup = L.layerGroup().addTo(mapRef.current);
     neighbors.forEach(n => {
        const pts = n.polygon.map(p => [p.lat, p.lng]);
        L.polygon(pts, { color: '#9ca3af', weight: 1, fillOpacity: 0.1, dashArray: '4,4' }).addTo(neighborGroup);
     });
     neighborLayerRef.current = neighborGroup;
  };

  // --- Map Logic ---
  useEffect(() => {
    // Initialize Map Only Once
    if (!mapRef.current) {
      const map = L.map(mapContainerId).setView([20.5937, 78.9629], 5); // India Center
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      
      mapRef.current = map;

      // Click Handler for Drawing
      map.on('click', (e: any) => {
        if (isEditingRef.current) {
           addPoint(e.latlng.lat, e.latlng.lng);
        }
      });
    }
  }, []);

  // Use Ref to access state inside event listener closure
  const isEditingRef = useRef(isEditing);
  const polygonPointsRef = useRef(polygonPoints);

  useEffect(() => {
    isEditingRef.current = isEditing;
    polygonPointsRef.current = polygonPoints;
    drawPolygonOnMap();
  }, [isEditing, polygonPoints]);

  const addPoint = (lat: number, lng: number) => {
    const newPoints = [...polygonPointsRef.current, [lat, lng]];
    setPolygonPoints(newPoints);
  };

  const drawPolygonOnMap = () => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing layer
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
    }

    // Determine color
    let color = '#3b82f6'; // Blue default
    if (activeArea?.status === 'LOCKED') color = '#374151'; // Grey
    else if (activeArea?.status === 'ACTIVE') color = '#16a34a'; // Green
    
    if (draftArea) {
       if (draftArea.status === 'PENDING_APPROVAL') color = '#ea580c'; // Orange
       else color = '#3b82f6'; // Blue (Draft)
    }
    
    if (isEditing) color = '#2563eb'; // Bright Blue Editing

    if (polygonPoints.length > 0) {
      const poly = L.polygon(polygonPoints, { 
        color, 
        weight: 3, 
        dashArray: isEditing ? '5, 5' : null,
        fillOpacity: 0.2 
      }).addTo(map);
      
      polygonLayerRef.current = poly;
      
      // Auto fit bounds if strictly viewing (not while clicking points)
      if (!isEditing && polygonPoints.length > 1) {
         map.fitBounds(poly.getBounds());
      }
    }
  };

  const updateMap = (target?: AtlasServiceArea) => {
     if (target && target.polygon.length > 0) {
        setPolygonPoints(target.polygon.map(p => [p.lat, p.lng]));
     } else {
        setPolygonPoints([]); // Clear if no area
     }
  };

  // --- Handlers ---

  const handleStartEdit = () => {
    setIsEditing(true);
    // If starting fresh but Active exists, pre-fill from Active
    if (!draftArea && activeArea) {
       setPolygonPoints(activeArea.polygon.map(p => [p.lat, p.lng]));
       setPincodeInput(activeArea.pincodes.join(', '));
       setMetaInput({ name: activeArea.name, city: activeArea.city, state: activeArea.state });
    }
  };

  const handleClearPolygon = () => {
    setPolygonPoints([]);
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    
    const codes = pincodeInput.split(',').map(s => s.trim()).filter(s => s.length === 6 && !isNaN(Number(s)));
    const poly = polygonPoints.map(p => ({ lat: p[0], lng: p[1] }));

    if (codes.length === 0) {
      alert("Error: Atlas must have at least one Pincode.");
      return;
    }
    if (!metaInput.name || !metaInput.city) {
       alert("Error: Name and City are required.");
       return;
    }

    try {
      await atlasService.saveDraft(user, {
        lmdcId: selectedLmdcId,
        polygon: poly,
        pincodes: codes,
        name: metaInput.name,
        city: metaInput.city,
        state: metaInput.state
      });
      loadServiceArea(selectedLmdcId);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSubmit = async () => {
     if (!draftArea) return;
     if (!confirm("Submit Atlas for Founder Approval? The area will be locked until approved.")) return;
     try {
        await atlasService.submitForApproval(user!, draftArea.id);
        alert('Submitted for Approval.');
        loadServiceArea(selectedLmdcId);
     } catch (e: any) { alert(e.message); }
  };

  const handleApprove = async () => {
    if (!draftArea) return;
    // Check overlap override
    const force = confirm(`APPROVE Atlas Change for ${getLMDCName(draftArea.lmdcId)}? \n\nClick OK to check for conflicts.\nClick Cancel to abort.`);
    if (!force) return;

    try {
      await atlasService.approveArea(user!, draftArea.id, false); // Default no force overlap in this UI
      loadServiceArea(selectedLmdcId);
    } catch (e: any) {
      if (e.message.includes('CONFLICT')) {
         if (confirm(`${e.message}\n\nDo you want to FORCE OVERRIDE and assign anyway? This will overwrite previous LMDC assignments.`)) {
            await atlasService.approveArea(user!, draftArea.id, true);
            loadServiceArea(selectedLmdcId);
         }
      } else {
         alert(e.message);
      }
    }
  };

  const handleReject = async () => {
     if (!draftArea || !rejectReason) return;
     try {
        await atlasService.rejectArea(user!, draftArea.id, rejectReason);
        setShowRejectModal(false);
        setRejectReason('');
        loadServiceArea(selectedLmdcId);
     } catch (e: any) { alert(e.message); }
  };

  const handleLockToggle = async () => {
     if (!activeArea) return;
     try {
        if (activeArea.status === 'LOCKED') {
           await atlasService.unlockArea(user!, activeArea.id);
        } else {
           await atlasService.lockArea(user!, activeArea.id);
        }
        loadServiceArea(selectedLmdcId);
     } catch(e:any) { alert(e.message); }
  };

  const getLMDCName = (id: string) => lmdcs.find(l => l.id === id)?.name || id;

  // VIEW HELPERS
  const canEditCurrent = canDraw && (!activeArea || activeArea.status === 'ACTIVE') && (!draftArea || draftArea.status === 'DRAFT');
  const isLocked = activeArea?.status === 'LOCKED';
  const isPending = draftArea?.status === 'PENDING_APPROVAL';

  return (
    <Layout>
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Globe className="mr-3 h-8 w-8 text-brand-600" />
            Atlas Service Areas
          </h1>
          <p className="text-sm text-gray-500 mt-1">Geographic master for routing & SLA control</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg self-start">
           <button 
             onClick={() => setActiveTab('MAP')}
             className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'MAP' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'}`}
           >
             Map Editor
           </button>
           <button 
             onClick={() => setActiveTab('LOGS')}
             className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'LOGS' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'}`}
           >
             Audit Logs
           </button>
           {isFounder && (
             <button 
               onClick={() => setActiveTab('APPROVALS')}
               className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'APPROVALS' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'}`}
             >
               Approvals ({pendingList.length})
             </button>
           )}
        </div>
      </div>

      {activeTab === 'MAP' && (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] min-h-[600px]">
           
           {/* Sidebar Control */}
           <div className="w-full lg:w-1/3 bg-white border border-gray-200 rounded-lg flex flex-col shadow-sm">
              <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select LMDC</label>
                 <select 
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    value={selectedLmdcId}
                    onChange={e => setSelectedLmdcId(e.target.value)}
                 >
                    {lmdcs.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                 </select>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                 
                 {/* Status Display */}
                 <div className="grid grid-cols-2 gap-2">
                    <div className={`p-3 rounded border text-center ${activeArea ? (isLocked ? 'bg-gray-100 border-gray-300' : 'bg-green-50 border-green-200') : 'bg-white border-gray-200'}`}>
                       <p className="text-xs text-gray-500 uppercase font-semibold flex justify-center items-center">
                          {isLocked && <Lock className="h-3 w-3 mr-1" />} Active
                       </p>
                       <p className="font-bold text-lg">{activeArea ? `v${activeArea.version}` : '-'}</p>
                       {isLocked && <span className="text-[10px] bg-gray-600 text-white px-1 rounded">LOCKED</span>}
                    </div>
                    <div className={`p-3 rounded border text-center ${draftArea ? (isPending ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200') : 'bg-white border-gray-200'}`}>
                       <p className="text-xs text-gray-500 uppercase font-semibold">Draft</p>
                       <p className="font-bold text-lg">{draftArea ? `v${draftArea.version}` : '-'}</p>
                       {isPending && <span className="text-[10px] bg-orange-600 text-white px-1 rounded">PENDING</span>}
                    </div>
                 </div>

                 {/* ACTION PANEL */}
                 
                 {/* 1. FOUNDER LOCK CONTROLS */}
                 {isFounder && activeArea && !draftArea && (
                    <div className="border-t pt-4">
                       <Button onClick={handleLockToggle} variant="secondary" className="w-full text-xs">
                          {isLocked ? <><Unlock className="h-3 w-3 mr-2" /> Unlock Area</> : <><Lock className="h-3 w-3 mr-2" /> Lock Area</>}
                       </Button>
                    </div>
                 )}

                 {/* 2. EDITING UI */}
                 {canEditCurrent && !isLocked && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm mt-4">
                       <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-gray-900 flex items-center">
                             <Edit3 className="h-4 w-4 mr-2 text-brand-600" /> Map Editor
                          </h3>
                          {isEditing ? (
                             <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold animate-pulse">DRAWING</span>
                          ) : (
                             <Button onClick={handleStartEdit} variant="secondary" className="w-auto h-8 text-xs">
                                {draftArea ? 'Edit Draft' : 'Create New Draft'}
                             </Button>
                          )}
                       </div>

                       {isEditing && (
                          <div className="space-y-4">
                             <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Zone Name</label>
                                <input 
                                   className="w-full border border-gray-300 rounded p-2 text-sm"
                                   value={metaInput.name}
                                   onChange={e => setMetaInput({...metaInput, name: e.target.value})}
                                   placeholder="e.g. North Zone A"
                                />
                             </div>
                             <div className="grid grid-cols-2 gap-2">
                                <div>
                                   <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                                   <input className="w-full border border-gray-300 rounded p-2 text-sm" value={metaInput.city} onChange={e => setMetaInput({...metaInput, city: e.target.value})} />
                                </div>
                                <div>
                                   <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                                   <input className="w-full border border-gray-300 rounded p-2 text-sm" value={metaInput.state} onChange={e => setMetaInput({...metaInput, state: e.target.value})} />
                                </div>
                             </div>

                             <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Serviceable Pincodes (Comma Separated)</label>
                                <textarea 
                                   className="w-full border border-gray-300 rounded p-2 text-xs font-mono h-24 focus:ring-brand-500 focus:border-brand-500"
                                   value={pincodeInput}
                                   onChange={e => setPincodeInput(e.target.value)}
                                   placeholder="110001, 110002..."
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Manual Entry (Method 2). Ensure all pincodes inside polygon are listed.</p>
                             </div>
                             
                             <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                <label className="block text-xs font-medium text-gray-700 mb-2">Polygon Geofence</label>
                                <div className="flex justify-between items-center">
                                   <div className="text-xs text-gray-600">
                                      <span className="font-bold">{polygonPoints.length}</span> points plotted
                                   </div>
                                   <Button onClick={handleClearPolygon} variant="secondary" className="text-xs h-7 w-auto px-2">
                                      <X className="h-3 w-3 mr-1" /> Clear
                                   </Button>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2 flex items-center">
                                   <Navigation className="h-3 w-3 mr-1" /> Click map to draw points.
                                </p>
                             </div>

                             <div className="pt-2 flex gap-2">
                                <Button onClick={() => setIsEditing(false)} variant="secondary">Cancel</Button>
                                <Button onClick={handleSaveDraft}><Save className="h-4 w-4 mr-2" /> Save Draft</Button>
                             </div>
                          </div>
                       )}
                    </div>
                 )}

                 {/* 3. SUBMIT / APPROVE UI */}
                 {draftArea && !isEditing && (
                    <div className="mt-4 space-y-3">
                       {/* Area Manager Submit */}
                       {draftArea.status === 'DRAFT' && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                             <p className="text-xs text-blue-800 mb-2">Draft saved. Review map and submit for approval.</p>
                             <Button onClick={handleSubmit} className="w-full"><Send className="h-4 w-4 mr-2" /> Submit for Approval</Button>
                          </div>
                       )}

                       {/* Founder Approve */}
                       {isFounder && draftArea.status === 'PENDING_APPROVAL' && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 shadow-sm">
                             <h3 className="font-bold text-orange-900 mb-2 flex items-center">
                                <AlertTriangle className="h-4 w-4 mr-2" /> Approval Required
                             </h3>
                             <p className="text-xs text-orange-800 mb-3">
                                Review new coverage area v{draftArea.version}.
                             </p>
                             <div className="flex gap-2">
                                <Button onClick={() => setShowRejectModal(true)} variant="secondary" className="text-red-600 border-red-200 hover:bg-red-50">
                                   Reject
                                </Button>
                                <Button onClick={handleApprove} className="bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200">
                                   Approve & Activate
                                </Button>
                             </div>
                          </div>
                       )}
                       
                       {/* Pending State Message */}
                       {!isFounder && draftArea.status === 'PENDING_APPROVAL' && (
                          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-center">
                             <ClockIcon />
                             <span className="text-sm font-bold text-yellow-800">Waiting for Founder Approval</span>
                          </div>
                       )}
                    </div>
                 )}

              </div>
           </div>

           {/* Map Container */}
           <div className="flex-1 bg-white rounded-lg border border-gray-300 relative overflow-hidden shadow-sm">
              <div id={mapContainerId} className="w-full h-full z-0 outline-none"></div>
              
              {/* Map Legend */}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-gray-200 z-[1000] text-xs">
                 <h4 className="font-bold mb-2 text-gray-800 uppercase tracking-wider">Legend</h4>
                 <div className="flex items-center mb-1"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span> Active</div>
                 <div className="flex items-center mb-1"><span className="w-3 h-3 bg-gray-600 rounded-full mr-2"></span> Locked</div>
                 <div className="flex items-center mb-1"><span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span> Pending</div>
                 <div className="flex items-center mb-1"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span> Draft</div>
                 <div className="flex items-center"><span className="w-3 h-3 border border-gray-400 border-dashed rounded-full mr-2"></span> Neighbors</div>
              </div>
           </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'LOGS' && (
         <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
               <h3 className="font-bold text-gray-800 flex items-center">
                  <History className="h-4 w-4 mr-2" /> Audit Trail for {getLMDCName(selectedLmdcId)}
               </h3>
            </div>
            <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                     <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                     </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                     {auditLogs.length === 0 ? (
                        <tr><td colSpan={4} className="p-6 text-center text-gray-500">No logs found.</td></tr>
                     ) : (
                        auditLogs.map((log) => (
                           <tr key={log.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800">{log.action}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-600">{log.role}</td>
                              <td className="px-6 py-4 text-gray-800">{log.details}</td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      )}

      {/* REJECT MODAL */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Atlas Change">
         <div className="space-y-4">
            <textarea 
               className="w-full border border-gray-300 rounded p-2 text-sm h-24"
               placeholder="Reason for rejection..."
               value={rejectReason}
               onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
               <Button onClick={() => setShowRejectModal(false)} variant="secondary">Cancel</Button>
               <Button onClick={handleReject} variant="danger">Confirm Reject</Button>
            </div>
         </div>
      </Modal>

      {/* APPROVAL LIST TAB */}
      {activeTab === 'APPROVALS' && isFounder && (
         <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
               <h3 className="font-bold text-gray-800">Pending Approvals</h3>
            </div>
            {pendingList.length === 0 ? (
               <div className="p-8 text-center text-gray-500">No pending approvals.</div>
            ) : (
               <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                     <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LMDC</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pincodes</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                     </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                     {pendingList.map(item => (
                        <tr key={item.id}>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {getLMDCName(item.lmdcId)}
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">v{item.version}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.name}</td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.pincodes.length} Codes</td>
                           <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button 
                                 onClick={() => { setSelectedLmdcId(item.lmdcId); setActiveTab('MAP'); }}
                                 className="text-brand-600 hover:text-brand-900"
                              >
                                 Review on Map
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            )}
         </div>
      )}
    </Layout>
  );
};

const ClockIcon = () => (
   <svg className="h-5 w-5 mx-auto mb-1 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
   </svg>
);
