
import { User, UserRole } from '../types';
import { performanceService } from './performanceService';
import { complianceService } from './complianceService';
import { codService } from './codService';

export const salesPlaybookService = {

  // Get Live "Ammo" for Objection Handling
  getLiveAmmo: async (user: User) => {
     if (user.role !== UserRole.FOUNDER && user.role !== UserRole.SALES_AGENT) {
        throw new Error('Unauthorized');
     }

     const today = new Date();
     const thirtyDaysAgo = new Date();
     thirtyDaysAgo.setDate(today.getDate() - 30);
     
     const metrics = await performanceService.getMetrics(user, {
        start: thirtyDaysAgo.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
     });

     const codStats = await codService.getStats();

     return {
        d0: metrics.d0Percent.toFixed(1) + '%',
        rto: metrics.rtoPercent.toFixed(1) + '%',
        codSpeed: metrics.avgCodVerifyHrs.toFixed(1) + ' hrs',
        codReconciled: `₹${codStats.reconciled.toLocaleString()}`
     };
  },

  getPlaybookContent: () => {
     return {
        segments: [
           { 
              name: 'Aggregators', 
              icp: 'High Volume (>10k/day), Tech-first, Low margin sensitivity but High SLA sensitivity.', 
              valueProp: 'API-first integration, 99.9% uptime, Automated reconciliation.' 
           },
           { 
              name: 'Enterprise Direct', 
              icp: 'Medium Volume, Brand conscious, Custom packaging needs.', 
              valueProp: 'Dedicated Account Manager, White-label tracking, Custom SOPs.' 
           },
           { 
              name: 'SME / D2C', 
              icp: 'Low-Med Volume, Cash flow sensitive, Needs COD speed.', 
              valueProp: 'T+1 COD Remittance, No minimum commitment, Easy onboarding.' 
           },
           { 
              name: 'Hyperlocal', 
              icp: 'City-specific, <2hr delivery needs, Food/Grocery/Pharma.', 
              valueProp: 'Rider proximity, Live tracking, Cold chain capability (future).' 
           }
        ],
        motion: [
           { step: '1. Discovery', obj: 'Understand pain points (COD stuck? High RTO?)', exit: 'Qualified Need identified.' },
           { step: '2. Pilot Proposal', obj: 'Agree on small batch test (100-500 shipments).', exit: 'MSA Signed for Pilot.' },
           { step: '3. Pilot Execution', obj: 'Demonstrate D0 and COD speed.', exit: 'Success KPIs met.' },
           { step: '4. Commercials', obj: 'Negotiate long-term rate card.', exit: 'Final Contract Signed.' },
           { step: '5. Go-Live', obj: 'Full integration and volume ramp.', exit: 'First 1000 shipments processed.' }
        ],
        scripts: {
           firstCall: "Hi [Name], I'm calling from Fendex. We're a tech-enabled logistics partner helping brands reduce RTO by 15% using our verified handover process. Are you currently facing issues with COD reconciliation or delivery delays?",
           techDive: "Our platform offers a hard-lock API. Once a status is pushed, it cannot be manually manipulated by riders. This ensures 100% data integrity for your ops team.",
           finance: "We settle COD on a T+1 basis using automated bank transfers. Our dashboard gives you a real-time view of every rupee collected, verified, and deposited."
        },
        objections: [
           { 
              claim: "Your rates are higher than X.", 
              counter: "Our base rate includes insurance and guaranteed attempts. Competitor X often adds hidden surcharges for fuel or RTO. When you factor in our lower RTO rate of [LIVE_RTO], your total cost of logistics is actually lower with us." 
           },
           { 
              claim: "We are happy with current partner.", 
              counter: "That's great. Most of our clients use us as a reliable backup for peak seasons or specific difficult pincodes. Would you be open to a 50-shipment pilot to benchmark performance?" 
           },
           { 
              claim: "COD is risky.", 
              counter: "We use a 'Zero-Trust' cash model. Riders cannot get new runsheets until yesterday's cash is physically verified at the station. We have reconciled [LIVE_COD_RECON] this month with 0 discrepancies." 
           },
           {
              claim: "Integration takes too long.",
              counter: "We have plugins for Shopify, Magento, and a REST API that takes less than 2 hours to integrate. Our team will handle the setup for you."
           }
        ],
        pilot: {
           duration: '2 Weeks',
           volumeCap: '500 Shipments',
           successKPIs: ['D0 > 90%', 'COD Remittance < 24hrs'],
           pricing: 'Standard Rate Card (No discounts on pilot)'
        }
     };
  },

  logAccess: async (user: User) => {
     await complianceService.logEvent('SALES_OP', user, 'Accessed Sales Playbook', {});
  }
};
