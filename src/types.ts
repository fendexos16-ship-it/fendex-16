
export enum UserRole {
  FOUNDER = 'FOUNDER',
  ADMIN = 'ADMIN',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  AREA_MANAGER = 'AREA_MANAGER',
  MMDC_MANAGER = 'MMDC_MANAGER',
  LMDC_MANAGER = 'LMDC_MANAGER',
  RIDER = 'RIDER',
  CLIENT = 'CLIENT',
  CLIENT_VIEW = 'CLIENT_VIEW',
  COURIER_PARTNER = 'COURIER_PARTNER',
  SALES_AGENT = 'SALES_AGENT'
}

export enum UserStatus {
  ACTIVE = 'Active',
  DISABLED = 'Disabled',
  LOCKED = 'Locked',
  DRAFT = 'Draft',
  RESET_REQUIRED = 'Reset_Required'
}

export interface User {
  id: string;
  username: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  passwordHash?: string;
  failedLoginAttempts: number;
  linkedEntityId?: string;
  linkedEntityType?: string;
  createdAt: string;
  createdBy?: string;
  lastLogin?: string;
  otp?: string;
  otpExpires?: number;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  credentials?: { username: string, tempPass: string };
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export enum ShipmentStatus {
  INBOUND = 'Inbound',
  ASSIGNED = 'Assigned',
  DELIVERED = 'Delivered',
  UNDELIVERED = 'Undelivered',
  RTO = 'RTO',
  CANCELLED = 'Cancelled',
  RVP_SCHEDULED = 'RVP_Scheduled',
  RVP_PICKED = 'RVP_Picked',
  RVP_QC_FAILED = 'RVP_QC_Failed'
}

export enum PaymentMode {
  COD = 'COD',
  PREPAID = 'Prepaid'
}

export enum GeoType {
  CITY = 'City',
  RURAL = 'Rural',
  METRO = 'Metro',
  TIER1 = 'Tier 1'
}

export enum LmdcShipmentType {
  DELIVERY = 'Delivery',
  FIRST_MILE = 'First Mile',
  REVERSE_PICKUP = 'Reverse Pickup'
}

export interface Shipment {
  id: string;
  awb: string;
  clientId?: string;
  linkedLmdcId: string;
  linkedDcId: string;
  destinationPincode: string;
  shipmentType: LmdcShipmentType;
  geoType: GeoType;
  status: ShipmentStatus;
  paymentMode: PaymentMode;
  codAmount: number;
  createdAt: string;
  updatedAt: string;
  assignedRiderId?: string;
  customerName?: string;
  customerAddress?: string;
  transactionId?: string;
  billedInvoiceId?: string;
}

export enum PayoutBatchStatus {
  LOCKED = 'Locked',
  FAILED = 'Failed',
  PROCESSING = 'Processing',
  EXECUTED_TEST = 'Executed_Test',
  EXECUTED_PRODUCTION = 'Executed_Production',
  PARTIAL_FAILURE = 'Partial_Failure'
}

export enum PaymentGateway {
  NONE = 'NONE',
  CASHFREE = 'CASHFREE',
  RAZORPAY = 'RAZORPAY'
}

export enum GatewayStatus {
  NA = 'N/A',
  SUCCESS = 'Success',
  FAILED = 'Failed'
}

export interface PayoutBatch {
  id: string;
  role: 'LMDC' | 'RIDER';
  ledgerIds: string[];
  totalAmount: number;
  count: number;
  status: PayoutBatchStatus;
  approvedByUserId: string;
  approvedByName: string;
  approvedAt: string;
  cycleRangeStart?: string;
  cycleRangeEnd?: string;
  payoutDate?: string;
  gatewaySelected?: PaymentGateway;
  gateway?: PaymentGateway;
  gatewayStatus?: GatewayStatus;
  gatewayRef?: string;
  razorpayBatchId?: string;
  executedAt?: string;
}

export interface CodDeposit {
  id: string;
  lmdcId: string;
  depositDate: string;
  declaredAmount: number;
  mode: CodDepositMode;
  referenceNo: string;
  shipmentIds: string[];
  createdBy: string;
  createdAt: string;
  status: 'PENDING' | 'SETTLED' | 'MISMATCH';
  reconciledAt?: string;
  reconciledBy?: string;
}

export interface SlaRecord {
  id: string;
  shipmentId: string;
  riderId: string;
  lmdcId: string;
  promisedDate: string;
  actualDeliveryDate: string;
  slaState: SlaState;
  slaBucket: SlaBucket;
  breachReason?: string;
  calculatedAt: string;
}

export enum SlaState {
  SLA_MET = 'SLA_Met',
  SLA_BREACHED = 'SLA_Breached',
  SLA_EXEMPTED = 'SLA_Exempted'
}

export enum SlaBucket {
  NA = 'N/A',
  D0 = 'D0',
  D1 = 'D1',
  D2_PLUS = 'D2+'
}

export interface LastMileDC {
  id: string;
  code: string;
  name: string;
  linkedMmdcId: string;
  linkedDcId: string;
  linkedCityId?: string;
  city: string;
  ownerName?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  bankAccount?: string;
  ifsc?: string;
  gst?: string;
  pan?: string;
  status: 'Active' | 'Inactive';
}

export interface MMDC {
  id: string;
  code: string;
  name: string;
  linkedDcId: string;
  linkedCityId?: string;
  city: string;
  status: 'Active' | 'Inactive';
  managerName?: string;
  phone?: string;
}

export interface DistributionCenter {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  status: 'Active' | 'Inactive';
}

export enum RunsheetStatus {
  CREATED = 'Created',
  IN_PROGRESS = 'In_Progress',
  COMPLETED = 'Completed',
  CLOSED = 'Closed',
  ABANDONED = 'Abandoned'
}

export type RunsheetType = 'FWD' | 'FM' | 'RVP';

export interface Runsheet {
  id: string;
  runsheetCode: string;
  type: RunsheetType;
  lmdcId: string;
  riderId: string;
  shipmentIds: string[];
  pickupIds?: string[];
  status: RunsheetStatus;
  createdBy: string;
  createdAt: string;
  closedAt?: string;
  abandonedReason?: string;
}

export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  altPhone?: string;
  address?: string;
  linkedLmdcId: string;
  status: 'Active' | 'Draft' | 'Inactive';
  panNumber?: string;
  panName?: string;
  panProofUrl?: string;
  accountHolderName?: string;
  bankAccount?: string;
  ifsc?: string;
  bankName?: string;
  bankProofUrl?: string;
  capacityProfile?: RiderCapacityProfile;
  tier?: RiderTier;
}

export interface RiderCapacityProfile {
  riderId: string;
  maxFwd: number;
  maxFm: number;
  maxRvp: number;
  isOverridden: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export enum RiderTier {
  TIER_1 = 'TIER_1',
  TIER_2 = 'TIER_2',
  TIER_3 = 'TIER_3'
}

export const SYSTEM_HARD_CAPS = {
  FWD: 3,
  FM: 2,
  RVP: 1
};

export interface LmdcRateCard {
  id: string;
  name: string;
  clientId?: string;
  linkedDcId: string;
  linkedLmdcId?: string;
  geoType: GeoType;
  shipmentType: LmdcShipmentType;
  amount: number;
  status: 'Active' | 'Inactive';
  effectiveDate: string;
}

export interface RiderRateCard {
  id: string;
  name: string;
  linkedDcId: string;
  linkedLmdcId?: string;
  geoType: GeoType;
  jobType: RiderJobType;
  amount: number;
  status: 'Active' | 'Inactive';
  effectiveDate: string;
}

export enum RiderJobType {
  DELIVERY = 'Delivery',
  PICKUP = 'Pickup',
  REVERSE_PICKUP = 'Reverse Pickup'
}

export interface RateCalculationResult {
  amount: number;
  reason: string;
  appliedRateId?: string;
}

export enum SlaMetric {
  D0 = 'D0',
  D1 = 'D1',
  RTO = 'RTO',
  FAD = 'FAD',
  COD_TAT = 'COD_TAT'
}

export interface SlaPricingRule {
  id: string;
  metric: SlaMetric;
  condition: 'LESS_THAN' | 'GREATER_THAN';
  threshold: number; // e.g., 90 (percent) or 24 (hours)
  type: 'PREMIUM' | 'PENALTY';
  adjustmentType: 'FLAT' | 'PERCENTAGE';
  value: number; // Amount or Percent
}

export interface ClientRateCard {
  id: string;
  clientId: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  effectiveDate: string;
  expiryDate?: string;
  rules: ClientRateRule[];
  slaRules?: SlaPricingRule[]; 
  slaCapPercent?: number; 
  createdAt?: string;
  createdBy?: string;
}

export interface ClientRateRule {
  geoType: GeoType;
  shipmentType: LmdcShipmentType;
  baseRate: number;
  rtoRate: number;
  codFeeType: FeeType;
  codFeeValue: number;
}

export enum FeeType {
  PERCENTAGE = 'Percentage',
  FLAT = 'Flat'
}

export interface FeeCalculationResult {
  freightAmount: number;
  codFee: number;
  rtoFee: number;
  platformFee: number;
  totalDeductions: number;
  appliedRateCardId?: string;
}

export interface PincodeMaster {
  pincode: string;
  city: string;
  state: string;
  zone: ZoneType;
  serviceable: boolean;
  linkedLmdcId?: string;
}

export enum ZoneType {
  METRO = 'Metro',
  URBAN = 'Urban',
  SEMI_URBAN = 'Semi-Urban',
  RURAL = 'Rural'
}

// PARTNER TYPES
export enum ClientType {
  AGGREGATOR = 'AGGREGATOR',
  COURIER = 'COURIER',
  ENTERPRISE_DIRECT = 'ENTERPRISE_DIRECT',
  SME_LOCAL = 'SME_LOCAL'
}

export enum ClientStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  TESTING = 'TESTING',
  LIVE = 'LIVE',
  PAUSED = 'PAUSED'
}

export interface OnboardingChecklist {
  legalNameVerified: boolean;
  contactPersonVerified: boolean;
  billingCycleSet: boolean;
  taxDetailsVerified: boolean;
  rateCardBound: boolean;
  apiCredentialsGenerated?: boolean;
  webhookConfigured?: boolean;
  ipWhitelisted?: boolean;
  pickupSlaAgreed?: boolean;
  creditLimitSet?: boolean;
}

export interface TechnicalReadiness {
  webhookSignatureVerified: boolean;
  testShipmentLifecyclePassed: boolean;
  billingPreviewGenerated: boolean;
  invoiceSampleApproved: boolean;
  lastTestRunAt?: string;
}

export interface Client {
  id: string;
  clientCode: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  billingMode: BillingMode;
  phone: string;
  defaultEnv: 'TEST' | 'LIVE';
  labelAuthority: LabelAuthority;
  contractRate?: number;
  walletBalance?: number;
  portalEnabled: boolean;
  webhookConfig?: WebhookConfig;
  credentials?: ClientApiCredentials;
  permissions?: ClientPermissions;
  createdBy: string;
  createdAt: string;
  settlementCycle?: SettlementCycle;
  apiConfig?: { apiKey: string }; 
  reminderChannels?: ReminderChannel[];
  onboardingChecklist?: OnboardingChecklist;
  technicalReadiness?: TechnicalReadiness;
  documentsSigned?: string[];
}

export enum LabelAuthority {
  FENDEX_ONLY = 'FENDEX_ONLY',
  CLIENT_ALLOWED = 'CLIENT_ALLOWED'
}

export enum BillingMode {
  PREPAID = 'Prepaid',
  POSTPAID = 'Postpaid',
  COD = 'COD',
  HYBRID = 'Hybrid'
}

export interface ClientApiCredentials {
  id: string;
  clientId: string;
  provider: string; 
  environment: 'TEST' | 'LIVE';
  authType: 'API_KEY' | 'OAUTH';
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  createdAt: string;
  isActive?: boolean;
}

export interface ClientPermissions {
  clientId: string;
  canCreateShipment: boolean;
  canPullOrders: boolean;
  canPushStatus: boolean;
  canReceiveWebhooks: boolean;
  canGenerateLabel: boolean;
}

export interface ClientLedgerEntry {
  id: string;
  batchId?: string;
  clientId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceAfter: number;
  reason: string;
  referenceId?: string;
  shipmentId?: string;
  timestamp: string;
  actorId: string;
  codAmount?: number;
  freightAmount?: number;
  codFee?: number;
  feeAmount?: number;
}

export interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  failureCount: number;
  lastFailureAt?: string;
}

export interface ComplianceLog {
  id: string;
  timestamp: string;
  eventType: string;
  actorId: string;
  actorRole: string;
  description: string;
  metadata: string;
  integrityHash: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
}

export interface ApiAuditLog {
  timestamp: string;
  clientId: string;
  action: string;
  provider: string;
  requestId: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  reason?: string;
}

export interface LmdcLedgerEntry {
  id: string;
  shipmentId: string;
  dcId: string;
  lmdcId: string;
  shipmentType: LmdcShipmentType | string;
  shipmentStatus: ShipmentStatus;
  appliedRate: number;
  calculatedAmount: number;
  ledgerStatus: LedgerStatus;
  paymentMode: PaymentMode;
  codAmount: number;
  createdAt: string;
  payoutBatchId?: string;
  razorpayPayoutId?: string;
}

export interface RiderLedgerEntry {
  id: string;
  shipmentId: string;
  runsheetId?: string;
  riderId: string;
  dcId: string;
  lmdcId: string;
  jobType: RiderJobType;
  shipmentStatus: ShipmentStatus;
  appliedRate: number;
  calculatedAmount: number;
  ledgerStatus: LedgerStatus;
  paymentMode: PaymentMode;
  codAmount: number;
  createdAt: string;
  payoutBatchId?: string;
  razorpayPayoutId?: string;
}

export enum LedgerStatus {
  OPEN = 'Open',
  LOCKED = 'Locked',
  APPROVED = 'Approved',
  PROCESSING = 'Processing',
  PAID = 'Paid',
  FAILED = 'Failed',
  VOID = 'Void',
  ON_HOLD = 'On_Hold'
}

export type LedgerEntry = LmdcLedgerEntry | RiderLedgerEntry;

export interface CodRecord {
  id: string;
  shipmentId: string;
  riderId: string;
  lmdcId: string;
  codAmount: number;
  state: CodState;
  collectedAt?: string;
  handoverBatchId?: string;
  depositId?: string;
  verifiedAt?: string; 
  reconciledAt?: string;
}

export enum CodState {
  COD_PENDING = 'COD_PENDING',
  COD_COLLECTED = 'COD_COLLECTED',
  COD_HANDOVER_INITIATED = 'COD_HANDOVER_INITIATED',
  COD_RECEIVED_LMDC = 'COD_RECEIVED_LMDC',
  COD_VERIFIED = 'COD_VERIFIED',
  COD_DEPOSITED = 'COD_DEPOSITED',
  COD_SETTLED = 'COD_SETTLED',
  COD_SHORT = 'COD_SHORT'
}

export enum CodDepositMode {
  BANK = 'Bank',
  CASH = 'Cash',
  CMS = 'CMS'
}

export interface CashHandoverBatch {
  id: string;
  riderId: string;
  lmdcId: string;
  shipmentIds: string[];
  declaredAmount: number;
  physicalAmount?: number;
  shortageAmount?: number;
  status: HandoverStatus;
  createdAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export enum HandoverStatus {
  CREATED = 'Created',
  RECEIVED = 'Received',
  VERIFIED = 'Verified',
  SHORTAGE_LOCKED = 'Shortage_Locked'
}

export interface CodAdjustment {
  id: string;
  entityType: 'RIDER' | 'LMDC';
  entityId: string;
  amount: number;
  reason: string;
  approvedBy: string;
  approvedAt: string;
  status: 'OPEN' | 'RECOVERED';
}

export interface CodWarning {
  id: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RiderExposure {
  riderId: string;
  name: string;
  lmdcId: string;
  cashOnHand: number;
  pendingVerification: number;
  shortage: number;
  lastCollection?: string;
  status: 'SAFE' | 'RISK' | 'BLOCKED';
}

export interface LmdcCmsConfig {
  lmdcId: string;
}

export interface CodTiming {
}

export interface PayoutSummaryStats {
  totalPayable: number;
  executedAmount: number;
  pendingAmount: number;
  failedCount: number;
  failedAmount: number;
}

export interface ExceptionRecord {
  id: string;
  type: 'BATCH' | 'LEDGER';
  referenceId: string;
  amount: number;
  date: string;
  issue: string;
  founderNote?: string;
}

export interface LedgerReportRow {
  id: string;
  cycleId: string;
  awb: string;
  entityId: string;
  paymentMode: string;
  codAmount: number;
  rate: number;
  payoutAmount: number;
  status: string;
  gatewayRef: string;
  executedAt: string;
  freightAmount?: number;
  codFee?: number;
  rtoFee?: number;
  platformFee?: number;
  feeAmount?: number;
  netAmount?: number;
  codStatus?: string;
  cmsReference?: string;
  appliedRateCardId?: string;
}

export interface ClientSettlementRow {
  awb: string;
  deliveryDate: string;
  codAmount: number;
  freightAmount: number;
  codFee: number;
  rtoFee: number;
  platformFee: number;
  feeAmount: number;
  netAmount: number;
  codStatus: 'COLLECTED' | 'DEPOSITED' | 'PENDING';
  cmsReference?: string;
  appliedRateCardId?: string;
}

export interface ClientSettlementEntry extends ClientSettlementRow {
  id: string;
  batchId: string;
  clientId: string;
  shipmentId: string;
}

export interface ReconciliationRecord {
  id: string;
  gateway: PaymentGateway;
  transferId: string;
  referenceId: string;
  status: 'SUCCESS' | 'FAILED';
  amount: number;
  cycleId: string;
  executedAt: string;
  webhookVerified: boolean;
}

export interface SlaAdjustment {
  id: string;
  entityType: 'RIDER' | 'LMDC';
  entityId: string;
  adjustmentType: AdjustmentType;
  amount: number;
  ruleCode: string;
  linkedShipmentId: string;
  approvedBy: string;
  approvedAt: string;
  notes?: string;
}

export enum AdjustmentType {
  PENALTY = 'Penalty',
  INCENTIVE = 'Incentive'
}

export interface IdempotencyRecord {
  key: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  expiresAt: string;
  resultHash?: string;
}

export interface ExecutionLock {
  key: string;
  owner: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface CircuitBreakerState {
  gateway: string;
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failCount: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
}

export interface BackupRecord {
  id: string;
  timestamp: string;
  sizeBytes: number;
  type: 'FULL' | 'INCREMENTAL';
  createdBy: string;
  checksum: string;
}

export interface CashfreeBeneficiary {
  entityType: 'LMDC' | 'RIDER';
  entityId: string;
  beneId: string;
  bankAccount: string;
  ifsc: string;
  verified: boolean;
  addedAt: string;
}

export interface BankDisbursement {
  disbursement_id: string;
  payout_batch_id: string;
  beneficiary_id: string;
  entity_id: string;
  role: 'LMDC' | 'RIDER';
  amount: number;
  currency: string;
  method: string;
  status: 'PENDING' | 'INITIATED' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  created_at: string;
  updated_at: string;
  cashfree_transfer_id?: string;
  bank_reference?: string;
  status_description?: string;
}

export interface CashfreeWebhookEvent {
  type: 'TRANSFER_SUCCESS' | 'TRANSFER_FAILED' | 'TRANSFER_REVERSED';
  reference_id: string;
  data: {
    transfer: {
      bank_reference_num?: string;
      reason?: string;
    }
  };
}

export interface RazorpayBeneficiary {
  entityType: 'LMDC' | 'RIDER';
  entityId: string;
  contactId: string;
  fundAccountId: string;
  bankAccount: string;
  ifsc: string;
  status: 'ACTIVE' | 'INACTIVE';
  addedAt: string;
}

export interface GatewayCredential {
  id: string;
  provider: GatewayProvider;
  environment: GatewayEnvironment;
  clientId: string;
  clientSecretEnc: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export enum GatewayProvider {
  CASHFREE = 'CASHFREE',
  RAZORPAY = 'RAZORPAY',
  CUSTOM = 'CUSTOM'
}

export enum GatewayEnvironment {
  TEST = 'TEST',
  PROD = 'PROD'
}

export interface ClientSettlementBatch {
  id: string;
  clientId: string;
  clientName: string;
  batchCode: string;
  cycle: SettlementCycle;
  periodStart: string;
  periodEnd: string;
  totalCodAmount: number;
  totalFees: number;
  netAmount: number;
  shipmentCount: number;
  status: SettlementState;
  generatedBy: string;
  generatedAt: string;
  bankReference?: string;
  notes?: string;
  sharedAt?: string;
  settledAt?: string;
}

export enum SettlementState {
  DRAFT = 'Draft',
  SHARED = 'Shared',
  CONFIRMED = 'Confirmed',
  SETTLED = 'Settled'
}

export enum SettlementCycle {
  DAILY = 'Daily',
  WEEKLY = 'Weekly',
  MONTHLY = 'Monthly'
}

export interface Bag {
  id: string;
  bagCode: string;
  mmdcId: string;
  type: BagType;
  status: BagStatus;
  originEntityId: string;
  destinationEntityId: string;
  manifestCount: number;
  actualCount: number;
  shortageCount: number;
  damageCount: number;
  shipmentIds: string[];
  createdBy: string;
  createdAt: string;
  sealNumber?: string;
  sealedAt?: string;
  receivedAt?: string;
  currentTripId?: string;
  dispatchedAt?: string;
  currentConnectionSheetId?: string;
  openedAt?: string;
}

export enum BagStatus {
  CREATED = 'Created',
  SEALED = 'Sealed',
  DISPATCHED = 'Dispatched',
  IN_TRANSIT = 'In_Transit',
  INBOUND_RECEIVED = 'Inbound_Received',
  OPENED = 'Opened',
  CONNECTED = 'Connected',
  SHORTAGE_MARKED = 'Shortage_Marked',
  DAMAGE_MARKED = 'Damage_Marked',
  RECEIVED = 'Received'
}

export enum BagType {
  OUTBOUND = 'OUTBOUND',
  FIRST_MILE = 'FIRST_MILE',
  RTO = 'RTO',
  INBOUND = 'INBOUND'
}

export interface BagException {
  id: string;
  bagId: string;
  tripId?: string;
  type: ExceptionType;
  shipmentId?: string;
  description: string;
  reportedBy: string;
  reportedAt: string;
}

export enum ExceptionType {
  SHORTAGE = 'Shortage',
  DAMAGE = 'Damage',
  EXCESS = 'Excess'
}

export interface Trip {
  id: string;
  tripCode: string;
  originEntityId: string;
  destinationEntityId: string;
  tripSource: TripSource;
  vehicleNumber: string;
  vehicleType?: VehicleType;
  transporterName?: string;
  driverName?: string;
  driverPhone?: string;
  bagIds: string[];
  connectionSheetIds?: string[];
  status: TripStatus;
  createdBy: string;
  createdAt: string;
  dispatchedAt?: string;
  arrivedAt?: string;
  receivedAt?: string;
  closedAt?: string;
  externalProvider?: string;
}

export enum TripStatus {
  CREATED = 'Created',
  IN_TRANSIT = 'In_Transit',
  ARRIVED = 'Arrived',
  UNLOADING = 'Unloading',
  RECEIVED = 'Received',
  INBOUND_COMPLETED = 'Inbound_Completed',
  CLOSED = 'Closed'
}

export enum TripSource {
  INTERNAL_TRANSFER = 'Internal_Transfer',
  COURIER_3PL = 'Courier_3PL',
  AGGREGATOR = 'Aggregator',
  ENTERPRISE_DIRECT = 'Enterprise_Direct'
}

export enum VehicleType {
  TRUCK = 'Truck',
  VAN = 'Van',
  BIKE = 'Bike'
}

export interface ConnectionSheet {
  id: string;
  code: string;
  mmdcId: string;
  destinationId: string;
  destinationType: 'LMDC' | 'DC' | 'MMDC' | 'RTO';
  bagIds: string[];
  status: 'CREATED' | 'IN_PROGRESS' | 'CLOSED' | 'DISPATCHED';
  createdBy: string;
  createdAt: string;
  closedAt?: string;
  dispatchedAt?: string;
}

export interface PickupRequest {
  id: string;
  lmdcId: string;
  clientId: string;
  address: string;
  expectedCount: number;
  status: PickupStatus;
  assignedRiderId?: string;
  createdBy: string;
  createdAt: string;
  pickedAt?: string;
}

export enum PickupStatus {
  SCHEDULED = 'SCHEDULED',
  ASSIGNED = 'ASSIGNED',
  PICKED = 'PICKED',
  CANCELLED = 'CANCELLED'
}

export interface IncidentState {
  active: boolean;
  reason?: string;
  startedAt?: string;
  startedBy?: string;
}

export interface BackupConfig {
  dbSchedule: 'HOURLY' | 'DAILY';
  storageSchedule: 'DAILY';
  retentionDays: number;
  wormEnabled: boolean;
}

export interface DRStatus {
  region: string;
  role: 'PRIMARY' | 'STANDBY';
  health: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  replicationLagSeconds: number;
  lastBackupAt: string;
}

export interface RestoreDrill {
  id: string;
  scheduledDate: string;
  executedAt?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  verifiedBy?: string;
  notes?: string;
}

export interface SystemConfig {
  payoutEnvironment: SystemEnvironment;
  payoutProdEnabled: boolean;
  payoutProdEnabledAt?: string;
  payoutProdEnabledBy?: string;
  drRegion?: string;
  incidentMode?: IncidentState;
  backupConfig?: BackupConfig;
}

export enum SystemEnvironment {
  TEST = 'TEST',
  PRODUCTION = 'PRODUCTION'
}

export interface AtlasServiceArea {
  id: string;
  lmdcId: string;
  name: string;
  city: string;
  state: string;
  status: AtlasStatus;
  version: number;
  polygon: GeoPoint[];
  pincodes: string[];
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export enum AtlasStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  LOCKED = 'LOCKED',
  DISABLED = 'DISABLED'
}

export interface AtlasAuditLog {
  id: string;
  action: 'DRAW' | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'LOCK' | 'UNLOCK';
  lmdcId: string;
  entityId: string;
  actorId: string;
  role: string;
  timestamp: string;
  details: string;
}

export interface CapacityOverride {
  id: string;
  riderId: string;
  dcId: string;
  fwdLimit: number;
  fmLimit: number;
  rvpLimit: number;
  effectiveFrom: string;
  effectiveTo: string;
  reason: string;
  status: 'ACTIVE' | 'SUPERSEDED';
  createdBy: string;
  createdAt: string;
}

export interface RiderCapacityStatus {
  riderId: string;
  name: string;
  tier: RiderTier;
  defaultCapacity: { fwd: number, fm: number, rvp: number };
  activeOverride?: {
    fwd: number;
    fm: number;
    rvp: number;
    effectiveFrom: string;
    effectiveTo: string;
  };
  effectiveCapacity: {
    fwd: number;
    fm: number;
    rvp: number;
    source: 'OVERRIDE' | 'TIER';
  };
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  GENERATED = 'GENERATED',
  SENT = 'SENT',
  PAID = 'PAID',
  DISPUTED = 'DISPUTED',
  VOID = 'VOID'
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  clientId: string;
  clientName: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  status: InvoiceStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  codDetected: number;
  netPayable: number;
  shipmentIds: string[];
  slaAdjustments?: {
    ruleId: string;
    description: string;
    amount: number;
  }[];
  generatedBy: string;
  generatedAt: string;
  sentAt?: string;
  paidAt?: string;
  paymentRef?: string;
  disputeReason?: string;
}

export enum ReceivableStatus {
  OPEN = 'OPEN',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  DISPUTED = 'DISPUTED'
}

export interface Receivable {
  id: string;
  invoiceId: string;
  clientId: string;
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  creditApplied: number;
  debitApplied: number;
  balance: number;
  dueDate: string;
  status: ReceivableStatus;
  createdAt: string;
  updatedAt: string;
}

export enum NoteType {
  CREDIT_NOTE = 'CREDIT_NOTE',
  DEBIT_NOTE = 'DEBIT_NOTE'
}

export enum NoteStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ISSUED = 'ISSUED',
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED'
}

export interface FinancialNote {
  id: string;
  noteNumber: string;
  type: NoteType;
  invoiceId: string;
  clientId: string;
  amount: number;
  reason: string;
  status: NoteStatus;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  appliedAt?: string;
}

export enum CollectionMode {
  RAZORPAY = 'RAZORPAY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  CASH = 'CASH'
}

export interface CollectionRecord {
  id: string;
  receivableId: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  mode: CollectionMode;
  reference: string; 
  date: string;
  status: 'SUCCESS' | 'FAILED' | 'REVERSED';
  recordedBy: string; 
  recordedAt: string;
  gatewayPaymentId?: string; 
}

export interface AlertThreshold {
  id: string;
  metric: 'D0' | 'COD_TAT' | 'RTO_RATE';
  condition: 'LESS_THAN' | 'GREATER_THAN';
  value: number;
  isActive: boolean;
}

export interface PerformanceMetrics {
  total: number;
  delivered: number;
  rto: number;
  d0Percent: number;
  d1Percent: number;
  fadPercent: number; 
  rtoPercent: number;
  codPendingAmount: number;
  avgDeliveryTatHrs: number;
  avgCodVerifyHrs: number;
}

export enum ReminderChannel {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS'
}

export interface ReminderConfig {
  enabled: boolean;
  schedule: {
    beforeDueDays: number;
    overdueDays1: number;
    overdueDays2: number;
    escalationDays: number;
  };
  channels: ReminderChannel[];
  penalty: {
    enabled: boolean;
    type: 'FLAT' | 'PERCENTAGE';
    value: number;
    frequency: 'ONE_TIME';
  };
}

export interface ReminderLog {
  id: string;
  clientId: string;
  invoiceId: string;
  channel: ReminderChannel;
  template: string;
  sentAt: string;
  status: 'SENT' | 'FAILED';
}

export interface NorthStarMetrics {
  period: string; 
  avgDailyShipments: number;
  peakDailyShipments: number;
  grossRevenue: number;
  netRevenue: number;
  contributionMarginPercent: number;
  costPerDelivery: number;
  d0Percent: number;
  rtoPercent: number;
  avgCodTatDays: number;
  receivablesOutstanding: number;
  cashConversionCycleDays: number;
}

export interface UnitEconomics {
  id: string;
  label: string; 
  totalRevenue: number;
  riderCost: number;
  lmdcCost: number;
  hubCost: number;
  netContribution: number;
  marginPercent: number;
}

export interface InvestorSnapshot {
  id: string;
  generatedAt: string;
  generatedBy: string;
  periodStart: string;
  periodEnd: string;
  metricsHash: string; 
  metrics: NorthStarMetrics;
  unitEconomics: UnitEconomics[];
}

export enum CityStatus {
  PLANNED = 'PLANNED',
  LIVE = 'LIVE',
  PAUSED = 'PAUSED'
}

export interface CityOpsConfig {
  enableFm: boolean;
  enableRvp: boolean;
  enableCod: boolean;
  enableAggregators: boolean;
  enableEnterprise: boolean;
}

export interface City {
  id: string; 
  code: string; 
  name: string;
  state: string;
  region: string; 
  status: CityStatus;
  primaryMmdcId?: string; 
  opsConfig: CityOpsConfig;
  createdAt: string;
  createdBy: string;
  goLiveAt?: string;
  approvedBy?: string;
}

export enum SOPStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  ARCHIVED = 'ARCHIVED'
}

export enum IncidentSeverity {
  P0 = 'P0_CRITICAL',
  P1 = 'P1_HIGH',
  P2 = 'P2_MEDIUM',
  P3 = 'P3_LOW'
}

export interface SOP {
  id: string;
  code: string;
  title: string;
  version: number;
  status: SOPStatus;
  category: 'MMDC' | 'LMDC' | 'RIDER' | 'FINANCE' | 'HR' | 'TECH';
  targetRoles: UserRole[];
  content: {
    purpose: string;
    scope: string;
    preconditions: string[];
    steps: { order: number; action: string; note?: string }[];
    dos: string[];
    donts: string[];
    escalationRole: UserRole;
    auditReference: string;
  };
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface Runbook {
  id: string;
  code: string;
  title: string;
  severity: IncidentSeverity;
  category: 'OPS' | 'FINANCE' | 'TECH' | 'SECURITY';
  targetRoles: UserRole[];
  content: {
    immediateActions: string[];
    dataToCapture: string[];
    communicationTemplate: string;
    resolutionSteps: string[];
    closureCriteria: string;
  };
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface AcknowledgeLog {
  userId: string;
  docId: string;
  docVersion: number;
  timestamp: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface QueueJob {
  id: string;
  type: 'REPORT_GENERATION' | 'BULK_NOTIFICATION' | 'DATA_SYNC';
  payload: any;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  processedAt?: string;
  resultUrl?: string;
  error?: string;
}

export interface SystemMetric {
  timestamp: string;
  apiLatencyMs: number;
  cacheHitRate: number;
  queueDepth: number;
  costEstimate: number; 
}

export interface OptimizationConfig {
  enableCache: boolean;
  cacheTtlSeconds: number; 
  enableAsyncReports: boolean;
  costBudgetMonthly: number;
  alertThresholdPercent: number; 
}

export enum AnomalyCategory {
  OPS = 'OPS',
  CASH = 'CASH',
  FINANCE = 'FINANCE',
  SECURITY = 'SECURITY'
}

export enum AnomalySeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export interface Anomaly {
  id: string;
  category: AnomalyCategory;
  metric: string;
  entityId: string; 
  entityName: string;
  detectedAt: string;
  severity: AnomalySeverity;
  confidence: number; 
  baselineValue: number;
  observedValue: number;
  description: string;
  status: 'NEW' | 'ACKNOWLEDGED' | 'FALSE_POSITIVE' | 'TRUE_POSITIVE';
  feedbackNotes?: string;
}

export interface Baseline {
  id: string;
  entityId: string;
  metric: string;
  windowDays: number;
  mean: number;
  stdDev: number;
  lastUpdated: string;
}

export interface SalesDeckConfig {
  clientName: string;
  targetCity?: string;
  showPricing: boolean;
  generatedBy: string;
  generatedAt: string;
}

export interface DeckSlide {
  id: string;
  title: string;
  type: 'TEXT' | 'METRICS' | 'GRAPH' | 'IMAGE';
  content: any; 
}

export interface SalesPlaybookSection {
  id: string;
  title: string;
  content: any;
}

export interface DigestConfig {
  daily: { enabled: boolean; time: string; }; 
  weekly: { enabled: boolean; day: string; time: string; }; 
  monthly: { enabled: boolean; day: number; time: string; }; 
  channels: {
    email: boolean; 
    whatsapp: boolean;
    slack: boolean;
  };
  recipients: string[];
}

export interface DigestLog {
  id: string;
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  generatedAt: string;
  status: 'SENT' | 'FAILED';
  channel: string; 
  contentSummary: string; 
  generatedBy: string; 
}

export enum RvpStatus {
  RVP_CREATED = 'Rvp_Created',
  ASSIGNED_TO_RIDER = 'Assigned_To_Rider',
  PICKED_UP = 'Picked_Up',
  INBOUND_RECEIVED_LMDC = 'Inbound_Received_Lmdc',
  HANDED_OVER = 'Handed_Over',
  CLOSED = 'Closed'
}

export interface RVP {
  rvp_id: string;
  awb: string;
  reason_code: string;
  origin_lmdc_id: string;
  pickup_date: string;
  status: RvpStatus;
  created_at: string;
  assigned_rider_id?: string;
  package_condition?: string;
  photo_proof?: string;
}

export interface RvpRunsheet {
  rvp_runsheet_id: string;
  runsheet_code: string;
  lmdc_id: string;
  rider_id: string;
  date: string;
  rvp_ids: string[];
  status: RunsheetStatus;
  created_at: string;
}

export enum FmStatus {
  FM_CREATED = 'Fm_Created',
  ASSIGNED_TO_RIDER = 'Assigned_To_Rider',
  PICKED_UP = 'Picked_Up',
  INBOUND_RECEIVED_LMDC = 'Inbound_Received_Lmdc',
  CLOSED = 'Closed'
}

export interface FMPickup {
  fm_id: string;
  awb: string;
  seller_id: string;
  origin_lmdc_id: string;
  pickup_date: string;
  status: FmStatus;
  created_at: any; 
  assigned_rider_id?: string;
  package_count?: number;
  package_condition?: string;
  photo_proof?: string;
  verified_count?: number;
  inbound_at?: any;
  closed_at?: any;
  closed_by?: string;
  metadata_captured_at?: any;
}
