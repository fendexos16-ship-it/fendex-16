import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { masterDataService } from '../../services/masterDataService';
import { RiderProfile, LastMileDC, UserRole, RiderCapacityProfile, SYSTEM_HARD_CAPS, RiderTier } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus, CreditCard, User, Camera, X, FileText, ShieldCheck } from 'lucide-react';

export const RiderManager: React.FC = () => {
  const { user } = useAuth();
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [lmdcs, setLmdcs] = useState<LastMileDC[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [currentRider, setCurrentRider] = useState<Partial<RiderProfile>>({});
  const [panFile, setPanFile] = useState<File | null>(null);
  
  const isFounder = user?.role === UserRole.FOUNDER;
  const isLMDC = user?.role === UserRole.LMDC_MANAGER;
  const canEdit = isLMDC || isFounder; 

  const loadData = async () => {
    setLoading(true);
    const [riderData, lmdcData] = await Promise.all([
      masterDataService.getRiders(),
      masterDataService.getLMDCs()
    ]);
    
    if (isLMDC && user?.linkedEntityId) {
       setRiders(riderData.filter(r => r.linkedLmdcId === user.linkedEntityId));
    } else {
       setRiders(riderData);
    }
    setLmdcs(lmdcData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPanFile(e.target.files[0]);
    }
  };

  const validateStep2 = () => {
    if (!currentRider.panNumber || currentRider.panNumber.length !== 10) {
      alert("Invalid PAN Number format.");
      return false;
    }
    if (!panFile && !currentRider.panProofUrl) {
      alert("PAN Card image is mandatory.");
      return false;
    }
    return true;
  };

  const handleFinalSubmit = async () => {
    if (!currentRider.bankAccount || !currentRider.ifsc) {
       alert("Banking information is mandatory.");
       return;
    }

    try {
      setLoading(true);
      // In production, FormData would be used for multipart/form-data.
      // service simulation accepts File object directly.
      await masterDataService.saveRider(currentRider, panFile || undefined);
      
      setIsModalOpen(false);
      setPanFile(null);
      await loadData();
      alert("Rider Onboarded Successfully. Account is now ACTIVE for App Login.");
    } catch (e: any) {
      alert("Submission Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    const initialLmdc = isLMDC ? user?.linkedEntityId : '';
    setCurrentRider({ status: 'Draft', linkedLmdcId: initialLmdc, tier: RiderTier.TIER_1 });
    setPanFile(null);
    setStep(1);
    setIsModalOpen(true);
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
             <User className="mr-3 h-8 w-8 text-brand-600" /> Rider Fleet
          </h1>
          <p className="text-sm text-gray-500 mt-1">Onboard riders for app-based delivery operations</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Onboard Rider
          </Button>
        )}
      </div>

      <Table<RiderProfile>
        data={riders}
        isLoading={loading}
        columns={[
          { header: 'ID', accessor: 'id', className: 'w-20 font-mono text-gray-500' },
          { header: 'Name', accessor: 'name' },
          { header: 'Phone', accessor: 'phone' },
          { header: 'Status', accessor: (row) => (
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                 row.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {row.status}
              </span>
            )
          },
        ]}
        actions={(row) => (
           <div className="flex justify-end gap-2">
              <button onClick={() => { setCurrentRider(row); setStep(1); setIsModalOpen(true); }} className="text-brand-600 font-bold text-xs border border-brand-200 px-2 py-1 rounded">
                 Edit / View
              </button>
           </div>
        )}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Rider Onboarding Protocol">
         <div className="mb-4">
            <div className="flex items-center justify-between mb-6 px-2">
               {[1, 2, 3].map(s => (
                  <React.Fragment key={s}>
                     <div className={`flex flex-col items-center ${step >= s ? 'text-brand-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-1 ${step >= s ? 'bg-brand-100 border-2 border-brand-600' : 'bg-gray-100'}`}>{s}</div>
                        <span className="text-[10px] font-bold uppercase">{s===1?'Basic':s===2?'PAN':'Bank'}</span>
                     </div>
                     {s < 3 && <div className={`h-1 flex-1 mx-2 ${step > s ? 'bg-brand-600' : 'bg-gray-200'}`}></div>}
                  </React.Fragment>
               ))}
            </div>

            <form className="space-y-4">
               {step === 1 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                     <Input label="Full Name" value={currentRider.name || ''} onChange={e => setCurrentRider({...currentRider, name: e.target.value})} required />
                     <Input label="Mobile (for App Login)" value={currentRider.phone || ''} onChange={e => setCurrentRider({...currentRider, phone: e.target.value})} required placeholder="10-digit mobile" />
                     <Input label="Address" value={currentRider.address || ''} onChange={e => setCurrentRider({...currentRider, address: e.target.value})} required />
                     <div className="pt-4 flex justify-end">
                        <Button type="button" onClick={() => setStep(2)}>Continue to Documents</Button>
                     </div>
                  </div>
               )}

               {step === 2 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                     <Input label="PAN Number" value={currentRider.panNumber || ''} onChange={e => setCurrentRider({...currentRider, panNumber: e.target.value.toUpperCase()})} required maxLength={10} placeholder="ABCDE1234F" />
                     <Input label="Name on PAN" value={currentRider.panName || ''} onChange={e => setCurrentRider({...currentRider, panName: e.target.value})} required />
                     
                     <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">PAN Card Image</label>
                        {!panFile && !currentRider.panProofUrl ? (
                           <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:border-brand-500 transition-colors bg-gray-50">
                              <Camera className="h-10 w-10 text-gray-400 mb-2" />
                              <p className="text-xs text-gray-500">Tap to upload PAN Card photo</p>
                              <input 
                                 type="file" 
                                 accept="image/*" 
                                 className="absolute inset-0 opacity-0 cursor-pointer" 
                                 onChange={handleFileChange}
                              />
                           </div>
                        ) : (
                           <div className="relative bg-brand-50 border border-brand-200 rounded-lg p-4 flex items-center justify-between">
                              <div className="flex items-center">
                                 <FileText className="h-8 w-8 text-brand-600 mr-3" />
                                 <div>
                                    <p className="text-sm font-bold text-brand-900 truncate max-w-[200px]">
                                       {panFile ? panFile.name : 'Stored Document'}
                                    </p>
                                    <p className="text-[10px] text-brand-600 uppercase font-bold">File Attached</p>
                                 </div>
                              </div>
                              <button type="button" onClick={() => { setPanFile(null); setCurrentRider({...currentRider, panProofUrl: ''}); }} className="p-1 hover:bg-brand-100 rounded">
                                 <X className="h-5 w-5 text-brand-700" />
                              </button>
                           </div>
                        )}
                     </div>

                     <div className="pt-4 flex justify-between">
                        <Button type="button" variant="secondary" onClick={() => setStep(1)} className="w-auto">Back</Button>
                        <Button type="button" onClick={() => validateStep2() && setStep(3)}>Continue to Banking</Button>
                     </div>
                  </div>
               )}

               {step === 3 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                     <Input label="Bank Account Number" value={currentRider.bankAccount || ''} onChange={e => setCurrentRider({...currentRider, bankAccount: e.target.value})} required />
                     <Input label="IFSC Code" value={currentRider.ifsc || ''} onChange={e => setCurrentRider({...currentRider, ifsc: e.target.value.toUpperCase()})} required placeholder="SBIN0001234" />
                     <Input label="Bank Name" value={currentRider.bankName || ''} onChange={e => setCurrentRider({...currentRider, bankName: e.target.value})} required />
                     <div className="pt-4 flex justify-between">
                        <Button type="button" variant="secondary" onClick={() => setStep(2)} className="w-auto">Back</Button>
                        <Button type="button" onClick={handleFinalSubmit} className="bg-green-600 shadow-md hover:bg-green-700">
                           <ShieldCheck className="h-4 w-4 mr-2" />
                           Finalize Onboarding
                        </Button>
                     </div>
                  </div>
               )}
            </form>
         </div>
      </Modal>
    </Layout>
  );
};