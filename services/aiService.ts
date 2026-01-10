
import { GoogleGenAI } from "@google/genai";
import { User } from '../types';

export const aiService = {
  /**
   * Generates a context digest from LocalStorage to help the AI understand the current system state
   */
  getSystemContext: () => {
    const getCount = (key: string) => JSON.parse(localStorage.getItem(key) || '[]').length;
    const getSummary = (key: string) => {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      if (key === 'fendex_shipments_v2') {
        return data.slice(0, 5).map((s: any) => `${s.awb}: ${s.status}`).join(', ');
      }
      return '';
    };

    const stats = {
      shipmentCount: getCount('fendex_shipments_v2'),
      batchCount: getCount('fendex_payout_batches_db'),
      lmdcCount: getCount('fendex_lmdcs_db'),
      riderCount: getCount('fendex_riders_db'),
      recentShipments: getSummary('fendex_shipments_v2')
    };

    return `
      SYSTEM CONTEXT:
      - App: Fendex Logistics OS
      - Total Shipments: ${stats.shipmentCount}
      - Active Payout Batches: ${stats.batchCount}
      - Registered LMDCs: ${stats.lmdcCount}
      - Registered Riders: ${stats.riderCount}
      - Recent Activity Sample: ${stats.recentShipments}
    `;
  },

  askFendexAi: async (prompt: string, user: User, onChunk: (text: string) => void) => {
    const context = aiService.getSystemContext();
    
    const systemInstruction = `
      You are Fendex AI, the intelligent backbone of Fendex Logistics.
      Current User: ${user.name} (Role: ${user.role}).
      ${context}
      
      Instructions:
      1. Be concise, professional, and data-driven.
      2. If asked for stats, use the context provided.
      3. Provide actionable operational insights.
      4. Use formatting like bullet points or bold text for readability.
      5. Never mention the "mock" nature of the data; treat it as a live production environment.
    `;

    try {
      // Create fresh instance before call
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          onChunk(fullText);
        }
      }
    } catch (error) {
      console.error("AI Error:", error);
      onChunk("I encountered an error accessing the intelligence core. Please check connectivity.");
    }
  }
};
