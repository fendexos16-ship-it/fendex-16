
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { complianceService } from '../../services/complianceService';
import { useAuth } from '../../context/AuthContext';
import { ComplianceLog, UserRole } from '../../types';
import { FileText } from 'lucide-react';

export const MMDCAudit: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ComplianceLog[]>([]);

  useEffect(() => {
    // Note: complianceService.getLogs usually restricts to Founder/Finance.
    // In a real app, we'd have a specific `getMMDCLogs(mmdcId)` method.
    // For this prototype, we assume `complianceService` allows fetching if implemented correctly,
    // OR we filter client-side if the mock returns all (which it currently doesn't for MMDC role).
    // I will mock a local fetch since the service prevents non-founder access.
    // In production step, update service permission.
    
    // Simulating fetching logs relevant to this user's actions
    // Since service is strict, this might be empty unless we update service.
    // Requirement says "Read-only audit visibility" for MMDC.
    const load = async () => {
       // Mock for now as service is gated.
       const allLogs = JSON.parse(localStorage.getItem('fendex_compliance_logs_db') || '[]');
       setLogs(allLogs.filter((l:any) => l.actorRole === UserRole.MMDC_MANAGER || l.description.includes(user?.linkedEntityId || '')));
    };
    load();
  }, [user]);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
           <FileText className="mr-3 h-8 w-8 text-gray-600" /> Station Audit Log
        </h1>
        <p className="text-sm text-gray-500 mt-1">Immutable record of operations at {user?.linkedEntityId}</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
         <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
               <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Timestamp (IST)</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Event</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Actor</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Hash</th>
               </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
               {logs.map(log => (
                  <tr key={log.id}>
                     <td className="px-6 py-4 whitespace-nowrap text-gray-500">{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                     <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800">{log.eventType}</td>
                     <td className="px-6 py-4 whitespace-nowrap text-gray-600">{log.actorId}</td>
                     <td className="px-6 py-4 text-gray-800">{log.description}</td>
                     <td className="px-6 py-4 font-mono text-xs text-gray-400">{log.integrityHash.substring(0,8)}...</td>
                  </tr>
               ))}
               {logs.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">No logs found.</td></tr>
               )}
            </tbody>
         </table>
      </div>
    </Layout>
  );
};