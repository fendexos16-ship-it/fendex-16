
import { 
  User, 
  UserRole, 
  Invoice, 
  InvoiceStatus, 
  Receivable, 
  ReceivableStatus,
  CollectionRecord,
  Client
} from '../types';
import { billingService } from './billingService';
import { collectionService } from './collectionService';
import { shipmentService } from './shipmentService';
import { clientService } from './clientService';
import { complianceService } from './complianceService';
import { razorpayService } from './razorpayService';

export interface PortalStats {
  openInvoices: number;
  outstandingBalance: number;
  lastPaymentDate: string;
  nextDueDate: string;
  activeDisputes: number;
}

export const portalService = {
  
  // 1. DASHBOARD STATS (Aggregated & Masked)
  getDashboardStats: async (user: User): Promise<PortalStats> => {
    if (user.role !== UserRole.CLIENT_VIEW || !user.linkedEntityId) throw new Error("Unauthorized");
    
    const receivables = await billingService.getReceivables(user.linkedEntityId);
    
    const openRecs = receivables.filter(r => r.status === ReceivableStatus.OPEN || r.status === ReceivableStatus.PARTIALLY_PAID || r.status === ReceivableStatus.OVERDUE);
    const outstanding = openRecs.reduce((sum, r) => sum + r.balance, 0);
    
    const disputes = receivables.filter(r => r.status === ReceivableStatus.DISPUTED).length;

    // Find dates
    const dueDates = openRecs.map(r => new Date(r.dueDate).getTime()).sort((a,b) => a - b);
    const nextDue = dueDates.length > 0 ? new Date(dueDates[0]).toLocaleDateString() : '-';

    // Last Payment (Need Collection History)
    // We don't have an efficient "get all payments for client" in collectionService, 
    // so we iterate receivables or assume cached.
    // For MVP, we'll fetch invoices to find last paid date? 
    // Better: Fetch collection history if possible, but collectionService is by ReceivableID.
    // Let's rely on invoices.
    const invoices = await billingService.getInvoices(user.linkedEntityId);
    const paidInvoices = invoices.filter(i => i.status === InvoiceStatus.PAID).sort((a,b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
    const lastPaid = paidInvoices.length > 0 ? new Date(paidInvoices[0].paidAt!).toLocaleDateString() : '-';

    return {
       openInvoices: openRecs.length,
       outstandingBalance: outstanding,
       lastPaymentDate: lastPaid,
       nextDueDate: nextDue,
       activeDisputes: disputes
    };
  },

  // 2. INVOICE ACCESS (Filtered)
  getInvoices: async (user: User): Promise<Invoice[]> => {
    if (user.role !== UserRole.CLIENT_VIEW || !user.linkedEntityId) throw new Error("Unauthorized");
    const all = await billingService.getInvoices(user.linkedEntityId);
    // Hide DRAFT and VOID from client
    return all.filter(i => i.status !== InvoiceStatus.DRAFT && i.status !== InvoiceStatus.VOID);
  },

  getReceivables: async (user: User): Promise<Receivable[]> => {
    if (user.role !== UserRole.CLIENT_VIEW || !user.linkedEntityId) throw new Error("Unauthorized");
    return billingService.getReceivables(user.linkedEntityId);
  },

  getPayments: async (user: User): Promise<any[]> => {
    // This requires iterating all receivables to get history. Expensive but safe.
    if (user.role !== UserRole.CLIENT_VIEW || !user.linkedEntityId) throw new Error("Unauthorized");
    const recs = await billingService.getReceivables(user.linkedEntityId);
    let allPayments: CollectionRecord[] = [];
    
    for (const r of recs) {
       const history = await collectionService.getHistory(r.id);
       allPayments = [...allPayments, ...history];
    }
    
    // Sort desc
    return allPayments.sort((a,b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  },

  // 3. ACTIONS
  payInvoice: async (user: User, receivableId: string, amount: number): Promise<void> => {
     // 1. Generate Link / Simulate
     // 2. Process
     // Currently we simulate instant success for the "Pay Now" button in portal
     
     // Log Attempt
     await complianceService.logEvent('PORTAL_PAYMENT', user, `Initiating Payment for ${receivableId}`, { amount });

     // Simulate Razorpay Interaction
     // In real app, this returns an order_id, frontend uses checkout.js, then webhook calls backend.
     // Here we simulate the full loop.
     
     const ref = `RZ_PORTAL_${Date.now()}`;
     // Calls collectionService which now allows CLIENT_VIEW if Mode is RAZORPAY
     await collectionService.processPayment(
        user,
        receivableId,
        amount,
        'RAZORPAY' as any,
        ref,
        new Date().toISOString()
     );
  },

  raiseDispute: async (user: User, invoiceId: string, reason: string): Promise<void> => {
     if (user.role !== UserRole.CLIENT_VIEW || !user.linkedEntityId) throw new Error("Unauthorized");
     
     // Verify ownership
     const invoices = await billingService.getInvoices(user.linkedEntityId);
     const inv = invoices.find(i => i.id === invoiceId);
     if (!inv) throw new Error("Invoice not found or access denied.");
     
     if (inv.status !== InvoiceStatus.SENT && inv.status !== InvoiceStatus.GENERATED) {
        throw new Error("Cannot dispute this invoice.");
     }

     // Wrap billing service (which checks for Founder usually, so we might need a bypass or specific method)
     // billingService.raiseDispute requires FOUNDER? No, it requires a user.
     // Let's check billingService... it logs 'BILLING_OP'.
     // It does NOT strictly check role in raiseDispute, but we should verify.
     // Checking billingService.ts... `raiseDispute` does NOT check for founder. It just logs.
     // Good.
     
     await billingService.raiseDispute(user, invoiceId, reason);
  },

  downloadInvoice: async (user: User, invoiceId: string) => {
     if (user.role !== UserRole.CLIENT_VIEW || !user.linkedEntityId) throw new Error("Unauthorized");
     const csv = await billingService.getInvoiceCsv(invoiceId);
     
     await complianceService.logEvent('PORTAL_ACCESS', user, `Downloaded Invoice ${invoiceId}`, {});
     return csv;
  }
};
