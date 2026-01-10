
import { 
  Invoice, 
  InvoiceStatus, 
  User, 
  UserRole, 
  Shipment, 
  ShipmentStatus, 
  PaymentMode,
  Client,
  Receivable,
  ReceivableStatus,
  FinancialNote,
  NoteType,
  NoteStatus
} from '../types';
import { complianceService } from './complianceService';
import { shipmentService } from './shipmentService';
import { clientService } from './clientService';
import { rateCardService } from './rateCardService';
import { authService } from './authService';

const INVOICE_KEY = 'fendex_invoices_db';
const RECEIVABLE_KEY = 'fendex_receivables_db';
const NOTES_KEY = 'fendex_financial_notes_db';

const getInvoicesDb = (): Invoice[] => {
  const stored = localStorage.getItem(INVOICE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveInvoicesDb = (data: Invoice[]) => {
  localStorage.setItem(INVOICE_KEY, JSON.stringify(data));
};

const getReceivablesDb = (): Receivable[] => {
  const stored = localStorage.getItem(RECEIVABLE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveReceivablesDb = (data: Receivable[]) => {
  localStorage.setItem(RECEIVABLE_KEY, JSON.stringify(data));
};

const getNotesDb = (): FinancialNote[] => {
  const stored = localStorage.getItem(NOTES_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveNotesDb = (data: FinancialNote[]) => {
  localStorage.setItem(NOTES_KEY, JSON.stringify(data));
};

export const billingService = {
  
  getInvoices: async (clientId?: string): Promise<Invoice[]> => {
    await new Promise(r => setTimeout(r, 200));
    const all = getInvoicesDb();
    if (clientId) return all.filter(i => i.clientId === clientId);
    return all.sort((a,b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  },

  getReceivables: async (clientId?: string): Promise<Receivable[]> => {
    await new Promise(r => setTimeout(r, 200));
    const all = getReceivablesDb();
    if (clientId) return all.filter(r => r.clientId === clientId);
    return all.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getNotes: async (clientId?: string): Promise<FinancialNote[]> => {
    await new Promise(r => setTimeout(r, 200));
    const all = getNotesDb();
    if (clientId) return all.filter(n => n.clientId === clientId);
    return all.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  // 1. BILLING ELIGIBILITY CHECK
  getBillableShipments: async (
    user: User,
    clientId: string,
    start: string,
    end: string
  ): Promise<{ shipments: Shipment[], totalFees: number }> => {
    
    // Fetch all shipments
    const allShipments = await shipmentService.getShipments({ role: UserRole.FOUNDER } as any);
    const invoices = getInvoicesDb();
    
    // Gather already billed IDs
    const billedIds = new Set<string>();
    invoices.forEach(inv => {
       if (inv.status !== InvoiceStatus.VOID) {
          inv.shipmentIds.forEach(id => billedIds.add(id));
       }
    });

    const startDate = new Date(start).setHours(0,0,0,0);
    const endDate = new Date(end).setHours(23,59,59,999);

    const candidates = allShipments.filter(s => {
       if (s.clientId !== clientId) return false;
       // Only DELIVERED or RTO (Closed) are billable
       if (s.status !== ShipmentStatus.DELIVERED && s.status !== ShipmentStatus.RTO) return false;
       
       if (billedIds.has(s.id)) return false; // Already billed

       const dateStr = s.updatedAt; // Billing based on closure date
       const d = new Date(dateStr).getTime();
       return d >= startDate && d <= endDate;
    });

    // Calculate Fees Preview
    let totalFees = 0;
    for (const s of candidates) {
       const fees = await rateCardService.calculateClientFees({
          clientId,
          shipmentType: s.shipmentType,
          geoType: s.geoType,
          status: s.status,
          paymentMode: s.paymentMode,
          codAmount: s.codAmount,
          date: s.updatedAt
       });
       totalFees += fees.totalDeductions;
    }

    return { shipments: candidates, totalFees };
  },

  // 2. CREATE DRAFT INVOICE
  createDraftInvoice: async (
    user: User,
    clientId: string,
    period: { start: string, end: string },
    shipments: Shipment[]
  ): Promise<Invoice> => {
    
    if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) {
       throw new Error('Unauthorized');
    }

    if (shipments.length === 0) throw new Error('No shipments to bill.');

    const client = (await clientService.getClients()).find(c => c.id === clientId);
    if (!client) throw new Error('Client not found');

    let subtotal = 0;
    let codTotal = 0;

    for (const s of shipments) {
       const fees = await rateCardService.calculateClientFees({
          clientId,
          shipmentType: s.shipmentType,
          geoType: s.geoType,
          status: s.status,
          paymentMode: s.paymentMode,
          codAmount: s.codAmount,
          date: s.updatedAt
       });
       subtotal += fees.totalDeductions;
       if (s.paymentMode === PaymentMode.COD && s.status === ShipmentStatus.DELIVERED) {
          codTotal += s.codAmount;
       }
    }

    const tax = subtotal * 0.18; // 18% GST Hardcoded
    const totalAmount = subtotal + tax;
    const netPayable = totalAmount; // Invoice is for Services. Netting happens in settlement usually.

    const invoiceId = `INV-${Date.now()}`;
    const draft: Invoice = {
       id: invoiceId,
       clientId,
       clientName: client.name,
       billingPeriodStart: period.start,
       billingPeriodEnd: period.end,
       status: InvoiceStatus.DRAFT,
       subtotal,
       taxAmount: tax,
       totalAmount,
       codDetected: codTotal,
       netPayable,
       shipmentIds: shipments.map(s => s.id),
       generatedBy: user.id,
       generatedAt: new Date().toISOString()
    };

    const db = getInvoicesDb();
    db.unshift(draft);
    saveInvoicesDb(db);

    await complianceService.logEvent('BILLING_OP', user, `Created Draft Invoice for ${client.name}`, { count: shipments.length, amount: totalAmount });

    return draft;
  },

  // 3. GENERATE (LOCK)
  generateInvoice: async (user: User, invoiceId: string): Promise<void> => {
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) throw new Error('Unauthorized');
     
     const db = getInvoicesDb();
     const idx = db.findIndex(i => i.id === invoiceId);
     if (idx === -1) throw new Error('Invoice not found');
     
     const inv = db[idx];
     if (inv.status !== InvoiceStatus.DRAFT) throw new Error('Only Drafts can be Generated');

     inv.status = InvoiceStatus.GENERATED;
     // Assign Invoice Number
     const year = new Date().getFullYear();
     const seq = db.filter(i => i.status !== InvoiceStatus.DRAFT && i.status !== InvoiceStatus.VOID).length + 1;
     inv.invoiceNumber = `INV/${year}/${seq.toString().padStart(4, '0')}`;

     saveInvoicesDb(db);
     await complianceService.logEvent('BILLING_OP', user, `Generated Invoice ${inv.invoiceNumber}`, { id: invoiceId });
  },

  // 4. SEND (Trigger Receivable)
  sendInvoice: async (user: User, invoiceId: string): Promise<void> => {
     const db = getInvoicesDb();
     const idx = db.findIndex(i => i.id === invoiceId);
     if (idx === -1) throw new Error('Invoice not found');
     
     const inv = db[idx];
     if (inv.status !== InvoiceStatus.GENERATED) throw new Error('Must be GENERATED to Send');

     inv.status = InvoiceStatus.SENT;
     inv.sentAt = new Date().toISOString();
     saveInvoicesDb(db);
     
     // CREATE RECEIVABLE
     const receivables = getReceivablesDb();
     // Default 15 days due
     const dueDate = new Date();
     dueDate.setDate(dueDate.getDate() + 15);

     receivables.unshift({
        id: `REC-${inv.id}`,
        invoiceId: inv.id,
        clientId: inv.clientId,
        invoiceNumber: inv.invoiceNumber || '',
        totalAmount: inv.totalAmount,
        amountPaid: 0,
        creditApplied: 0,
        debitApplied: 0,
        balance: inv.totalAmount,
        dueDate: dueDate.toISOString(),
        status: ReceivableStatus.OPEN,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
     });
     saveReceivablesDb(receivables);
     
     // Simulate Email
     console.log(`[EMAIL] Sending Invoice ${inv.invoiceNumber} to Client ${inv.clientId}`);
     
     await complianceService.logEvent('BILLING_OP', user, `Sent Invoice ${inv.invoiceNumber} & Created Receivable`, {});
  },

  // 5. MARK PAID / RECORD PAYMENT
  // Updated to handle negative amounts for reversals
  recordPayment: async (user: User, receivableId: string, amount: number, ref: string): Promise<void> => {
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) throw new Error('Unauthorized');
     
     // Note: Negative amount implies reversal, allowed here.
     
     const recDb = getReceivablesDb();
     const idx = recDb.findIndex(r => r.id === receivableId);
     if (idx === -1) throw new Error('Receivable not found');
     
     const rec = recDb[idx];
     
     // Only check disputed/overpayment for POSITIVE payments
     if (amount > 0) {
        if (rec.status === ReceivableStatus.DISPUTED) throw new Error('Cannot pay DISPUTED receivable.');
        if (rec.balance < amount) throw new Error(`Overpayment. Balance is ₹${rec.balance}`);
     }

     rec.amountPaid += amount;
     rec.balance -= amount;
     rec.updatedAt = new Date().toISOString();

     if (rec.balance <= 0.01) { // Floating point tolerance
        rec.balance = 0;
        rec.status = ReceivableStatus.PAID;
        
        // Update Linked Invoice
        const invDb = getInvoicesDb();
        const invIdx = invDb.findIndex(i => i.id === rec.invoiceId);
        if (invIdx !== -1) {
           invDb[invIdx].status = InvoiceStatus.PAID;
           invDb[invIdx].paidAt = new Date().toISOString();
           invDb[invIdx].paymentRef = ref;
           saveInvoicesDb(invDb);
        }
     } else {
        // If balance restored (Reversal), move back to Partial or Open
        if (rec.amountPaid > 0) {
           rec.status = ReceivableStatus.PARTIALLY_PAID;
        } else {
           rec.status = ReceivableStatus.OPEN;
        }
     }

     saveReceivablesDb(recDb);
     
     // Log mainly for debugging, primary audit is in CollectionService
     // console.log(`[BILLING] Balance Adjusted: ${amount} for ${rec.invoiceNumber}`);
  },

  // 6. DISPUTE
  raiseDispute: async (user: User, invoiceId: string, reason: string): Promise<void> => {
     const db = getInvoicesDb();
     const idx = db.findIndex(i => i.id === invoiceId);
     if (idx === -1) throw new Error('Invoice not found');
     
     const inv = db[idx];
     if (inv.status === InvoiceStatus.PAID || inv.status === InvoiceStatus.VOID) throw new Error('Cannot dispute finalized invoice');

     inv.status = InvoiceStatus.DISPUTED;
     inv.disputeReason = reason;
     saveInvoicesDb(db);

     // Sync Receivable
     const recDb = getReceivablesDb();
     const recIdx = recDb.findIndex(r => r.invoiceId === invoiceId);
     if (recIdx !== -1) {
        recDb[recIdx].status = ReceivableStatus.DISPUTED;
        saveReceivablesDb(recDb);
     }

     await complianceService.logEvent('BILLING_OP', user, `Disputed Invoice ${inv.invoiceNumber}`, { reason });
  },

  resolveDispute: async (user: User, invoiceId: string, resolution: 'ACCEPT_ORIGINAL' | 'VOID'): Promise<void> => {
     if (user.role !== UserRole.FOUNDER) throw new Error('Only Founder can resolve disputes');
     
     const db = getInvoicesDb();
     const idx = db.findIndex(i => i.id === invoiceId);
     if (idx === -1) throw new Error('Invoice not found');
     
     const inv = db[idx];
     if (inv.status !== InvoiceStatus.DISPUTED) throw new Error('Invoice not in Dispute');

     // Sync Receivable
     const recDb = getReceivablesDb();
     const recIdx = recDb.findIndex(r => r.invoiceId === invoiceId);

     if (resolution === 'ACCEPT_ORIGINAL') {
        inv.status = InvoiceStatus.SENT; // Revert to Sent
        inv.disputeReason = undefined;
        if (recIdx !== -1) {
           // Revert to OPEN or PARTIAL depending on payment
           recDb[recIdx].status = recDb[recIdx].amountPaid > 0 ? ReceivableStatus.PARTIALLY_PAID : ReceivableStatus.OPEN;
        }
     } else {
        inv.status = InvoiceStatus.VOID; 
        if (recIdx !== -1) {
           // Voiding receivable
           recDb[recIdx].balance = 0;
           recDb[recIdx].status = ReceivableStatus.PAID; 
        }
     }
     
     saveInvoicesDb(db);
     if (recIdx !== -1) saveReceivablesDb(recDb);

     await complianceService.logEvent('BILLING_OP', user, `Resolved Dispute for ${inv.invoiceNumber}: ${resolution}`, {});
  },

  // 7. CREDIT / DEBIT NOTES
  createNote: async (user: User, data: { type: NoteType, invoiceId: string, amount: number, reason: string }): Promise<void> => {
     if (data.amount <= 0) throw new Error('Invalid Amount');
     const recDb = getReceivablesDb();
     const rec = recDb.find(r => r.invoiceId === data.invoiceId);
     if (!rec) throw new Error('Receivable not found for this Invoice');

     // Validation
     if (data.type === NoteType.CREDIT_NOTE) {
        if (data.amount > rec.balance) throw new Error('Credit Note exceeds balance');
     } else {
        if (rec.status === ReceivableStatus.PAID) throw new Error('Cannot issue Debit Note on fully paid invoice');
     }

     const notes = getNotesDb();
     const newNote: FinancialNote = {
        id: `NOTE-${Date.now()}`,
        noteNumber: `${data.type === NoteType.CREDIT_NOTE ? 'CN' : 'DN'}-${Date.now().toString().slice(-6)}`,
        type: data.type,
        invoiceId: data.invoiceId,
        clientId: rec.clientId,
        amount: data.amount,
        reason: data.reason,
        status: user.role === UserRole.FOUNDER ? NoteStatus.ISSUED : NoteStatus.PENDING_APPROVAL,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        approvedBy: user.role === UserRole.FOUNDER ? user.id : undefined,
        approvedAt: user.role === UserRole.FOUNDER ? new Date().toISOString() : undefined
     };

     notes.unshift(newNote);
     saveNotesDb(notes);

     await complianceService.logEvent('NOTE_OP', user, `Created ${data.type} ${newNote.noteNumber}`, { amount: data.amount });
  },

  approveNote: async (user: User, noteId: string): Promise<void> => {
     authService.requireRole(user, UserRole.FOUNDER);
     const notes = getNotesDb();
     const idx = notes.findIndex(n => n.id === noteId);
     if (idx === -1) throw new Error('Note not found');
     
     if (notes[idx].status !== NoteStatus.PENDING_APPROVAL) throw new Error('Note not pending approval');
     
     notes[idx].status = NoteStatus.ISSUED;
     notes[idx].approvedBy = user.id;
     notes[idx].approvedAt = new Date().toISOString();
     
     saveNotesDb(notes);
     await complianceService.logEvent('NOTE_OP', user, `Approved Note ${notes[idx].noteNumber}`, {});
  },

  applyNote: async (user: User, noteId: string): Promise<void> => {
     // Finance can apply ISSUED notes
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.FINANCE_ADMIN) throw new Error('Unauthorized');

     const notes = getNotesDb();
     const nIdx = notes.findIndex(n => n.id === noteId);
     if (nIdx === -1) throw new Error('Note not found');
     const note = notes[nIdx];

     if (note.status !== NoteStatus.ISSUED) throw new Error('Note must be ISSUED to apply');

     const recDb = getReceivablesDb();
     const rIdx = recDb.findIndex(r => r.invoiceId === note.invoiceId);
     if (rIdx === -1) throw new Error('Receivable not found');
     
     const rec = recDb[rIdx];

     // Apply Logic
     if (note.type === NoteType.CREDIT_NOTE) {
        if (note.amount > rec.balance) throw new Error('Credit Note exceeds current balance');
        rec.creditApplied += note.amount;
        rec.balance -= note.amount;
     } else {
        rec.debitApplied += note.amount;
        rec.balance += note.amount;
     }

     rec.updatedAt = new Date().toISOString();
     
     // Check if settled
     if (rec.balance <= 0.01 && note.type === NoteType.CREDIT_NOTE) {
        rec.balance = 0;
        rec.status = ReceivableStatus.PAID;
        // Update Invoice
        const invDb = getInvoicesDb();
        const invIdx = invDb.findIndex(i => i.id === rec.invoiceId);
        if (invIdx !== -1) {
           invDb[invIdx].status = InvoiceStatus.PAID;
           invDb[invIdx].paidAt = new Date().toISOString();
           invDb[invIdx].paymentRef = `CN-OFFSET-${note.noteNumber}`;
           saveInvoicesDb(invDb);
        }
     }

     note.status = NoteStatus.APPLIED;
     note.appliedAt = new Date().toISOString();

     saveReceivablesDb(recDb);
     saveNotesDb(notes);

     await complianceService.logEvent('NOTE_OP', user, `Applied ${note.noteNumber} to Invoice`, { newBalance: rec.balance });
  },

  // Report Helper
  getInvoiceCsv: async (invoiceId: string): Promise<string> => {
     const db = getInvoicesDb();
     const inv = db.find(i => i.id === invoiceId);
     if (!inv) throw new Error("Invoice not found");

     // Fetch shipment details
     const allShipments = await shipmentService.getShipments({ role: UserRole.FOUNDER } as any);
     const details = allShipments.filter(s => inv.shipmentIds.includes(s.id));

     const headers = ['Invoice No', 'Client', 'AWB', 'Date', 'Type', 'Status', 'COD Amount'];
     const rows = details.map(s => [
        inv.invoiceNumber || 'DRAFT',
        inv.clientName,
        s.awb,
        new Date(s.updatedAt).toLocaleDateString(),
        s.shipmentType,
        s.status,
        s.paymentMode === PaymentMode.COD ? s.codAmount : 0
     ]);

     return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
};
