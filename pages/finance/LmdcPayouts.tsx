import React, { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { Table } from '../../components/Table';
import { ledgerService } from '../../services/ledgerService';
import { masterDataService } from '../../services/masterDataService';
import { LmdcLedgerEntry, LedgerStatus, PaymentMode } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { IndianRupee, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export const LmdcPayouts: React.FC = () => {
  const { user } = useAuth();
  const [ledgers, setLedgers] = useState<LmdcLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lmdcs, setLmdcs] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      const [ledgerData, lmdcData] = await Promise.all([
        ledgerService.getLmdcLedgers(user),
        masterDataService.getLMDCs()
      ]);
      setLedgers(ledgerData);
      setLmdcs(lmdcData);
      setLoading(false);
    };
    loadData();
  }, [user]);

  const stats = ledgerService.getStats(ledgers);
  const getLMDCName = (id: string) => lmdcs.find(l => l.id === id)?.name || id;

  const StatCard = ({ title, amount, icon: Icon, colorClass, bgClass }: any) => (
    <div className={`p-6 rounded-lg border ${bgClass} flex items-start justify-between`}>
      <div>
        <p className={`text-sm font-medium ${colorClass} uppercase tracking-wider`}>{title}</p>
        <p className={`text-2xl font-bold ${colorClass} mt-2`}>₹{amount.toLocaleString()}</p>
      </div>
      <div className={`p-2 rounded-lg bg-white bg-opacity-60`}>
        <Icon className={`h-6 w-6 ${colorClass}`} />
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">LMDC Payout Ledger</h1>
        <p className="text-sm text-gray-500 mt-1">Financial tracking for Distribution Partners</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard 
          title="Total Payable" 
          amount={stats.open} 
          icon={CheckCircle2} 
          colorClass="text-green-700" 
          bgClass="bg-green-50 border-green-200"
        />
        <StatCard 
          title="Processing" 
          amount={stats.processing} 
          icon={Clock} 
          colorClass="text-yellow-700" 
          bgClass="bg-yellow-50 border-yellow-200"
        />
        <StatCard 
          title="Zero Payout (RTO)" 
          amount={0} // stats.void is a count, not amount
          icon={AlertCircle} 
          colorClass="text-gray-700" 
          bgClass="bg-gray-50 border-gray-200"
        />
      </div>

      <Table<LmdcLedgerEntry>
        data={ledgers}
        isLoading={loading}
        columns={[
          { header: 'Date', accessor: (row) => new Date(row.createdAt).toLocaleDateString() },
          { header: 'Shipment (AWB)', accessor: 'shipmentId', className: 'font-mono' },
          { header: 'LMDC', accessor: (row) => getLMDCName(row.lmdcId) },
          { 
            header: 'Pay Mode', 
            accessor: (row) => (
               <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${
                 row.paymentMode === PaymentMode.COD ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-500 border-gray-200'
               }`}>
                 {row.paymentMode || PaymentMode.PREPAID}
               </span>
            ) 
          },
          { 
             header: 'COD Collected', 
             accessor: (row) => row.paymentMode === PaymentMode.COD ? `₹${row.codAmount}` : '-',
             className: 'text-gray-500 font-mono text-xs'
          },
          { header: 'Status', accessor: 'shipmentStatus' },
          { header: 'Payout Rate', accessor: (row) => `₹${row.appliedRate}` },
          { header: 'Amount', accessor: (row) => `₹${row.calculatedAmount}`, className: 'font-bold' },
          { 
            header: 'Ledger Status', 
            accessor: (row) => {
              const colors: Record<string, string> = {
                [LedgerStatus.OPEN]: 'bg-blue-100 text-blue-800',
                [LedgerStatus.APPROVED]: 'bg-purple-100 text-purple-800',
                [LedgerStatus.LOCKED]: 'bg-gray-200 text-gray-800', 
                [LedgerStatus.PROCESSING]: 'bg-yellow-100 text-yellow-800',
                [LedgerStatus.PAID]: 'bg-green-100 text-green-800',
                [LedgerStatus.FAILED]: 'bg-red-100 text-red-800',
                [LedgerStatus.VOID]: 'bg-gray-100 text-gray-800',
              };
              return (
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colors[row.ledgerStatus] || 'bg-gray-100'}`}>
                  {row.ledgerStatus}
                </span>
              );
            }
          },
        ]}
      />
    </Layout>
  );
};