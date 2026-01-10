
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, CheckCircle, Mail, Key, Shield, User } from 'lucide-react';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { authService } from '../services/authService';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) return;
    setIsLoading(true);
    setError('');
    
    try {
      const res = await authService.requestPasswordReset(identifier);
      if (res.success) {
        setSuccessMsg(res.message || 'OTP Sent');
        setStep('VERIFY');
      } else {
        setError(res.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !newPassword) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await authService.confirmPasswordReset(identifier, otp, newPassword);
      if (res.success) {
        alert('Password Reset Successful. Account Activated. Please Login.');
        navigate('/login');
      } else {
        setError(res.message || 'Reset failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
           <div className="bg-brand-600 p-3 rounded-full shadow-lg">
             <Key className="h-8 w-8 text-white" />
           </div>
        </div>
        <h2 className="text-center text-2xl font-extrabold text-gray-900">
          Account Activation / Reset
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Secure Password Recovery Protocol
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-8 shadow-2xl border-t-4 border-brand-600 sm:rounded-lg">
          
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm flex items-center">
               <ShieldAlert className="h-4 w-4 mr-2" />
               {error}
            </div>
          )}

          {step === 'REQUEST' && (
            <form onSubmit={handleRequestOtp} className="space-y-6">
               <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                  Enter your <strong>Operator ID</strong> or <strong>Phone Number</strong> to verify identity.
               </div>
               <Input 
                  label="Operator ID / Phone" 
                  type="text" 
                  value={identifier} 
                  onChange={e => setIdentifier(e.target.value)} 
                  placeholder="e.g. MMDC-JOHN-1234 or 9988..."
                  required 
                  autoFocus
               />
               <Button type="submit" isLoading={isLoading} className="bg-gray-900 hover:bg-black">
                  <User className="h-4 w-4 mr-2" /> Verify Identity
               </Button>
            </form>
          )}

          {step === 'VERIFY' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
               <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4 text-center">
                  <p className="text-sm font-bold text-green-800">{successMsg}</p>
                  <p className="text-[10px] text-gray-400 mt-1">(Dev Tip: Check Console for OTP)</p>
               </div>
               
               <Input 
                  label="Enter OTP" 
                  type="text" 
                  value={otp} 
                  onChange={e => setOtp(e.target.value)} 
                  placeholder="6-digit code"
                  required 
                  autoFocus
               />
               
               <Input 
                  label="New Secure Password" 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Minimum 8 characters"
                  required 
               />

               <Button type="submit" isLoading={isLoading} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" /> Set Password & Activate
               </Button>
            </form>
          )}
          
          <div className="flex items-center justify-center mt-6 pt-4 border-t border-gray-100">
            <Link 
              to="/login" 
              className="flex items-center text-sm font-bold text-brand-600 hover:text-brand-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Login
            </Link>
          </div>
        </div>
        
        <div className="mt-4 text-center">
           <p className="text-xs text-gray-400 flex items-center justify-center">
              <Shield className="h-3 w-3 mr-1" /> Secured by Fendex Core
           </p>
        </div>
      </div>
    </div>
  );
};
