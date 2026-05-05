"use client";
import { useState, useEffect } from "react";
import { Download, Share, Smartphone, CheckCircle2 } from "lucide-react";

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // iOS Detection
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-100">
        <div className="p-2 bg-green-500 rounded-full text-white">
          <CheckCircle2 size={16} />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-green-600">Aplikace nainstalována</div>
          <div className="text-[11px] text-green-700 font-medium">Užíváte si plnohodnotný zážitek.</div>
        </div>
      </div>
    );
  }

  if (isIOS) {
    return (
      <div className="flex flex-col gap-3">
        <button 
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between px-6 py-4 bg-white border border-stone-100 rounded-2xl shadow-sm hover:bg-stone-50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Smartphone size={20} />
            </div>
            <div className="text-left">
              <div className="text-xs font-black uppercase tracking-widest text-stone-950">Instalovat do iPhone</div>
              <div className="text-[10px] font-bold text-stone-400">Přidat na plochu</div>
            </div>
          </div>
          <Share size={18} className="text-indigo-400" />
        </button>

        {showInstructions && (
          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-[11px] text-indigo-900 leading-relaxed font-medium">
              1. Klikněte na tlačítko <strong className="text-indigo-600">Sdílet</strong> (čtvereček se šipkou nahoru) dole v prohlížeči.<br/>
              2. Sjeďte dolů a zvolte <strong className="text-indigo-600">Přidat na plochu</strong>.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (deferredPrompt) {
    return (
      <button 
        onClick={handleInstallClick}
        className="w-full flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-orange-600 to-coral text-white rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all group"
      >
        <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
          <Download size={20} />
        </div>
        <div className="text-left">
          <div className="text-xs font-black uppercase tracking-widest">Instalovat aplikaci</div>
          <div className="text-[10px] font-bold opacity-80">Rychlejší přístup a offline režim</div>
        </div>
      </button>
    );
  }

  return (
    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 border-dashed flex flex-col items-center gap-2 text-center">
      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">PWA Připraveno</div>
      <div className="text-[11px] text-stone-500 max-w-[200px]">Prohlížeč by vám měl nabídnout instalaci v menu nastavení.</div>
    </div>
  );
}
