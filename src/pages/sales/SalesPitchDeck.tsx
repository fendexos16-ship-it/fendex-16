
import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { salesDeckService } from '../../services/salesDeckService';
import { SalesDeckConfig, DeckSlide, UserRole } from '../../types';
import { 
  Presentation, 
  Download, 
  Printer, 
  LayoutTemplate, 
  CheckCircle, 
  MapPin, 
  BarChart2, 
  ShieldCheck, 
  Globe 
} from 'lucide-react';

export const SalesPitchDeck: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<SalesDeckConfig>({
     clientName: '',
     targetCity: '',
     showPricing: true,
     generatedBy: user?.name || '',
     generatedAt: new Date().toISOString()
  });
  const [slides, setSlides] = useState<DeckSlide[]>([]);
  const deckRef = useRef<HTMLDivElement>(null);

  // Permission Guard
  if (user?.role !== UserRole.FOUNDER && user?.role !== UserRole.SALES_AGENT) {
     return <Layout><div className="p-8 text-red-600 font-bold">Authorized Personnel Only</div></Layout>;
  }

  const handleGenerate = async () => {
     if (!config.clientName) return alert("Enter Client Name");
     setLoading(true);
     try {
        const data = await salesDeckService.getDeckData(user!);
        const generatedSlides = salesDeckService.generateSlides(config, data);
        setSlides(generatedSlides);
     } catch(e:any) {
        alert(e.message);
     } finally {
        setLoading(false);
     }
  };

  const handleExport = async (format: 'PDF' | 'PPTX') => {
     if (slides.length === 0) return;
     
     await salesDeckService.logExport(user!, config, format);
     
     if (format === 'PDF') {
        window.print(); // Using browser print to PDF
     } else {
        alert("PPTX Download Simulated. File would be generated server-side in production.");
     }
  };

  // --- SLIDE RENDERER ---
  const renderSlideContent = (slide: DeckSlide) => {
     switch(slide.type) {
        case 'TEXT':
           return (
              <div className="flex flex-col h-full justify-center p-12">
                 <h2 className="text-4xl font-bold text-gray-900 mb-6">{slide.title}</h2>
                 {slide.content.main && <p className="text-2xl text-brand-600 font-medium mb-4">{slide.content.main}</p>}
                 {slide.content.sub && <p className="text-xl text-gray-600 mb-8">{slide.content.sub}</p>}
                 {slide.content.bullets && (
                    <ul className="space-y-4">
                       {slide.content.bullets.map((b: string, i: number) => (
                          <li key={i} className="flex items-center text-xl text-gray-700">
                             <CheckCircle className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" />
                             {b}
                          </li>
                       ))}
                    </ul>
                 )}
                 {slide.content.footer && <div className="mt-auto pt-8 border-t text-sm text-gray-400">{slide.content.footer}</div>}
              </div>
           );
        
        case 'METRICS':
           return (
              <div className="flex flex-col h-full p-12">
                 <h2 className="text-3xl font-bold text-gray-900 mb-10 border-b pb-4">{slide.title}</h2>
                 <div className="grid grid-cols-2 gap-8 flex-1 content-center">
                    {slide.content.metrics.map((m: any, i: number) => (
                       <div key={i} className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
                          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">{m.label}</p>
                          <p className="text-5xl font-extrabold text-brand-600">{m.value}</p>
                       </div>
                    ))}
                 </div>
              </div>
           );

        case 'IMAGE':
           return (
              <div className="flex flex-col h-full p-12">
                 <h2 className="text-3xl font-bold text-gray-900 mb-6">{slide.title}</h2>
                 <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg mb-4">
                    <img src={slide.content.src} alt="Diagram" className="max-h-full opacity-80" />
                 </div>
                 <p className="text-center text-gray-600 italic">{slide.content.desc}</p>
              </div>
           );

        default: return null;
     }
  };

  return (
    <Layout>
       {/* CONTROLS (Hidden on Print) */}
       <div className="print:hidden mb-8">
          <div className="flex justify-between items-center mb-6">
             <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                   <Presentation className="mr-3 h-8 w-8 text-brand-600" /> Sales Pitch Generator
                </h1>
                <p className="text-sm text-gray-500 mt-1">Create data-backed proposals for enterprise clients.</p>
             </div>
             <div className="flex gap-2">
                <Button onClick={() => handleExport('PPTX')} variant="secondary" className="w-auto" disabled={slides.length === 0}>
                   <Download className="h-4 w-4 mr-2" /> PPTX
                </Button>
                <Button onClick={() => handleExport('PDF')} className="w-auto bg-gray-900 hover:bg-black" disabled={slides.length === 0}>
                   <Printer className="h-4 w-4 mr-2" /> Print / PDF
                </Button>
             </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex gap-4 items-end">
             <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Prospect Client Name</label>
                <input 
                   className="w-full border rounded p-2 text-sm" 
                   value={config.clientName} 
                   onChange={e => setConfig({...config, clientName: e.target.value})}
                   placeholder="e.g. Acme Corp"
                />
             </div>
             <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target City (Optional)</label>
                <input 
                   className="w-full border rounded p-2 text-sm" 
                   value={config.targetCity} 
                   onChange={e => setConfig({...config, targetCity: e.target.value})}
                   placeholder="e.g. Mumbai"
                />
             </div>
             <div className="pb-1">
                <label className="flex items-center text-sm font-medium text-gray-700">
                   <input 
                      type="checkbox" 
                      checked={config.showPricing} 
                      onChange={e => setConfig({...config, showPricing: e.target.checked})} 
                      className="mr-2 rounded text-brand-600"
                   />
                   Include Pricing Slide
                </label>
             </div>
             <Button onClick={handleGenerate} isLoading={loading} className="w-auto h-[40px] px-6">
                <LayoutTemplate className="h-4 w-4 mr-2" /> Generate Deck
             </Button>
          </div>
       </div>

       {/* SLIDE PREVIEW */}
       <div ref={deckRef} className="space-y-8 print:space-y-0">
          {slides.length === 0 && !loading && (
             <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-gray-400">
                Configure details above to generate the pitch deck.
             </div>
          )}

          {slides.map((slide, idx) => (
             <div key={slide.id} className="aspect-[16/9] bg-white border border-gray-300 shadow-lg mx-auto max-w-5xl relative print:break-after-page print:border-none print:shadow-none print:w-full print:h-screen print:mx-0">
                {/* Header / Brand Strip */}
                <div className="absolute top-0 left-0 w-full h-2 bg-brand-600"></div>
                <div className="absolute bottom-4 right-6 text-xs text-gray-300 font-mono">
                   FENDEX CONFIDENTIAL | {new Date().toISOString().split('T')[0]} | Slide {idx + 1}
                </div>
                
                {renderSlideContent(slide)}
             </div>
          ))}
       </div>
    </Layout>
  );
};
