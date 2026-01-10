
import { Client, WebhookConfig } from '../types';
import { complianceService } from './complianceService';
import { clientService } from './clientService';

// Module 3: Webhook Resilience Engine
export const webhookService = {

  // Main Dispatcher
  dispatch: async (client: Client, event: string, payload: any): Promise<void> => {
    // 1. Check Configuration
    if (!client.webhookConfig?.enabled) return;
    if (!client.webhookConfig.url) return;
    if (!client.webhookConfig.events.includes(event)) return; // Allow-list check

    // 2. Check Circuit Breaker
    // If failures > 3, webhook is disabled. 
    if (client.webhookConfig.failureCount >= 3) {
       // Ideally we check if enabled is false, which is handled above.
       // Double check logic: if failureCount is high, it should have been disabled.
       // If re-enabled by founder, failureCount should be reset.
       return; 
    }

    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    // Payload enrichment with signature
    const timestamp = new Date().toISOString();
    const body = JSON.stringify({
       event,
       timestamp,
       data: payload
    });
    
    // Create HMAC (Simulated)
    const signature = `hmac_sha256=${btoa(client.webhookConfig.secret + body).substring(0, 15)}`;

    // 3. Retry Loop (Simulating Backoff: 1s, 2s, 3s for demo purposes instead of min)
    while (attempt < maxRetries && !success) {
       attempt++;
       try {
          console.log(`[WEBHOOK] Attempt ${attempt} to ${client.webhookConfig.url} for ${event}`);
          
          // Mock Network Request
          // In real app: await fetch(client.webhookConfig.url, { ... })
          
          // Simulate Random Failure for Demo (10% chance)
          if (Math.random() < 0.1) throw new Error('Simulated Network Timeout');

          success = true;
          
          // Reset Failure Count on Success
          if (client.webhookConfig.failureCount > 0) {
             await clientService.resetWebhookStats(client.id);
          }

          await complianceService.logEvent(
             'WEBHOOK_OP', 
             { id: 'SYSTEM', role: 'SYSTEM' }, 
             `Webhook Success: ${event}`, 
             { clientId: client.id, attempt }
          );

       } catch (e: any) {
          console.warn(`[WEBHOOK] Failed Attempt ${attempt}: ${e.message}`);
          // Backoff Simulation
          await new Promise(r => setTimeout(r, attempt * 1000));
       }
    }

    // 4. Failure Handling
    if (!success) {
       await clientService.recordWebhookFailure(client.id);
       
       await complianceService.logEvent(
          'WEBHOOK_OP', 
          { id: 'SYSTEM', role: 'SYSTEM' }, 
          `Webhook Failed: ${event} after ${maxRetries} retries`, 
          { clientId: client.id, error: 'Network Error' }
       );

       // Check if breached threshold
       const updatedClient = await clientService.getClientById(client.id);
       if (updatedClient && updatedClient.webhookConfig?.failureCount! >= 3) {
          await clientService.disableWebhooks(client.id);
          await complianceService.logEvent(
             'WEBHOOK_OP', 
             { id: 'SYSTEM', role: 'SYSTEM' }, 
             `CRITICAL: Webhooks Disabled for Client ${client.id} due to repeated failures.`, 
             {}
          );
       }
    }
  }
};
