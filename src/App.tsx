
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary'; // Imported
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
// Setup component import removed
import { Dashboard } from './pages/Dashboard';
import { DCManager } from './pages/masters/DCManager';
import { MMDCManager } from './pages/masters/MMDCManager'; 
import { LMDCManager } from './pages/masters/LMDCManager';
import { RiderManager } from './pages/masters/RiderManager';
import { PincodeManager } from './pages/masters/PincodeManager';
import { ClientManager } from './pages/masters/ClientManager';
import { AtlasManager } from './pages/masters/AtlasManager'; 
import { CityManager } from './pages/masters/CityManager'; 
import { UserManager } from './pages/admin/UserManager';
import { LmdcRateManager } from './pages/rates/LmdcRateManager';
import { RiderRateManager } from './pages/rates/RiderRateManager';
import { RateCalculator } from './pages/rates/RateCalculator';
import { ShipmentManager } from './pages/shipments/ShipmentManager';
import { LmdcPayouts } from './pages/finance/LmdcPayouts';
import { RiderPayouts } from './pages/finance/RiderPayouts';
import { PayoutManager } from './pages/finance/PayoutManager';
import { FinanceReports } from './pages/finance/FinanceReports';
import { CodManager } from './pages/finance/CodManager';
import { SlaManager } from './pages/finance/SlaManager';
import { ClientSettlementManager } from './pages/finance/ClientSettlementManager'; 
import { ClientRateCardManager } from './pages/finance/ClientRateCardManager'; 
import { ClientInvoicing } from './pages/finance/ClientInvoicing'; 
import { ControlTower } from './pages/dashboard/ControlTower'; 
import { InvestorBoard } from './pages/investor/InvestorBoard'; 
import { FounderDailyBrief } from './pages/dashboard/FounderDailyBrief'; 
import { SystemHealth } from './pages/admin/SystemHealth';
import { PerformanceMonitor } from './pages/admin/PerformanceMonitor';
import { AnomalyDetection } from './pages/admin/AnomalyDetection'; 
import { SalesPitchDeck } from './pages/sales/SalesPitchDeck'; 
import { SalesPlaybook } from './pages/sales/SalesPlaybook'; 
import { DigestManager } from './pages/founder/DigestManager'; // NEW
// MMDC Operations (STRICT)
import { MMDCDashboard } from './pages/ops/MMDCDashboard';
import { MMDCInbound } from './pages/ops/MMDCInbound';
import { MMDCConnection } from './pages/ops/MMDCConnection';
import { MMDCOutbound } from './pages/ops/MMDCOutbound';
import { MMDCAudit } from './pages/ops/MMDCAudit';
// Generic/LMDC Operations
import { BagOperations } from './pages/ops/BagOperations';
import { TripOperations } from './pages/ops/TripOperations';
// LMDC Operations
import { LMDCDashboard } from './pages/ops/LMDCDashboard';
import { PickupManager } from './pages/ops/PickupManager';
import { FMBagManager } from './pages/ops/FMBagManager';
import { DispatchToMMDC } from './pages/ops/DispatchToMMDC';
import { RunsheetManager } from './pages/ops/RunsheetManager';
import { LMDCAudit } from './pages/ops/LMDCAudit';
import { RiderCapacityControl } from './pages/ops/RiderCapacityControl'; 
// Rider Operations
import { RiderDashboard } from './pages/rider/RiderDashboard';
import { RiderPickups } from './pages/rider/RiderPickups';
import { RiderDeliveries } from './pages/rider/RiderDeliveries';
import { RiderCod } from './pages/rider/RiderCod';
import { RiderSla } from './pages/rider/RiderSla';
import { RiderRvp } from './pages/rider/RiderRvp';
// Client Portal (NEW)
import { ClientDashboard } from './pages/client/ClientDashboard';
import { ClientShipments } from './pages/client/ClientShipments';
import { ClientSettlements } from './pages/client/ClientSettlements';
import { ClientRates } from './pages/client/ClientRates';
import { ClientBilling } from './pages/client/ClientBilling';
// Knowledge Base
import { KnowledgeBase } from './pages/resources/KnowledgeBase';

import { UserRole } from './types';

// Protected Route Component with Role Check
const ProtectedRoute: React.FC<{ children: React.ReactNode, allowedRoles?: UserRole[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-48 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
     // Redirect based on role if they try to access restricted area
     if (user.role === UserRole.RIDER) return <Navigate to="/rider/dashboard" replace />;
     if (user.role === UserRole.MMDC_MANAGER) return <Navigate to="/ops/mmdc-dashboard" replace />;
     if (user.role === UserRole.LMDC_MANAGER) return <Navigate to="/ops/lmdc-dashboard" replace />;
     if (user.role === UserRole.CLIENT_VIEW) return <Navigate to="/client/dashboard" replace />;
     if (user.role === UserRole.FOUNDER) return <Navigate to="/founder/dashboard" replace />;
     return <Navigate to="/" replace />; // Fallback
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      
      {/* FOUNDER & FINANCE DASHBOARD (Explicit Route) */}
      <Route path="/founder/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><Dashboard /></ProtectedRoute>} />
      
      {/* FINANCE ADMIN & AREA MANAGER HOME */}
      <Route path="/" element={<ProtectedRoute allowedRoles={[UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER]}><Dashboard /></ProtectedRoute>} />
      
      {/* CONTROL TOWER & INVESTOR BOARD */}
      <Route path="/control-tower" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.MMDC_MANAGER, UserRole.LMDC_MANAGER]}><ControlTower /></ProtectedRoute>} />
      <Route path="/investor/board" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><InvestorBoard /></ProtectedRoute>} />
      <Route path="/founder/daily-brief" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><FounderDailyBrief /></ProtectedRoute>} />
      <Route path="/founder/digest" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><DigestManager /></ProtectedRoute>} />
      
      {/* SALES */}
      <Route path="/sales/pitch-deck" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.SALES_AGENT]}><SalesPitchDeck /></ProtectedRoute>} />
      <Route path="/sales/playbook" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.SALES_AGENT]}><SalesPlaybook /></ProtectedRoute>} />

      {/* GLOBAL OPERATIONS (Accessible by Founder/Ops/Area) - Area Manager is Read-Only here */}
      <Route path="/shipments" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.MMDC_MANAGER, UserRole.LMDC_MANAGER, UserRole.AREA_MANAGER]}><ShipmentManager /></ProtectedRoute>} />
      <Route path="/ops/capacity" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><RiderCapacityControl /></ProtectedRoute>} />

      {/* MMDC SPECIFIC (STRICT MODE) */}
      <Route path="/ops/mmdc-dashboard" element={<ProtectedRoute allowedRoles={[UserRole.MMDC_MANAGER, UserRole.FOUNDER]}><MMDCDashboard /></ProtectedRoute>} />
      <Route path="/ops/mmdc/inbound" element={<ProtectedRoute allowedRoles={[UserRole.MMDC_MANAGER, UserRole.FOUNDER]}><MMDCInbound /></ProtectedRoute>} />
      <Route path="/ops/mmdc/connection" element={<ProtectedRoute allowedRoles={[UserRole.MMDC_MANAGER, UserRole.FOUNDER]}><MMDCConnection /></ProtectedRoute>} />
      <Route path="/ops/mmdc/outbound" element={<ProtectedRoute allowedRoles={[UserRole.MMDC_MANAGER, UserRole.FOUNDER]}><MMDCOutbound /></ProtectedRoute>} />
      <Route path="/ops/audit" element={<ProtectedRoute allowedRoles={[UserRole.MMDC_MANAGER, UserRole.FOUNDER]}><MMDCAudit /></ProtectedRoute>} />

      {/* GENERIC / LMDC OPS (Kept for Founder/LMDC view, MMDC uses strict modules above) */}
      <Route path="/ops/bags" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.LMDC_MANAGER]}><BagOperations /></ProtectedRoute>} />
      <Route path="/ops/trips" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.LMDC_MANAGER]}><TripOperations /></ProtectedRoute>} />

      {/* LMDC SPECIFIC */}
      <Route path="/ops/lmdc-dashboard" element={<ProtectedRoute allowedRoles={[UserRole.LMDC_MANAGER, UserRole.FOUNDER]}><LMDCDashboard /></ProtectedRoute>} />
      <Route path="/ops/pickups" element={<ProtectedRoute allowedRoles={[UserRole.LMDC_MANAGER, UserRole.FOUNDER]}><PickupManager /></ProtectedRoute>} />
      <Route path="/ops/fm-bagging" element={<ProtectedRoute allowedRoles={[UserRole.LMDC_MANAGER, UserRole.FOUNDER]}><FMBagManager /></ProtectedRoute>} />
      <Route path="/ops/dispatch" element={<ProtectedRoute allowedRoles={[UserRole.LMDC_MANAGER, UserRole.FOUNDER]}><DispatchToMMDC /></ProtectedRoute>} />
      <Route path="/ops/runsheets" element={<ProtectedRoute allowedRoles={[UserRole.LMDC_MANAGER, UserRole.FOUNDER]}><RunsheetManager /></ProtectedRoute>} />
      <Route path="/ops/lmdc-audit" element={<ProtectedRoute allowedRoles={[UserRole.LMDC_MANAGER, UserRole.FOUNDER]}><LMDCAudit /></ProtectedRoute>} />

      {/* RIDER SPECIFIC */}
      <Route path="/rider/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.RIDER]}><RiderDashboard /></ProtectedRoute>} />
      <Route path="/rider/pickups" element={<ProtectedRoute allowedRoles={[UserRole.RIDER]}><RiderPickups /></ProtectedRoute>} />
      <Route path="/rider/deliveries" element={<ProtectedRoute allowedRoles={[UserRole.RIDER]}><RiderDeliveries /></ProtectedRoute>} />
      <Route path="/rider/rvp" element={<ProtectedRoute allowedRoles={[UserRole.RIDER]}><RiderRvp /></ProtectedRoute>} />
      <Route path="/rider/cod" element={<ProtectedRoute allowedRoles={[UserRole.RIDER]}><RiderCod /></ProtectedRoute>} />
      <Route path="/rider/sla" element={<ProtectedRoute allowedRoles={[UserRole.RIDER]}><RiderSla /></ProtectedRoute>} />

      {/* CLIENT PORTAL (NEW) */}
      <Route path="/client/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.CLIENT_VIEW]}><ClientDashboard /></ProtectedRoute>} />
      <Route path="/client/shipments" element={<ProtectedRoute allowedRoles={[UserRole.CLIENT_VIEW]}><ClientShipments /></ProtectedRoute>} />
      <Route path="/client/settlements" element={<ProtectedRoute allowedRoles={[UserRole.CLIENT_VIEW]}><ClientSettlements /></ProtectedRoute>} />
      <Route path="/client/rates" element={<ProtectedRoute allowedRoles={[UserRole.CLIENT_VIEW]}><ClientRates /></ProtectedRoute>} />
      <Route path="/client/billing" element={<ProtectedRoute allowedRoles={[UserRole.CLIENT_VIEW]}><ClientBilling /></ProtectedRoute>} />

      {/* FINANCE (Founder/Finance/LMDC/Rider access specific pages) */}
      <Route path="/finance/payouts" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.FINANCE_ADMIN]}><PayoutManager /></ProtectedRoute>} />
      <Route path="/finance/invoicing" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.FINANCE_ADMIN]}><ClientInvoicing /></ProtectedRoute>} />
      <Route path="/finance/cod" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.LMDC_MANAGER, UserRole.RIDER]}><CodManager /></ProtectedRoute>} />
      <Route path="/finance/sla" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.RIDER]}><SlaManager /></ProtectedRoute>} />
      <Route path="/finance/settlements" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.FINANCE_ADMIN]}><ClientSettlementManager /></ProtectedRoute>} />
      <Route path="/finance/client-rates" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><ClientRateCardManager /></ProtectedRoute>} />
      <Route path="/finance/lmdc" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.LMDC_MANAGER]}><LmdcPayouts /></ProtectedRoute>} />
      <Route path="/finance/rider" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.LMDC_MANAGER, UserRole.RIDER]}><RiderPayouts /></ProtectedRoute>} />
      <Route path="/finance/reports" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.FINANCE_ADMIN]}><FinanceReports /></ProtectedRoute>} />

      {/* MASTERS (Founder/LMDC access) */}
      <Route path="/masters/cities" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><CityManager /></ProtectedRoute>} />
      <Route path="/masters/dc" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><DCManager /></ProtectedRoute>} />
      <Route path="/masters/mmdc" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><MMDCManager /></ProtectedRoute>} />
      <Route path="/masters/lmdc" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><LMDCManager /></ProtectedRoute>} />
      <Route path="/masters/rider" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.LMDC_MANAGER]}><RiderManager /></ProtectedRoute>} />
      <Route path="/masters/pincode" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><PincodeManager /></ProtectedRoute>} />
      <Route path="/masters/client" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><ClientManager /></ProtectedRoute>} />
      <Route path="/masters/atlas" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.AREA_MANAGER]}><AtlasManager /></ProtectedRoute>} /> 
      
      {/* RESOURCES */}
      <Route path="/resources/knowledge-base" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.MMDC_MANAGER, UserRole.LMDC_MANAGER, UserRole.RIDER, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER]}><KnowledgeBase /></ProtectedRoute>} />

      {/* ADMIN */}
      <Route path="/admin/users" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><UserManager /></ProtectedRoute>} />
      <Route path="/admin/health" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><SystemHealth /></ProtectedRoute>} />
      <Route path="/admin/performance" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><PerformanceMonitor /></ProtectedRoute>} />
      <Route path="/admin/anomalies" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER, UserRole.FINANCE_ADMIN]}><AnomalyDetection /></ProtectedRoute>} />

      {/* RATES */}
      <Route path="/rates/lmdc" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><LmdcRateManager /></ProtectedRoute>} />
      <Route path="/rates/rider" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><RiderRateManager /></ProtectedRoute>} />
      <Route path="/rates/calculator" element={<ProtectedRoute allowedRoles={[UserRole.FOUNDER]}><RateCalculator /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <HashRouter>
            <AppContent />
          </HashRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
