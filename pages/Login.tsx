
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Building2, AlertCircle, Lock, Shield } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!username || !password) {
        throw new Error('Please enter username and password.');
      }

      const response = await authService.login(username, password);

      if (response.success && response.user) {
        login(response.user);
        
        // Auto-Route based on Role
        const role = response.user.role;
        if (role === 'FOUNDER') navigate('/founder/dashboard');
        else if (role === 'RIDER') navigate('/rider/dashboard');
        else if (role === 'MMDC_MANAGER') navigate('/ops/mmdc-dashboard');
        else if (role === 'LMDC_MANAGER') navigate('/ops/lmdc-dashboard');
        else if (role === 'CLIENT_VIEW') navigate('/client/dashboard');
        else navigate('/');
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-gray-900 p-3 rounded-full shadow-lg">
             <Building2 className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          FENDEX LOGISTICS
        </h2>
        <div className="mt-2 flex items-center justify-center text-sm font-bold text-red-600 uppercase tracking-wider">
           <Shield className="h-4 w-4 mr-1" /> Authorized Personnel Only
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl border-t-4 border-brand-600 sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className={`rounded-md p-4 border ${error.includes('LOCKED') ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {error.includes('LOCKED') ? <Lock className="h-5 w-5 text-red-400" /> : <AlertCircle className="h-5 w-5 text-yellow-400" />}
                  </div>
                  <div className="ml-3">
                    <h3 className={`text-sm font-medium ${error.includes('LOCKED') ? 'text-red-800' : 'text-yellow-800'}`}>Access Denied</h3>
                    <div className={`mt-1 text-sm ${error.includes('LOCKED') ? 'text-red-700' : 'text-yellow-700'}`}>
                      {error}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Input
              label="Operator ID"
              type="text"
              placeholder="Username / Phone"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />

            <div className="relative">
              <Input
                label="Secure Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <Button type="submit" isLoading={isLoading} className="bg-gray-900 hover:bg-black text-white">
                Authenticate
              </Button>
            </div>
            
            <div className="text-center mt-3">
               <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-500 underline">
                  Forgot Password? / Activate Account
               </Link>
            </div>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-4 text-center">
             <p className="text-[10px] text-gray-400 uppercase tracking-widest">
               Restricted System • All Actions Monitored
             </p>
             <p className="text-[10px] text-gray-300 mt-1">v1.0.0-LIVE</p>
          </div>
        </div>
      </div>
    </div>
  );
};
