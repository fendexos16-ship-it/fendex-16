
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { authService } from '../../services/authService';
import { masterDataService } from '../../services/masterDataService';
import { User, UserRole, UserStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, UserPlus, Lock, Unlock, Key, Building2 } from 'lucide-react';

export const UserManager: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newUser, setNewUser] = useState<{ name: string, phone: string, email: string, role: UserRole, linkedEntityId: string }>({
    name: '', phone: '', email: '', role: UserRole.MMDC_MANAGER, linkedEntityId: ''
  });
  
  // Entity Lists for Dropdown
  const [entities, setEntities] = useState<{ id: string, name: string }[]>([]);
  const [credentials, setCredentials] = useState<{ username: string, tempPass: string } | null>(null);

  // Management Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [resetPass, setResetPass] = useState('');

  // Security check: Only Founder
  if (user?.role !== UserRole.FOUNDER) {
    return <Navigate to="/" replace />;
  }

  const loadData = async () => {
    setLoading(true);
    const data = await authService.getAllUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch entities dynamically based on selected role
  useEffect(() => {
    const fetchEntities = async () => {
      let data: any[] = [];
      if (newUser.role === UserRole.MMDC_MANAGER) {
        data = await masterDataService.getMMDCs();
      } else if (newUser.role === UserRole.LMDC_MANAGER) {
        data = await masterDataService.getLMDCs();
      } else if (newUser.role === UserRole.RIDER) {
        data = await masterDataService.getRiders();
      } else if (newUser.role === UserRole.AREA_MANAGER) {
        data = await masterDataService.getDCs();
      }
      setEntities(data.map(e => ({ id: e.id, name: e.name })));
      // Reset linked entity if not in new list
      setNewUser(prev => ({ ...prev, linkedEntityId: '' }));
    };
    fetchEntities();
  }, [newUser.role]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.linkedEntityId && [UserRole.MMDC_MANAGER, UserRole.LMDC_MANAGER, UserRole.RIDER].includes(newUser.role)) {
      alert("Operational users MUST be linked to an Entity.");
      return;
    }

    try {
      const res = await authService.createUser(user!, {
        ...newUser,
        linkedEntityType: newUser.role === UserRole.MMDC_MANAGER ? 'MMDC' : 
                          newUser.role === UserRole.LMDC_MANAGER ? 'LMDC' : 
                          newUser.role === UserRole.RIDER ? 'RIDER' : 'AREA'
      });
      
      if (res.success && res.credentials) {
        setCredentials(res.credentials); // Show success modal
        setCreateModalOpen(false);
        loadData();
      } else {
        alert(res.message);
      }
    } catch (e: any) { alert(e.message); }
  };

  const handleToggleStatus = async (u: User) => {
    if (u.role === UserRole.FOUNDER) return;
    const newStatus = u.status === UserStatus.ACTIVE ? UserStatus.DISABLED : UserStatus.ACTIVE;
    if (confirm(`Change status of ${u.username} to ${newStatus}?`)) {
      await authService.updateUserStatus(user!, u.id, newStatus);
      loadData();
    }
  };

  const handleUnlock = async (u: User) => {
    if (confirm(`Unlock account for ${u.username}? This resets login attempts.`)) {
      await authService.updateUserStatus(user!, u.id, UserStatus.ACTIVE);
      loadData();
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !resetPass) return;
    await authService.resetPassword(selectedUser.id, resetPass);
    alert('Password Reset Successful');
    setResetModalOpen(false);
    setResetPass('');
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ShieldCheck className="h-8 w-8 mr-3 text-brand-600" />
            Identity & Access Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Strict Role-Based Access Control</p>
        </div>
        <Button onClick={() => { setCreateModalOpen(true); setCredentials(null); }} className="w-auto">
          <UserPlus className="h-4 w-4 mr-2" /> Create User Login
        </Button>
      </div>

      <Table<User>
        data={users}
        isLoading={loading}
        columns={[
          { header: 'Username', accessor: 'username', className: 'font-mono font-bold' },
          { header: 'Name', accessor: 'name' },
          { 
            header: 'Role', 
            accessor: (row) => (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800`}>
                {row.role}
              </span>
            ) 
          },
          { 
             header: 'Linked Entity', 
             accessor: (row) => row.linkedEntityId ? <span className="font-mono text-xs text-gray-500">{row.linkedEntityId}</span> : '-'
          },
          { 
             header: 'Status', 
             accessor: (row) => (
               <span className={`inline-flex px-2 py-1 text-xs font-bold rounded ${
                 row.status === UserStatus.ACTIVE ? 'bg-green-100 text-green-800' : 
                 row.status === UserStatus.LOCKED ? 'bg-red-100 text-red-800' : 
                 row.status === UserStatus.RESET_REQUIRED ? 'bg-yellow-100 text-yellow-800' :
                 'bg-gray-100 text-gray-500'
               }`}>
                 {row.status}
                 {row.status === UserStatus.LOCKED && <Lock className="h-3 w-3 ml-1" />}
               </span>
             )
          },
          { header: 'Last Login', accessor: (row) => row.lastLogin ? new Date(row.lastLogin).toLocaleString() : 'Never' }
        ]}
        actions={(row) => (
           <div className="flex justify-end gap-2">
             {row.status === UserStatus.LOCKED && (
                <button onClick={() => handleUnlock(row)} className="text-brand-600 font-bold text-xs border border-brand-200 px-2 py-1 rounded flex items-center">
                   <Unlock className="h-3 w-3 mr-1" /> Unlock
                </button>
             )}
             {row.role !== UserRole.FOUNDER && (
               <>
                 <button onClick={() => handleToggleStatus(row)} className="text-gray-600 hover:text-gray-900 font-medium text-xs border border-gray-200 px-2 py-1 rounded">
                    {row.status === UserStatus.ACTIVE ? 'Disable' : 'Enable'}
                 </button>
                 <button onClick={() => { setSelectedUser(row); setResetModalOpen(true); }} className="text-red-600 hover:text-red-900 font-medium text-xs border border-red-200 px-2 py-1 rounded flex items-center">
                    <Key className="h-3 w-3 mr-1" /> Reset PW
                 </button>
               </>
             )}
           </div>
        )}
      />

      {/* CREATE USER MODAL */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Provision New Login">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select className="w-full border rounded p-2" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                   <option value={UserRole.MMDC_MANAGER}>MMDC Manager</option>
                   <option value={UserRole.LMDC_MANAGER}>LMDC Manager</option>
                   <option value={UserRole.AREA_MANAGER}>Area Manager</option>
                   <option value={UserRole.RIDER}>Rider</option>
                   <option value={UserRole.FINANCE_ADMIN}>Finance Admin</option>
                </select>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Entity</label>
                <select 
                   className="w-full border rounded p-2" 
                   value={newUser.linkedEntityId} 
                   onChange={e => setNewUser({...newUser, linkedEntityId: e.target.value})}
                   required={newUser.role !== UserRole.FINANCE_ADMIN}
                   disabled={newUser.role === UserRole.FINANCE_ADMIN}
                >
                   <option value="">-- Select Entity --</option>
                   {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">User login will be bound to this entity.</p>
             </div>
          </div>

          <Input label="Full Name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4">
             <Input label="Phone" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} required placeholder="10-digit mobile" />
             <Input label="Email (Optional)" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
          </div>

          <div className="pt-2">
            <Button type="submit">Provision Login</Button>
          </div>
        </form>
      </Modal>

      {/* CREDENTIALS SUCCESS MODAL */}
      <Modal isOpen={!!credentials} onClose={() => setCredentials(null)} title="Credentials Created">
         <div className="text-center space-y-4">
            <div className="bg-green-100 p-3 rounded-full inline-block">
               <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">User Successfully Provisioned</h3>
            <div className="bg-gray-100 p-4 rounded border border-gray-300 text-left">
               <p className="text-sm text-gray-500 mb-1">Operator ID (Username)</p>
               <p className="font-mono font-bold text-lg mb-3 select-all">{credentials?.username}</p>
               <p className="text-sm text-gray-500 mb-1">Default Password</p>
               <p className="font-mono font-bold text-lg select-all bg-yellow-50 p-1 border border-yellow-200">{credentials?.tempPass}</p>
               <p className="text-xs text-gray-500 mt-2">Pattern: Last 4 digits of phone + '@Fx'</p>
            </div>
            <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
               User will be forced to change password on first login via the "Forgot Password" reset flow.
            </div>
            <Button onClick={() => setCredentials(null)}>Close</Button>
         </div>
      </Modal>

      {/* RESET PW MODAL */}
      <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title="Manual Password Reset">
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-gray-600">Resetting password for <strong>{selectedUser?.username}</strong>. This will also unlock the account.</p>
          <Input label="New Password" value={resetPass} onChange={e => setResetPass(e.target.value)} required />
          <Button type="submit" variant="danger">Reset Password</Button>
        </form>
      </Modal>
    </Layout>
  );
};
