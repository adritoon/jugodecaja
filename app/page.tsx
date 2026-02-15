"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Send, CheckCircle, AlertCircle, Loader2, Clock, Music, User, Sparkles } from "lucide-react";

// Colores definidos en RGB para poder jugar con la opacidad en CSS
const THEMES = [
  { id: "neon", rgb: "217, 70, 239", color: "text-fuchsia-500", btn: "bg-fuchsia-600 hover:bg-fuchsia-500", border: "border-fuchsia-500/30" }, // Fuchsia
  { id: "cyber", rgb: "6, 182, 212", color: "text-cyan-500", btn: "bg-cyan-600 hover:bg-cyan-500", border: "border-cyan-500/30" },    // Cyan
  { id: "acid", rgb: "132, 204, 22", color: "text-lime-500", btn: "bg-lime-600 hover:bg-lime-500", border: "border-lime-500/30" },    // Lime
  { id: "fire", rgb: "249, 115, 22", color: "text-orange-500", btn: "bg-orange-600 hover:bg-orange-500", border: "border-orange-500/30" }, // Orange
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  
  // Ref para el contenedor principal (para actualizar variables CSS directamente)
  const containerRef = useRef<HTMLElement>(null);

  const currentTheme = THEMES[themeIndex];

  // 1. EFECTO: "Spotlight" del Mouse (Optimizado para rendimiento)
  useEffect(() => {
    const updateMousePosition = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      // Actualizamos variables CSS directamente en el DOM (No re-renderiza React)
      containerRef.current.style.setProperty("--x", `${ev.clientX}px`);
      containerRef.current.style.setProperty("--y", `${ev.clientY}px`);
    };

    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);

  // 2. EFECTO: Ciclo de colores (cada 8s)
  useEffect(() => {
    const interval = setInterval(() => setThemeIndex((p) => (p + 1) % THEMES.length), 8000);
    return () => clearInterval(interval);
  }, []);

  // --- LÓGICA ORIGINAL ---
  const getYoutubeDetails = (link: string) => {
    const match = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return (match && match[1]) ? { id: match[1], img: `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` } : null;
  };

  useEffect(() => {
    const lastTime = localStorage.getItem('lastRequestTime');
    if (lastTime) {
      const remaining = 60 - Math.floor((Date.now() - parseInt(lastTime)) / 1000);
      if (remaining > 0) setCooldown(remaining);
    }
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    const details = getYoutubeDetails(url);
    if (details) { setThumbnail(details.img); setStatus("idle"); } 
    else { setThumbnail(null); }
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0 || !thumbnail) return;
    setStatus("loading");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("videos").insert([{
          url: url,
          submitted_by: name.trim().toUpperCase() || "ANÓNIMO",
          status: "pending", 
        }]);
      if (error) throw error;
      localStorage.setItem('lastRequestTime', Date.now().toString());
      setStatus("success"); setUrl(""); setThumbnail(null); setCooldown(60); 
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMsg("Error de conexión.");
    }
  };

  return (
    <main 
      ref={containerRef}
      className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans text-slate-200 relative overflow-hidden transition-colors duration-1000"
      // Pasamos el color actual como variable CSS para que el fondo lo use
      style={{ "--theme-rgb": currentTheme.rgb } as React.CSSProperties}
    >
      
      {/* --- FONDO DE REJILLA INTERACTIVO (Sin Javascript pesado) --- */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Capa 1: Rejilla base (Gris oscuro, siempre visible) */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{ 
            backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', 
            backgroundSize: '50px 50px' 
          }}
        />

        {/* Capa 2: Rejilla de COLOR (Solo visible donde está el mouse) */}
        <div 
          className="absolute inset-0 transition-opacity duration-300"
          style={{ 
            backgroundImage: `linear-gradient(rgba(var(--theme-rgb), 0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--theme-rgb), 0.8) 1px, transparent 1px)`, 
            backgroundSize: '50px 50px',
            // MÁSCARA MÁGICA: Esto hace que solo se vea un círculo alrededor del mouse
            maskImage: 'radial-gradient(circle 300px at var(--x) var(--y), black, transparent)',
            WebkitMaskImage: 'radial-gradient(circle 300px at var(--x) var(--y), black, transparent)',
          }}
        />
        
        {/* Capa 3: Brillo general en el mouse */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(circle 600px at var(--x) var(--y), rgba(var(--theme-rgb), 0.3), transparent 40%)'
          }}
        />
      </div>


      {/* --- TARJETA CENTRAL --- */}
      <div className={`max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 transition-colors duration-1000 ${currentTheme.border}`}>
        
        <div className="text-center mb-8">
          <div className={`inline-flex mb-2 ${currentTheme.color} transition-colors duration-1000`}>
             <Sparkles size={20} />
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">
            Zubito<span className={`${currentTheme.color} transition-colors duration-1000`}>TV</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
            Envía tu video
          </p>
        </div>

        {status === "success" ? (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
            <CheckCircle className={`w-12 h-12 mx-auto mb-4 ${currentTheme.color} transition-colors duration-1000`} />
            <h3 className="text-xl font-bold text-white">¡Enviado!</h3>
            <p className="text-zinc-400 text-sm mb-6 mt-2">Añadido a la cola.</p>
            
            {cooldown > 0 ? (
              <div className="inline-flex items-center gap-2 text-zinc-500 text-xs bg-black/50 px-3 py-2 rounded-lg font-mono border border-white/5">
                <Clock size={12}/> Espera {cooldown}s
              </div>
            ) : (
              <button onClick={() => setStatus("idle")} className={`text-sm font-bold underline decoration-2 underline-offset-4 transition-colors duration-1000 ${currentTheme.color}`}>
                Enviar otro
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {cooldown > 0 && (
              <div className="bg-[#111] border border-white/5 p-3 rounded-xl flex items-center justify-center gap-2 text-zinc-400 text-xs font-mono mb-4">
                 <Clock size={14}/> Enfriamiento: {cooldown}s
              </div>
            )}

            <div className={`relative group ${cooldown > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors duration-1000 group-focus-within:${currentTheme.color}`}>
                <User size={18} />
              </div>
              <input
                type="text"
                placeholder="Tu Apodo (Opcional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className={`w-full bg-[#111] border border-zinc-800 rounded-xl p-4 pl-12 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-all font-bold text-sm`}
              />
            </div>

            <div className={`relative group ${cooldown > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors duration-1000 group-focus-within:${currentTheme.color}`}>
                <Music size={18} />
              </div>
              <input
                type="url"
                placeholder="Pega link de YouTube..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={`w-full bg-[#111] border border-zinc-800 rounded-xl p-4 pl-12 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-all font-mono text-xs`}
                required
              />
            </div>

            {/* Preview sin sombras pesadas */}
            <div className={`transition-all duration-300 overflow-hidden ${thumbnail ? 'max-h-48 opacity-100 pt-2' : 'max-h-0 opacity-0 pt-0'}`}>
              {thumbnail && (
                <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-black">
                  <img src={thumbnail} alt="Preview" className="w-full h-32 object-cover opacity-80" />
                  <div className="absolute bottom-2 left-2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">YT</div>
                </div>
              )}
            </div>

            {msg && status === "error" && (
              <div className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-900/10 p-3 rounded-lg border border-red-900/20">
                <AlertCircle size={16} /> {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading" || cooldown > 0 || !thumbnail}
              className={`w-full ${currentTheme.btn} text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-black/50 active:scale-95 disabled:opacity-50 disabled:grayscale`}
            >
              {status === "loading" ? <Loader2 className="animate-spin" /> : (cooldown > 0 ? "ESPERA..." : <><Send size={18} /> ENVIAR</>)}
            </button>
          </form>
        )}
      </div>
      
      <div className="fixed bottom-4 text-[9px] text-zinc-800 font-mono uppercase tracking-widest pointer-events-none">
         ZUBITO TV
      </div>
    </main>
  );
}