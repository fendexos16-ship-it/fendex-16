
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { clientService } from '../../services/clientService';
import { authService } from '../../services/authService';
import { Client, ClientType, ClientStatus, UserRole, LabelAuthority, BillingMode, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus, Users, Truck, Key, Radio, Webhook, RefreshCw, ToggleLeft, ToggleRight, ShieldCheck, Zap, Printer, Lock, Wallet, IndianRupee, AlertTriangle, Info, Globe, UserPlus, CheckCircle, FileText, Play, Pause, ChevronRight } from 'lucide-react';

export const ClientManager: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'CLIENTS' | 'COURIERS'>('CLIENTS');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // -- Modals --
  const [createModalOpen, setCreateModalOpen] = useState(false); // Step 1: Draft Create
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false); // Step 2: Full Intake
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [portalModalOpen, setPortalModalOpen] = useState(false);

  // -- Forms & State --
  const [currentClient, setCurrentClient] = useState<Partial<Client>>({});
  const [addFundsData, setAddFundsData] = useState({ amount: 0, ref: '' });
  const [newPortalUser, setNewPortalUser] = useState({ name: '', email: '', password: '' });
  const [portalCredentials, setPortalCredentials] = useState<{username: string, tempPass: string} | null>(null);
  
  // Intake View Tab
  const [intakeTab, setIntakeTab] = useState<'PROFILE' | 'COMMERCIALS' | 'TECHNICAL' | 'DOCS' | 'LIFECYCLE'>('PROFILE');

  const canEdit = user?.role === UserRole.FOUNDER;

  const loadData = async () => {
    setLoading(true);
    const cData = await clientService.getClients();
    setClients(cData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Handlers ---
  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentClient.name || !currentClient.type) return;
    
    try {
      // Initial defaults for DRAFT
      const data = {
         ...currentClient,
         status: ClientStatus.DRAFT,
         labelAuthority: LabelAuthority.FENDEX_ONLY,
         billingMode: BillingMode.PREPAID, // Default safe mode
         defaultEnv: 'TEST'
      };
      
      const newClient = await clientService.saveClient(user, data as Client);
      setCreateModalOpen(false);
      loadData();
      
      // Auto-open onboarding
      setCurrentClient(newClient);
      setOnboardingModalOpen(true);
      setIntakeTab('PROFILE');
    } catch(e:any) { alert(e.message); }
  };

  const handleUpdateChecklist = async (key: string, val: boolean) => {
     if(!currentClient.id || !user) return;
     try {
        await clientService.updateChecklist(user, currentClient.id, { [key]: val });
        // Refresh local state
        const updated = await clientService.getClientById(currentClient.id);
        setCurrentClient(updated!);
        loadData(); // Sync list
     } catch(e:any) { alert(e.message); }
  };

  const handleUpdateReadiness = async (key: string, val: boolean) => {
     if(!currentClient.id || !user) return;
     try {
        await clientService.updateReadiness(user, currentClient.id, { [key]: val });
        const updated = await clientService.getClientById(currentClient.id);
        setCurrentClient(updated!);
     } catch(e:any) { alert(e.message); }
  };

  const handleDocSign = async (docCode: string) => {
     if(!currentClient.id || !user) return;
     if(!confirm(`Confirm ${docCode} is signed and stored?`)) return;
     try {
        await clientService.recordDocumentSign(user, currentClient.id, docCode);
        const updated = await clientService.getClientById(currentClient.id);
        setCurrentClient(updated!);
     } catch(e:any) { alert(e.message); }
  };

  // Lifecycle Transitions
  const handleSubmitReview = async () => {
     if(!currentClient.id || !user) return;
     try {
        await clientService.submitForReview(user, currentClient.id);
        const updated = await clientService.getClientById(currentClient.id);
        setCurrentClient(updated!);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleStartTesting = async () => {
     if(!currentClient.id || !user) return;
     try {
        await clientService.startTesting(user, currentClient.id);
        const updated = await clientService.getClientById(currentClient.id);
        setCurrentClient(updated!);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleGoLive = async () => {
     if(!currentClient.id || !user) return;
     if(!confirm("ACTIVATE LIVE MODE? This will enable real shipments and billing.")) return;
     try {
        await clientService.activateLive(user, currentClient.id);
        const updated = await clientService.getClientById(currentClient.id);
        setCurrentClient(updated!);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handlePause = async () => {
     if(!currentClient.id || !user) return;
     const reason = prompt("Enter reason for pausing:");
     if(!reason) return;
     try {
        await clientService.pauseClient(user, currentClient.id, reason);
        const updated = await clientService.getClientById(currentClient.id);
        setCurrentClient(updated!);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  // Existing helpers
  const handleAddFunds = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!currentClient.id || !user) return;
     try {
        await clientService.addFunds(user, currentClient.id, addFundsData.amount, addFundsData.ref);
        alert('Funds Added Successfully');
        setWalletModalOpen(false);
        setAddFundsData({ amount: 0, ref: '' });
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleRotateKeys = async () => {
    if (!currentClient.id || !user) return;
    if (confirm("Rotate API keys? Old keys will stop working.")) {
      try {
        await clientService.rotateKeys(user, currentClient.id);
        // Refresh
        const updated = await clientService.getClientById(currentClient.id);
        setCurrentClient(updated!);
      } catch(e:any) { alert(e.message); }
    }
  };

  const handleTogglePortal = async (client: Client) => {
     if (!user) return;
     if (!confirm(`Toggle Portal Access for ${client.name}?`)) return;
     try {
        await clientService.togglePortal(user, client.id);
        loadData();
     } catch(e:any) { alert(e.message); }
  };

  const handleCreatePortalUser = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!user || !currentClient.id) return;
     try {
        const res = await authService.createClientUser(user, {
           name: newPortalUser.name,
           email: newPortalUser.email,
           clientId: currentClient.id,
           initialPassword: newPortalUser.password
        });
        if (res.success && res.credentials) {
           setPortalCredentials(res.credentials);
           setNewPortalUser({ name: '', email: '', password: '' });
        } else {
           alert(res.message);
        }
     } catch(e:any) { alert(e.message); }
  };

  // Filter lists
  const filteredClients = clients.filter(c => {
     if (activeTab === 'CLIENTS') return c.type === ClientType.ENTERPRISE_DIRECT || c.type === ClientType.SME_LOCAL;
     return c.type === ClientType.AGGREGATOR || c.type === ClientType.COURIER;
  });

  const getStatusColor = (s: string) => {
     switch(s) {
        case ClientStatus.LIVE: return 'bg-green-100 text-green-800';
        case ClientStatus.TESTING: return 'bg-blue-100 text-blue-800';
        case ClientStatus.PAUSED: return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
     }
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            {activeTab === 'CLIENTS' ? <Users className="mr-3 h-8 w-8 text-brand-600" /> : <Truck className="mr-3 h-8 w-8 text-brand-600" />}
            {activeTab === 'CLIENTS' ? 'Client Master' : 'Courier Partners'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage external partnerships via Standardized Intake</p>
        </div>
        {canEdit && (
          <Button onClick={() => { 
             setCurrentClient({ type: activeTab === 'CLIENTS' ? ClientType.ENTERPRISE_DIRECT : ClientType.COURIER }); 
             setCreateModalOpen(true); 
          }} className="w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Initialize {activeTab === 'CLIENTS' ? 'Client' : 'Partner'}
          </Button>
        )}
      </div>

      <div className="border-b border-gray-200 mb-6">
         <nav className="-mb-px flex space-x-8">
            <button onClick={() => setActiveTab('CLIENTS')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'CLIENTS' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500'}`}>Direct Clients</button>
            <button onClick={() => setActiveTab('COURIERS')} className={`pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'COURIERS' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500'}`}>Tech Partners (3PL)</button>
         </nav>
      </div>

      <Table<Client>
        data={filteredClients}
        isLoading={loading}
        columns={[
          { header: 'Code', accessor: 'clientCode', className: 'font-mono font-bold text-gray-700' },
          { header: 'Name', accessor: 'name' },
          { header: 'Type', accessor: 'type' },
          { 
             header: 'Status', 
             accessor: (row) => (
                <span className={`text-xs px-2 py-1 rounded font-bold ${getStatusColor(row.status)}`}>
                   {row.status}
                </span>
             )
          },
          { 
              header: 'Env', 
              accessor: (row) => (
                <span className={`inline-flex items-center text-xs font-bold ${row.defaultEnv === 'LIVE' ? 'text-green-600' : 'text-gray-500'}`}>
                  {row.defaultEnv === 'LIVE' ? <Zap className="h-3 w-3 mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                  {row.defaultEnv}
                </span>
              )
          },
        ]}
        actions={(client) => (
           <div className="flex gap-2 justify-end">
              {(client.billingMode === 'Prepaid' || client.billingMode === 'Hybrid') && (
                 <button onClick={() => { setCurrentClient(client); setWalletModalOpen(true); }} className="text-green-600 hover:text-green-800 text-xs font-bold flex items-center border border-green-200 px-2 py-1 rounded">
                    <Wallet className="h-3 w-3 mr-1" /> Wallet
                 </button>
              )}
              
              {/* Main Manage Button */}
              <button onClick={() => { 
                 // Ensure deep refresh of client data
                 clientService.getClientById(client.id).then(full => {
                    setCurrentClient(full || client);
                    setOnboardingModalOpen(true);
                    setIntakeTab('PROFILE');
                 });
              }} className="text-brand-600 hover:text-brand-900 text-xs font-bold border border-brand-200 px-3 py-1 rounded flex items-center">
                 <RefreshCw className="h-3 w-3 mr-1" /> Manage
              </button>
           </div>
        )}
      />

      {/* CREATE DRAFT MODAL (STEP 1) */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Initialize Partner Draft">
         <form onSubmit={handleCreateDraft} className="space-y-4">
            <Input label="Legal Name" value={currentClient.name || ''} onChange={e => setCurrentClient({...currentClient, name: e.target.value})} required placeholder="As per GST/PAN" />
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partner Type</label>
                  <select 
                     className="w-full border rounded p-2 text-sm" 
                     value={currentClient.type} 
                     onChange={e => setCurrentClient({...currentClient, type: e.target.value as ClientType})}
                  >
                     {activeTab === 'CLIENTS' ? (
                        <>
                           <option value={ClientType.ENTERPRISE_DIRECT}>Enterprise (Direct)</option>
                           <option value={ClientType.SME_LOCAL}>SME / Local</option>
                        </>
                     ) : (
                        <>
                           <option value={ClientType.AGGREGATOR}>Aggregator (Shiprocket etc)</option>
                           <option value={ClientType.COURIER}>Courier (3PL)</option>
                        </>
                     )}
                  </select>
               </div>
               <Input label="Contact Phone" value={currentClient.phone || ''} onChange={e => setCurrentClient({...currentClient, phone: e.target.value})} required placeholder="10-digit mobile" />
            </div>
            <div className="pt-2">
               <Button type="submit">Create Draft & Start Onboarding</Button>
            </div>
         </form>
      </Modal>

      {/* ONBOARDING INTAKE MODAL (STEP 2 - MAIN) */}
      <Modal isOpen={onboardingModalOpen} onClose={() => setOnboardingModalOpen(false)} title={`Manage: ${currentClient.name} (${currentClient.clientCode})`}>
         <div className="min-h-[500px]">
            {/* Status Bar */}
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded mb-4 border border-gray-200">
               <span className={`text-sm font-bold px-3 py-1 rounded ${getStatusColor(currentClient.status || '')}`}>{currentClient.status}</span>
               <div className="text-xs text-gray-500">Env: <strong>{currentClient.defaultEnv}</strong></div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
               <button onClick={() => setIntakeTab('PROFILE')} className={`px-4 py-2 text-sm font-medium ${intakeTab === 'PROFILE' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>Profile Check</button>
               <button onClick={() => setIntakeTab('COMMERCIALS')} className={`px-4 py-2 text-sm font-medium ${intakeTab === 'COMMERCIALS' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>Commercials</button>
               {(currentClient.type === ClientType.AGGREGATOR || currentClient.type === ClientType.COURIER || currentClient.type === ClientType.ENTERPRISE_DIRECT) && (
                  <button onClick={() => setIntakeTab('TECHNICAL')} className={`px-4 py-2 text-sm font-medium ${intakeTab === 'TECHNICAL' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>Technical</button>
               )}
               <button onClick={() => setIntakeTab('DOCS')} className={`px-4 py-2 text-sm font-medium ${intakeTab === 'DOCS' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>Documents</button>
               <button onClick={() => setIntakeTab('LIFECYCLE')} className={`px-4 py-2 text-sm font-medium ${intakeTab === 'LIFECYCLE' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-gray-500'}`}>Lifecycle</button>
            </div>

            {/* Content */}
            <div className="space-y-4">
               
               {/* 1. PROFILE */}
               {intakeTab === 'PROFILE' && (
                  <div className="space-y-3">
                     <CheckItem 
                        label="Legal Name Verified (GST/PAN)" 
                        checked={currentClient.onboardingChecklist?.legalNameVerified} 
                        onChange={(v) => handleUpdateChecklist('legalNameVerified', v)}
                     />
                     <CheckItem 
                        label="Contact Person Verified" 
                        checked={currentClient.onboardingChecklist?.contactPersonVerified} 
                        onChange={(v) => handleUpdateChecklist('contactPersonVerified', v)}
                     />
                     <CheckItem 
                        label="Tax Details Recorded (GST)" 
                        checked={currentClient.onboardingChecklist?.taxDetailsVerified} 
                        onChange={(v) => handleUpdateChecklist('taxDetailsVerified', v)}
                     />
                  </div>
               )}

               {/* 2. COMMERCIALS */}
               {intakeTab === 'COMMERCIALS' && (
                  <div className="space-y-4">
                     <div className="bg-blue-50 p-4 rounded border border-blue-100">
                        <h4 className="text-sm font-bold text-blue-900 mb-2">Billing Configuration</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                           <div>
                              <span className="text-gray-500 block">Mode</span>
                              <span className="font-bold">{currentClient.billingMode}</span>
                           </div>
                           <div>
                              <span className="text-gray-500 block">Current Balance</span>
                              <span className="font-bold">₹{currentClient.walletBalance || 0}</span>
                           </div>
                        </div>
                     </div>
                     <CheckItem 
                        label="Billing Cycle Configured" 
                        checked={currentClient.onboardingChecklist?.billingCycleSet} 
                        onChange={(v) => handleUpdateChecklist('billingCycleSet', v)}
                     />
                     <CheckItem 
                        label="Rate Card Bound (Future Only)" 
                        checked={currentClient.onboardingChecklist?.rateCardBound} 
                        onChange={(v) => handleUpdateChecklist('rateCardBound', v)}
                     />
                     {/* Ent/SME Specific */}
                     {(currentClient.type === ClientType.ENTERPRISE_DIRECT || currentClient.type === ClientType.SME_LOCAL) && (
                        <CheckItem 
                           label="Pickup SLA Agreed" 
                           checked={currentClient.onboardingChecklist?.pickupSlaAgreed} 
                           onChange={(v) => handleUpdateChecklist('pickupSlaAgreed', v)}
                        />
                     )}
                  </div>
               )}

               {/* 3. TECHNICAL (Tech Partners) */}
               {intakeTab === 'TECHNICAL' && (
                  <div className="space-y-4">
                     <div className="p-3 bg-gray-100 rounded text-xs flex justify-between items-center">
                        <span>API Keys</span>
                        <Button onClick={handleRotateKeys} variant="secondary" className="h-6 w-auto text-xs px-2">Rotate / Generate</Button>
                     </div>
                     
                     <CheckItem 
                        label="API Credentials Generated" 
                        checked={currentClient.onboardingChecklist?.apiCredentialsGenerated} 
                        onChange={(v) => handleUpdateChecklist('apiCredentialsGenerated', v)}
                     />
                     
                     <div className="border-t pt-2 mt-2">
                        <h5 className="text-xs font-bold text-gray-500 uppercase mb-2">Readiness Tests</h5>
                        <ReadinessItem 
                           label="Webhook Signature Verified" 
                           passed={currentClient.technicalReadiness?.webhookSignatureVerified} 
                           onSimulate={() => handleUpdateReadiness('webhookSignatureVerified', true)}
                        />
                        <ReadinessItem 
                           label="Test Shipment Lifecycle Passed" 
                           passed={currentClient.technicalReadiness?.testShipmentLifecyclePassed} 
                           onSimulate={() => handleUpdateReadiness('testShipmentLifecyclePassed', true)}
                        />
                        <ReadinessItem 
                           label="Invoice Sample Approved" 
                           passed={currentClient.technicalReadiness?.invoiceSampleApproved} 
                           onSimulate={() => handleUpdateReadiness('invoiceSampleApproved', true)}
                        />
                     </div>
                  </div>
               )}

               {/* 4. DOCUMENTS */}
               {intakeTab === 'DOCS' && (
                  <div className="space-y-3">
                     <h4 className="text-sm font-bold text-gray-700">Required Documents (Locked Templates)</h4>
                     <DocItem label="MSA / Service Agreement" code="MSA" signed={currentClient.documentsSigned?.includes('MSA')} onSign={handleDocSign} />
                     <DocItem label="SLA Annexure" code="SLA" signed={currentClient.documentsSigned?.includes('SLA')} onSign={handleDocSign} />
                     <DocItem label="Rate Card Annexure" code="RATE_CARD" signed={currentClient.documentsSigned?.includes('RATE_CARD')} onSign={handleDocSign} />
                     <DocItem label="Data Protection Addendum" code="DPA" signed={currentClient.documentsSigned?.includes('DPA')} onSign={handleDocSign} />
                  </div>
               )}

               {/* 5. LIFECYCLE */}
               {intakeTab === 'LIFECYCLE' && (
                  <div className="space-y-4">
                     <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <h4 className="text-sm font-bold text-gray-900 mb-2">Status Progression</h4>
                        <div className="flex items-center text-xs space-x-2">
                           <span className={currentClient.status === ClientStatus.DRAFT ? 'font-bold text-blue-600' : 'text-gray-400'}>Draft</span>
                           <ChevronRight className="h-3 w-3" />
                           <span className={currentClient.status === ClientStatus.UNDER_REVIEW ? 'font-bold text-blue-600' : 'text-gray-400'}>Review</span>
                           <ChevronRight className="h-3 w-3" />
                           <span className={currentClient.status === ClientStatus.TESTING ? 'font-bold text-blue-600' : 'text-gray-400'}>Testing</span>
                           <ChevronRight className="h-3 w-3" />
                           <span className={currentClient.status === ClientStatus.LIVE ? 'font-bold text-green-600' : 'text-gray-400'}>Live</span>
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-1 gap-3">
                        {currentClient.status === ClientStatus.DRAFT && (
                           <Button onClick={handleSubmitReview}>Submit for Review</Button>
                        )}
                        {currentClient.status === ClientStatus.UNDER_REVIEW && (
                           <Button onClick={handleStartTesting} className="bg-indigo-600 hover:bg-indigo-700">Approve for Testing</Button>
                        )}
                        {(currentClient.status === ClientStatus.TESTING || currentClient.status === ClientStatus.UNDER_REVIEW) && (
                           <Button onClick={handleGoLive} className="bg-green-600 hover:bg-green-700"><Zap className="h-4 w-4 mr-2" /> Activate LIVE</Button>
                        )}
                        {currentClient.status === ClientStatus.LIVE && (
                           <Button onClick={handlePause} variant="danger"><Pause className="h-4 w-4 mr-2" /> Pause Operations</Button>
                        )}
                        {currentClient.status === ClientStatus.PAUSED && (
                           <Button onClick={handleGoLive} className="bg-green-600 hover:bg-green-700"><Play className="h-4 w-4 mr-2" /> Resume Operations</Button>
                        )}
                     </div>

                     <div className="border-t pt-4 mt-4">
                        <div className="flex justify-between items-center">
                           <span className="text-sm font-bold text-gray-700">Client Portal Access</span>
                           <button 
                              onClick={() => { setPortalModalOpen(true); setPortalCredentials(null); }}
                              className="text-blue-600 text-xs font-bold hover:underline"
                           >
                              Manage Users
                           </button>
                        </div>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </Modal>

      {/* WALLET MODAL */}
      <Modal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} title={`Wallet: ${currentClient.name}`}>
         <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
               <p className="text-sm text-green-800 uppercase font-bold">Current Balance</p>
               <p className="text-3xl font-bold text-green-900 mt-1">₹{currentClient.walletBalance?.toLocaleString() || 0}</p>
            </div>

            <form onSubmit={handleAddFunds} className="space-y-4 border-t pt-4">
               <h4 className="font-bold text-gray-800 flex items-center">
                  <Plus className="h-4 w-4 mr-2" /> Add Funds (Manual Credit)
               </h4>
               <Input 
                  label="Amount (₹)" 
                  type="number"
                  min="1"
                  value={addFundsData.amount}
                  onChange={e => setAddFundsData({...addFundsData, amount: parseFloat(e.target.value)})}
                  required
               />
               <Input 
                  label="Reference / Transaction ID" 
                  value={addFundsData.ref}
                  onChange={e => setAddFundsData({...addFundsData, ref: e.target.value})}
                  required
                  placeholder="Bank Ref No."
               />
               <Button type="submit" className="bg-green-600 hover:bg-green-700">Confirm Credit</Button>
            </form>
         </div>
      </Modal>
      
      {/* PORTAL MODAL */}
      <Modal isOpen={portalModalOpen} onClose={() => setPortalModalOpen(false)} title={`Portal Access: ${currentClient.name}`}>
         <div className="space-y-6">
            <div className="bg-white p-4 rounded border border-gray-200">
               <div className="flex justify-between items-center">
                  <div>
                     <h4 className="font-bold text-gray-900">Client Portal</h4>
                     <p className="text-sm text-gray-500">Allow {currentClient.name} to view reports and shipments.</p>
                  </div>
                  <button 
                     onClick={() => handleTogglePortal(currentClient as Client)} 
                     className={`text-sm font-bold px-3 py-1 rounded ${currentClient.portalEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                  >
                     {currentClient.portalEnabled ? 'Active' : 'Disabled'}
                  </button>
               </div>
            </div>

            {currentClient.portalEnabled && (
               <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center">
                     <UserPlus className="h-4 w-4 mr-2" /> Provision New User
                  </h4>
                  {portalCredentials ? (
                     <div className="bg-green-50 border border-green-200 p-4 rounded text-center">
                        <p className="text-green-800 font-bold mb-2">User Created Successfully</p>
                        <p className="text-sm text-gray-600 mb-1">Username: <strong>{portalCredentials.username}</strong></p>
                        <p className="text-sm text-gray-600 mb-3">Password: <strong className="font-mono bg-white p-1 rounded border">{portalCredentials.tempPass}</strong></p>
                        <p className="text-xs text-red-500">Share these now. Password cannot be viewed again.</p>
                        <Button onClick={() => setPortalCredentials(null)} variant="secondary" className="mt-3">Provision Another</Button>
                     </div>
                  ) : (
                     <form onSubmit={handleCreatePortalUser} className="space-y-3">
                        <Input label="Full Name" value={newPortalUser.name} onChange={e => setNewPortalUser({...newPortalUser, name: e.target.value})} required />
                        <Input label="Email (Login ID)" type="email" value={newPortalUser.email} onChange={e => setNewPortalUser({...newPortalUser, email: e.target.value})} required />
                        <Input label="Initial Password" type="text" value={newPortalUser.password} onChange={e => setNewPortalUser({...newPortalUser, password: e.target.value})} required placeholder="Create strong password" />
                        <Button type="submit">Create Login</Button>
                     </form>
                  )}
               </div>
            )}
         </div>
      </Modal>

    </Layout>
  );
};

// --- Sub-Components ---

const CheckItem = ({ label, checked, onChange }: { label: string, checked?: boolean, onChange: (v: boolean) => void }) => (
   <label className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 cursor-pointer">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} className="h-5 w-5 text-brand-600 rounded" />
   </label>
);

const ReadinessItem = ({ label, passed, onSimulate }: { label: string, passed?: boolean, onSimulate: () => void }) => (
   <div className="flex items-center justify-between p-2 border-b last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      {passed ? (
         <span className="text-green-600 text-xs font-bold flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> PASSED</span>
      ) : (
         <button onClick={onSimulate} className="text-blue-600 text-xs font-bold hover:underline">Run Test</button>
      )}
   </div>
);

const DocItem = ({ label, code, signed, onSign }: { label: string, code: string, signed?: boolean, onSign: (c: string) => void }) => (
   <div className="flex items-center justify-between p-3 bg-white border rounded">
      <div className="flex items-center">
         <FileText className="h-4 w-4 text-gray-400 mr-2" />
         <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      {signed ? (
         <span className="text-green-600 text-xs font-bold">SIGNED</span>
      ) : (
         <button onClick={() => onSign(code)} className="text-brand-600 text-xs font-bold hover:underline">Mark Signed</button>
      )}
   </div>
);
