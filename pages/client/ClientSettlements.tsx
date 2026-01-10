
import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { useAuth } from '../../context/AuthContext';
import { settlementService } from '../../services/settlementService';
import { ClientSettlementBatch, SettlementState } from '../../types';
import { FileText, Download, CheckCircle, Clock } from 'lucide-react';

export const ClientSettlements: React.FC = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<ClientSettlementBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
       if (!user?.linkedEntityId) return;
       setLoading(true);
       const data = await settlementService.getBatches(user.linkedEntityId, user.role);
       setBatches(data);
       setLoading(false);
    };
    load();
  }, [user]);

  // Handle Export (Reusing logic from manager but simplified)
  const handleDownload = async (batch: ClientSettlementBatch) => {
     try {
        const reportRows = await settlementService.getBatchReport(batch.id);
        const fileName = `Settlement_${batch.batchCode}`;
        
        // Generate CSV
        const headers = ['AWB', 'Delivery Date', 'COD Amount', 'Net Amount', 'Status', 'Reference'];
        const csvRows = reportRows.map(r => 
           `"${r.awb}","${r.deliveryDate}",${r.codAmount},${r.netAmount},"${r.settlementStatus}","${r.settlementRef}"`
        );
        const csvContent = [headers.join(','), ...csvRows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.csv`;
        a.click();
     } catch (e: any) { alert(e.message); }
  };

  return (
    <Layout>
      <div className="mb-6">
         <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FileText className="mr-3 h-8 w-8 text-brand-600" /> Settlement Statements
         </h1>
         <p className="text-sm text-gray-500 mt-1">View your payout history and download reports</p>
      </div>

      <Table<ClientSettlementBatch>
         data={batches}
         isLoading={loading}
         columns={[
            { header: 'Batch ID', accessor: 'batchCode', className: 'font-mono font-bold' },
            { header: 'Period', accessor: (b) => `${new Date(b.periodStart).toLocaleDateString()} - ${new Date(b.periodEnd).toLocaleDateString()}` },
            { header: 'Generated', accessor: (b) => new Date(b.generatedAt).toLocaleDateString() },
            { header: 'Total COD', accessor: (b) => `₹${b.totalCodAmount.toLocaleString()}` },
            { header: 'Net Payable', accessor: (b) => `₹${b.netAmount.toLocaleString()}`, className: 'font-bold text-gray-900' },
            { 
               header: 'Status', 
               accessor: (b) => (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                     b.status === SettlementState.SETTLED ? 'bg-green-100 text-green-800' : 
                     b.status === SettlementState.CONFIRMED ? 'bg-blue-100 text-blue-800' :
                     'bg-yellow-100 text-yellow-800'
                  }`}>
                     {b.status === SettlementState.SETTLED ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                     {b.status}
                  </span>
               )
            },
            { header: 'Ref No', accessor: (b) => b.bankReference || '-' }
         ]}
         actions={(b) => (
            <button 
               onClick={() => handleDownload(b)} 
               className="text-brand-600 hover:text-brand-800 text-xs font-bold flex items-center"
            >
               <Download className="h-3 w-3 mr-1" /> Download
            </button>
         )}
      />
    </Layout>
  );
};
