
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { systemConfigService } from '../services/systemConfigService';
import { 
  LogOut, 
  Building2, 
  LayoutDashboard, 
  MapPin, 
  Truck, 
  Users, 
  Calculator,
  Wallet,
  Coins,
  Package,
  IndianRupee,
  Landmark,
  FileText,
  Banknote,
  Gauge,
  Activity,
  Globe,
  Briefcase,
  Warehouse,
  ShoppingBag,
  Navigation,
  ClipboardList,
  RotateCcw,
  ShieldAlert,
  Radio,
  Lock,
  Scale,
  Percent,
  Download,
  ArrowDownCircle,
  Layers,
  Send,
  Receipt,
  BarChart2,
  PieChart,
  AlertOctagon
} from 'lucide-react';
import { UserRole } from '../types';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Operational
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER], section: 'Overview' },
  { name: 'Control Tower', href: '/control-tower', icon: BarChart2, roles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.MMDC_MANAGER, UserRole.LMDC_MANAGER], section: 'Overview' }, 
  { name: 'Investor Board', href: '/investor/board', icon: PieChart, roles: [UserRole.FOUNDER], section: 'Overview' }, 

  { name: 'Shipments', href: '/shipments', icon: Package, roles: [UserRole.FOUNDER, UserRole.MMDC_MANAGER, UserRole.LMDC_MANAGER], section: 'Operations' },
  { name: 'Capacity Control', href: '/ops/capacity', icon: ShieldAlert, roles: [UserRole.FOUNDER], section: 'Operations' }, 
  
  // MMDC SPECIFIC (STRICT MODE)
  { name: 'Hub Dashboard', href: '/ops/mmdc-dashboard', icon: Warehouse, roles: [UserRole.MMDC_MANAGER], section: 'MMDC Ops' },
  { name: 'Inbound Dock', href: '/ops/mmdc/inbound', icon: ArrowDownCircle, roles: [UserRole.MMDC_MANAGER, UserRole.FOUNDER], section: 'MMDC Ops' },
  { name: 'Sorting & Connection', href: '/ops/mmdc/connection', icon: Layers, roles: [UserRole.MMDC_MANAGER, UserRole.FOUNDER], section: 'MMDC Ops' },
  { name: 'Outbound Dispatch', href: '/ops/mmdc/outbound', icon: Send, roles: [UserRole.MMDC_MANAGER, UserRole.FOUNDER], section: 'MMDC Ops' },
  { name: 'Station Audit', href: '/ops/audit', icon: FileText, roles: [UserRole.MMDC_MANAGER], section: 'MMDC Ops' },

  // LMDC Ops
  { name: 'Station Dashboard', href: '/ops/lmdc-dashboard', icon: MapPin, roles: [UserRole.LMDC_MANAGER], section: 'LMDC Ops' },
  { name: 'Pickups (First Mile)', href: '/ops/pickups', icon: Truck, roles: [UserRole.FOUNDER, UserRole.LMDC_MANAGER], section: 'LMDC Ops' },
  { name: 'FM Bagging', href: '/ops/fm-bagging', icon: ShoppingBag, roles: [UserRole.FOUNDER, UserRole.LMDC_MANAGER], section: 'LMDC Ops' },
  { name: 'Dispatch to Hub', href: '/ops/dispatch', icon: Navigation, roles: [UserRole.FOUNDER, UserRole.LMDC_MANAGER], section: 'LMDC Ops' },
  { name: 'Delivery Runsheets', href: '/ops/runsheets', icon: ClipboardList, roles: [UserRole.FOUNDER, UserRole.LMDC_MANAGER], section: 'LMDC Ops' },
  { name: 'LMDC Audit', href: '/ops/lmdc-audit', icon: FileText, roles: [UserRole.LMDC_MANAGER], section: 'LMDC Ops' },

  // Rider App
  { name: 'My Pickups (FM)', href: '/rider/pickups', icon: Truck, roles: [UserRole.RIDER], section: 'Rider Tasks' },
  { name: 'Forward Deliveries', href: '/rider/deliveries', icon: Package, roles: [UserRole.RIDER], section: 'Rider Tasks' },
  { name: 'Reverse Pickups', href: '/rider/rvp', icon: RotateCcw, roles: [UserRole.RIDER], section: 'Rider Tasks' },
  { name: 'Cash Handover', href: '/rider/cod', icon: Banknote, roles: [UserRole.RIDER], section: 'Rider Tasks' },
  { name: 'My Performance', href: '/rider/sla', icon: Gauge, roles: [UserRole.RIDER], section: 'Rider Tasks' },

  // Client Portal (NEW)
  { name: 'Overview', href: '/client/dashboard', icon: LayoutDashboard, roles: [UserRole.CLIENT_VIEW], section: 'Portal' },
  { name: 'My Shipments', href: '/client/shipments', icon: Package, roles: [UserRole.CLIENT_VIEW], section: 'Portal' },
  { name: 'Settlements', href: '/client/settlements', icon: FileText, roles: [UserRole.CLIENT_VIEW], section: 'Portal' },
  { name: 'My Rate Card', href: '/client/rates', icon: Percent, roles: [UserRole.CLIENT_VIEW], section: 'Portal' },

  // Finance
  { name: 'Payout Cycles', href: '/finance/payouts', icon: Landmark, roles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN], section: 'Finance' },
  { name: 'Client Invoicing', href: '/finance/invoicing', icon: Receipt, roles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN], section: 'Finance' }, 
  { name: 'COD Management', href: '/finance/cod', icon: Banknote, roles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.LMDC_MANAGER, UserRole.RIDER], section: 'Finance' },
  { name: 'SLA & Performance', href: '/finance/sla', icon: Gauge, roles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.LMDC_MANAGER, UserRole.RIDER], section: 'Finance' },
  { name: 'Client Settlement', href: '/finance/settlements', icon: Scale, roles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN], section: 'Finance' }, 
  { name: 'Client Rate Cards', href: '/finance/client-rates', icon: Percent, roles: [UserRole.FOUNDER], section: 'Finance' },
  { name: 'LMDC Payouts', href: '/finance/lmdc', icon: IndianRupee, roles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.LMDC_MANAGER], section: 'Finance' },
  { name: 'Rider Payouts', href: '/finance/rider', icon: Coins, roles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN, UserRole.LMDC_MANAGER, UserRole.RIDER], section: 'Finance' },
  { name: 'Reports & Compliance', href: '/finance/reports', icon: FileText, roles: [UserRole.FOUNDER, UserRole.FINANCE_ADMIN], section: 'Finance' },

  // Commercials
  { name: 'LMDC Rates', href: '/rates/lmdc', icon: Wallet, roles: [UserRole.FOUNDER], section: 'Commercials' },
  { name: 'Rider Rates', href: '/rates/rider', icon: Coins, roles: [UserRole.FOUNDER], section: 'Commercials' },
  { name: 'Rate Preview', href: '/rates/calculator', icon: Calculator, roles: [UserRole.FOUNDER], section: 'Commercials' },

  // Masters
  { name: 'DC Master', href: '/masters/dc', icon: Building2, roles: [UserRole.FOUNDER], section: 'Masters' },
  { name: 'MMDC Master', href: '/masters/mmdc', icon: Warehouse, roles: [UserRole.FOUNDER], section: 'Masters' },
  { name: 'LMDC Master', href: '/masters/lmdc', icon: MapPin, roles: [UserRole.FOUNDER], section: 'Masters' },
  { name: 'Atlas Service Areas', href: '/masters/atlas', icon: Globe, roles: [UserRole.FOUNDER, UserRole.AREA_MANAGER], section: 'Masters' },
  { name: 'Rider Master', href: '/masters/rider', icon: Truck, roles: [UserRole.FOUNDER], section: 'Masters' },
  { name: 'Pincode Master', href: '/masters/pincode', icon: MapPin, roles: [UserRole.FOUNDER], section: 'Masters' },
  { name: 'Client Master', href: '/masters/client', icon: Briefcase, roles: [UserRole.FOUNDER], section: 'Masters' },
  
  // Admin
  { name: 'User Access', href: '/admin/users', icon: Users, roles: [UserRole.FOUNDER], section: 'Admin' },
  { name: 'System Health', href: '/admin/health', icon: Activity, roles: [UserRole.FOUNDER], section: 'Admin' },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [incidentMode, setIncidentMode] = useState(false);

  useEffect(() => {
     // Check incident mode status
     const check = () => setIncidentMode(systemConfigService.isIncidentMode());
     check();
     const interval = setInterval(check, 30000);
     return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.hash = '#/login'; 
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const filteredNavItems = NAV_ITEMS.filter(item => user && item.roles.includes(user.role));

  const groupedItems = filteredNavItems.reduce((acc, item) => {
    const section = item.section || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  const sections = ['Overview', 'Portal', 'Operations', 'MMDC Ops', 'LMDC Ops', 'Rider Tasks', 'Finance', 'Commercials', 'Masters', 'Admin'];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full z-20">
        <div className="flex items-center h-16 px-6 border-b border-gray-200">
           <div className="bg-brand-900 p-1.5 rounded-lg mr-3">
              <Building2 className="h-5 w-5 text-white" />
           </div>
           <div>
              <h1 className="text-lg font-extrabold text-gray-900 tracking-tight leading-none">FENDEX</h1>
              <p className="text-[9px] font-bold text-gray-500 tracking-widest uppercase">Enterprise</p>
           </div>
        </div>

        {/* Live Indicator - Permanent Hard Lock */}
        <div className="bg-gray-900 text-white text-[10px] font-bold text-center py-2 uppercase tracking-widest flex items-center justify-center shadow-inner border-b border-gray-700">
           <Lock className="h-3 w-3 mr-1" /> SYSTEM LIVE – PRODUCTION MODE
        </div>

        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          {sections.map(section => {
            const items = groupedItems[section];
            if (!items || items.length === 0) return null;
            return (
              <div key={section} className="mb-6">
                <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{section}</h3>
                <div className="space-y-1">
                  {items.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`
                          group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                          ${isActive 
                            ? 'bg-brand-50 text-brand-700' 
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                        `}
                      >
                        <item.icon 
                          className={`
                            mr-3 h-4 w-4 flex-shrink-0 transition-colors
                            ${isActive ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-500'}
                          `} 
                        />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center">
            <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center text-sm font-bold text-gray-600 border border-gray-200 shadow-sm">
              {user && getInitials(user.name)}
            </div>
            <div className="ml-3">
              <p className="text-sm font-bold text-gray-800 truncate w-32">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate w-32 flex items-center"><Lock className="h-3 w-3 mr-1" /> {user?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="mt-4 flex w-full items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sign out
          </button>
          
          <div className="mt-4 text-center">
             <p className="text-[9px] text-gray-400 font-mono">FENDEX_OS_v1.0_PRODUCTION</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
         {/* Incident Banner */}
         {incidentMode && (
            <div className="bg-red-600 text-white p-3 text-center font-bold text-sm flex items-center justify-center sticky top-0 z-50 shadow-lg animate-pulse">
               <AlertOctagon className="h-5 w-5 mr-2" />
               INCIDENT MODE ACTIVE – FINANCIAL OPERATIONS FROZEN
            </div>
         )}

         {/* Mobile Header (visible only on small screens) */}
         <div className="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-40">
            <div className="flex items-center gap-2">
               <Building2 className="h-6 w-6 text-brand-600" />
               <span className="font-bold text-gray-900">FENDEX</span>
               <span className="bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">LIVE</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">{user?.name}</span>
                <button onClick={handleLogout}>
                  <LogOut className="h-5 w-5 text-gray-500" />
                </button>
            </div>
         </div>

         {/* Content Wrapper */}
         <div className="flex-1 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
         </div>
      </main>
      
      {/* Mobile Bottom Navigation (Rider Only) */}
      {user?.role === UserRole.RIDER && (
         <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-30 pb-safe shadow-lg">
            <Link to="/" className={`flex flex-col items-center p-2 ${location.pathname === '/' ? 'text-brand-600' : 'text-gray-500'}`}>
               <LayoutDashboard className="h-5 w-5" />
               <span className="text-[10px] mt-1">Home</span>
            </Link>
            <Link to="/rider/pickups" className={`flex flex-col items-center p-2 ${location.pathname.includes('pickup') ? 'text-brand-600' : 'text-gray-500'}`}>
               <Truck className="h-5 w-5" />
               <span className="text-[10px] mt-1">Pickup</span>
            </Link>
            <Link to="/rider/deliveries" className={`flex flex-col items-center p-2 ${location.pathname.includes('deliveries') ? 'text-brand-600' : 'text-gray-500'}`}>
               <Package className="h-5 w-5" />
               <span className="text-[10px] mt-1">Del</span>
            </Link>
            <Link to="/rider/rvp" className={`flex flex-col items-center p-2 ${location.pathname.includes('rvp') ? 'text-brand-600' : 'text-gray-500'}`}>
               <RotateCcw className="h-5 w-5" />
               <span className="text-[10px] mt-1">RVP</span>
            </Link>
            <Link to="/rider/cod" className={`flex flex-col items-center p-2 ${location.pathname.includes('cod') ? 'text-brand-600' : 'text-gray-500'}`}>
               <Banknote className="h-5 w-5" />
               <span className="text-[10px] mt-1">Cash</span>
            </Link>
         </div>
      )}
    </div>
  );
};
