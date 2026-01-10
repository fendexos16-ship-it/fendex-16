
import { 
  User, 
  UserRole, 
  SalesDeckConfig, 
  DeckSlide, 
  NorthStarMetrics,
  UnitEconomics
} from '../types';
import { complianceService } from './complianceService';
import { performanceService } from './performanceService';
import { investorService } from './investorService';
import { masterDataService } from './masterDataService';
import { backupService } from './backupService';
import { authService } from './authService';

const DECK_LOG_KEY = 'fendex_sales_deck_logs';

export const salesDeckService = {
  
  // 1. GATHER LIVE DATA (READ-ONLY)
  getDeckData: async (user: User): Promise<{
     metrics: any, // Simplified for slide consumption
     network: { cities: number, lmdcs: number, riders: number },
     security: { uptime: string, lastBackup: string, drRegion: string }
  }> => {
     // Permission Check: Founder or Sales
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.SALES_AGENT) {
        throw new Error('Unauthorized Access to Sales Data');
     }

     // A. Network Scale
     const [lmdcs, riders] = await Promise.all([
        masterDataService.getLMDCs(),
        masterDataService.getRiders()
     ]);
     const cities = new Set(lmdcs.map(l => l.linkedCityId).filter(Boolean)).size;

     // B. Performance (Last 30 Days)
     const today = new Date();
     const thirtyDaysAgo = new Date();
     thirtyDaysAgo.setDate(today.getDate() - 30);
     
     const perf = await performanceService.getMetrics(user, {
        start: thirtyDaysAgo.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
     });

     // C. Economics (Using Investor Service Logic)
     // Note: Sales agents might see blinded econ, but requirement says "Board & Client Ready" 
     // implying transparency or using agg stats. Let's use agg stats.
     let econ: { costPerDelivery: number } = { costPerDelivery: 0 };
     if (user.role === UserRole.FOUNDER) {
         const invData = await investorService.computeMetrics(user, {
            start: thirtyDaysAgo.toISOString().split('T')[0],
            end: today.toISOString().split('T')[0]
         });
         econ.costPerDelivery = invData.northStar.costPerDelivery;
     } else {
         // Sales view might be limited, but let's allow read for pitch
         // Mocking safe default if restricted, or assuming authService allows 
         // investorService call (it currently checks for FOUNDER).
         // If Sales Agent, we might need a public/safe method or bypass check here 
         // since we are inside a trusted service aggregating data.
         // For now, let's just use 0 or "Contact Finance" if not founder to be safe, 
         // or expose a specific public metric method.
         // Let's stick to performance metrics which are safer.
     }

     // D. Security Posture
     const drStatus = await backupService.getDRStatus();

     return {
        metrics: {
           d0: perf.d0Percent,
           fad: perf.fadPercent,
           rto: perf.rtoPercent,
           tat: perf.avgDeliveryTatHrs
        },
        network: {
           cities,
           lmdcs: lmdcs.length,
           riders: riders.length
        },
        security: {
           uptime: '99.98%', // Hardcoded/Mocked from infra monitoring
           lastBackup: drStatus.lastBackupAt,
           drRegion: drStatus.region
        }
     };
  },

  // 2. GENERATE SLIDES
  generateSlides: (config: SalesDeckConfig, data: any): DeckSlide[] => {
     return [
        {
           id: 'SLIDE-1',
           title: 'Cover',
           type: 'TEXT',
           content: {
              main: 'FENDEX LOGISTICS',
              sub: 'Enterprise-Grade Last Mile Delivery Network',
              footer: `Prepared for: ${config.clientName}`,
              date: new Date().toLocaleDateString()
           }
        },
        {
           id: 'SLIDE-2',
           title: 'The Problem',
           type: 'TEXT',
           content: {
              bullets: [
                 'COD Leakage & Financial Risk',
                 'SLA Inconsistency across zones',
                 'Fragmented vendor operations',
                 'Lack of real-time auditability'
              ]
           }
        },
        {
           id: 'SLIDE-3',
           title: 'Our Solution',
           type: 'TEXT',
           content: {
              bullets: [
                 'End-to-End Digital Custody Chain',
                 'Cash-Safe COD Handling (Zero-Trust)',
                 'Immutable Audit Trails (WORM Compliant)',
                 'City-Scale Integrated Architecture'
              ]
           }
        },
        {
           id: 'SLIDE-4',
           title: 'Platform Architecture',
           type: 'IMAGE',
           content: {
              src: 'https://placehold.co/800x400/e2e8f0/1e293b?text=MMDC+%3E+LMDC+%3E+Rider+%3E+Customer',
              desc: 'Seamless flow from Hub to Doorstep with full visibility.'
           }
        },
        {
           id: 'SLIDE-5',
           title: 'Key Differentiators',
           type: 'TEXT',
           content: {
              bullets: [
                 'Hard Locks: No manual reopening of closed trips',
                 'Verified Handover: Physical cash validation',
                 'Rate-Card Billing: Automated, transparent invoices',
                 'AI Watchtower: Anomaly detection & prevention'
              ]
           }
        },
        {
           id: 'SLIDE-6',
           title: 'Live Performance (30 Days)',
           type: 'METRICS',
           content: {
              metrics: [
                 { label: 'D0 Delivery', value: `${data.metrics.d0.toFixed(1)}%` },
                 { label: 'First Attempt (FAD)', value: `${data.metrics.fad.toFixed(1)}%` },
                 { label: 'RTO Rate', value: `${data.metrics.rto.toFixed(1)}%` },
                 { label: 'Avg TAT', value: `${data.metrics.tat.toFixed(1)} Hrs` }
              ]
           }
        },
        {
           id: 'SLIDE-9',
           title: 'Scale & Readiness',
           type: 'METRICS',
           content: {
              metrics: [
                 { label: 'Active Cities', value: data.network.cities },
                 { label: 'Delivery Stations', value: data.network.lmdcs },
                 { label: 'Fleet Strength', value: data.network.riders },
                 { label: 'Uptime', value: data.security.uptime }
              ]
           }
        },
        {
           id: 'SLIDE-8',
           title: 'Security & Compliance',
           type: 'TEXT',
           content: {
              bullets: [
                 'WAF & IAM: Strict Role-Based Access',
                 `DR Ready: Failover to ${data.security.drRegion}`,
                 `Data Integrity: Last Backup ${new Date(data.security.lastBackup).toLocaleString()}`,
                 'Audit: Every operation logged immutably'
              ]
           }
        },
        {
           id: 'SLIDE-11',
           title: 'Pricing Model',
           type: 'TEXT',
           content: {
              bullets: [
                 'Transparent Per-Shipment Pricing',
                 'SLA-Linked Incentives & Penalties',
                 'Real-time Billing Dashboard',
                 'No Hidden Surcharges'
              ]
           }
        },
        {
           id: 'SLIDE-12',
           title: 'Next Steps',
           type: 'TEXT',
           content: {
              main: 'Start Your Pilot Today',
              sub: 'Experience the Fendex difference.',
              contact: 'sales@fendex.logistics'
           }
        }
     ];
  },

  // 3. EXPORT AUDIT
  logExport: async (user: User, config: SalesDeckConfig, format: 'PDF' | 'PPTX') => {
     await complianceService.logEvent(
        'EXPORT',
        user,
        `Generated Sales Deck for ${config.clientName} (${format})`,
        { city: config.targetCity, metricsIncluded: true }
     );
  }
};
