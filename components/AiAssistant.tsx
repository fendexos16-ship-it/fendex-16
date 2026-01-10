
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, Brain, TrendingUp, ShieldAlert, Loader2 } from 'lucide-react';
import { aiService } from '../services/aiService';
import { useAuth } from '../context/AuthContext';

export const AiAssistant: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (customPrompt?: string) => {
    const text = customPrompt || input;
    if (!text.trim() || !user) return;

    const newMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    // Initial placeholder for AI
    setMessages(prev => [...prev, { role: 'ai', content: '' }]);

    await aiService.askFendexAi(text, user, (updatedContent) => {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1].content = updatedContent;
        return next;
      });
      setIsTyping(false);
    });
  };

  const presets = [
    { label: 'Ops Health', icon: TrendingUp, prompt: 'Provide an operational health summary of current shipments.' },
    { label: 'SLA Risk', icon: ShieldAlert, prompt: 'Analyze shipment data and identify any potential SLA risks today.' },
    { label: 'Finance Calc', icon: Brain, prompt: 'Summarize the total payout amounts across all open ledgers.' },
  ];

  if (!user) return null;

  return (
    <>
      {/* Floating Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-brand-600 text-white p-4 rounded-full shadow-2xl hover:bg-brand-700 transition-all hover:scale-110 active:scale-95 flex items-center gap-2 group"
      >
        <Sparkles className="h-6 w-6" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-sm font-bold">
          Ask Fendex AI
        </span>
      </button>

      {/* Side Panel Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div 
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-brand-600 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Fendex AI Insights</h2>
                  <p className="text-[10px] text-brand-100 font-medium tracking-widest uppercase">Intelligent Logistics Engine</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1 rounded-md">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <div className="bg-brand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-8 w-8 text-brand-600" />
                  </div>
                  <h3 className="text-gray-900 font-bold">Welcome, {user.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 max-w-[240px] mx-auto">
                    I have full visibility into your fleet, financials, and shipments. How can I help you optimize today?
                  </p>
                </div>
              )}

              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-brand-600 text-white rounded-br-none' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none whitespace-pre-wrap'
                  }`}>
                    {m.content === '' && isTyping ? (
                      <Loader2 className="h-4 w-4 animate-spin opacity-50" />
                    ) : m.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Presets */}
            {messages.length === 0 && (
              <div className="p-4 bg-white border-t border-gray-100 grid grid-cols-3 gap-2">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(p.prompt)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-colors"
                  >
                    <p.icon className="h-4 w-4 text-brand-600" />
                    <span className="text-[10px] font-bold text-gray-600 uppercase text-center">{p.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1 border border-gray-200 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all"
              >
                <input
                  type="text"
                  placeholder="Ask about shipments, payouts..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2.5"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isTyping}
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || isTyping}
                  className="p-1.5 bg-brand-600 text-white rounded-full disabled:opacity-30 transition-opacity"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <p className="text-[10px] text-center text-gray-400 mt-3 font-medium uppercase tracking-tight">
                Fendex Intelligence Core v1.2 • Gemini Powered
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};
