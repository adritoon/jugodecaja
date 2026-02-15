"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Check, X, Tv, Settings, LogOut, Play, Loader2, 
  ExternalLink, History, Repeat, Power, PowerOff, Infinity
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [idleMode, setIdleMode] = useState("loading");
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();
  const router = useRouter();

  const fetchData = async () => {
    const { data: vids } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
    const { data: sets } = await supabase.from("settings").select("*");
    
    if (vids) setVideos(vids);
    if (sets) {
      const mode = sets.find(s => s.key === 'idle_mode')?.value;
      // Solo actualizamos si es diferente para no causar parpadeos
      if (mode) setIdleMode(mode);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Suscripción a cambios en tiempo real (Videos y Settings)
    const channel = supabase
      .channel('admin-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, (payload) => {
        console.log("Cambio en videos:", payload);
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
        console.log("Cambio en configuración:", payload);
        fetchData();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log("🟢 Conectado a Realtime");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Cambiar entre Modo Carga y Modo Loop (Optimistic UI)
  const toggleIdleMode = async (mode: 'loop' | 'loading') => {
    // 1. Cambiamos el estado visual INMEDIATAMENTE
    setIdleMode(mode); 
    
    // 2. Enviamos el cambio a la base de datos
    await supabase.from("settings").update({ value: mode }).eq("key", "idle_mode");
    
    // NO llamamos a fetchData() aquí para evitar que un dato viejo nos revierta el cambio.
    // La suscripción realtime se encargará de confirmar el cambio si viene de otro lado.
  };

  // Marcar un video del historial como el Loop oficial
  const setVideoAsLoop = async (id: string) => {
    // 1. Reseteamos todos y marcamos el nuevo
    await supabase.from("videos").update({ is_loop_target: false }).neq("id", id);
    await supabase.from("videos").update({ is_loop_target: true }).eq("id", id);
    
    // Si el modo no estaba en loop, lo activamos visualmente y en DB
    if (idleMode !== 'loop') toggleIdleMode('loop');
    
    // Aquí sí hacemos fetch porque cambiamos datos de videos
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    // Actualización optimista para que la interfaz se sienta instantánea
    setVideos(prev => prev.map(v => v.id === id ? { ...v, status } : v));
    await supabase.from("videos").update({ status }).eq("id", id);
    // fetchData() será llamado por el evento realtime
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-pink-500" /></div>;

  const currentPlaying = videos.find(v => v.status === 'playing');
  const approvedQueue = videos.filter(v => v.status === 'approved');
  const pendingQueue = videos.filter(v => v.status === 'pending');
  const historyQueue = videos.filter(v => v.status === 'finished').slice(0, 20); 
  
  const currentLoopVideo = videos.find(v => v.is_loop_target === true);

  const displayPlaying = currentPlaying || (idleMode === 'loop' && currentLoopVideo ? {
    ...currentLoopVideo,
    submitted_by: 'SISTEMA (LOOP)',
    isLoop: true
  } : null);

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 font-sans">
      <header className="flex justify-between items-center mb-10 border-b border-zinc-800 pb-6">
        <h1 className="text-2xl font-black italic tracking-tighter text-pink-500 uppercase">ZubitoTV Admin</h1>
        <button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} className="text-zinc-500 hover:text-red-500 flex items-center gap-2 font-bold text-xs transition-colors uppercase">
          <LogOut size={16}/> Cerrar Sesión
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA 1: CONTROLES */}
        <div className="space-y-6">
          <section className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-2xl">
            <h2 className="text-pink-500 font-bold text-xs uppercase mb-6 flex items-center gap-2 tracking-widest"><Settings size={16}/> Control de Espera</h2>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button 
                onClick={() => toggleIdleMode('loop')}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${idleMode === 'loop' ? 'bg-pink-600 border-pink-400 text-white shadow-lg shadow-pink-500/20' : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
              >
                <Power size={20} className="mb-2" />
                <span className="text-[10px] font-black uppercase">Activar Loop</span>
              </button>
              <button 
                onClick={() => toggleIdleMode('loading')}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${idleMode === 'loading' ? 'bg-zinc-100 border-white text-black shadow-lg shadow-white/10' : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
              >
                <PowerOff size={20} className="mb-2" />
                <span className="text-[10px] font-black uppercase">Modo Carga</span>
              </button>
            </div>
            
            {currentLoopVideo ? (
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 animate-in fade-in">
                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Video en Bucle Seleccionado:</p>
                <p className="text-xs text-white truncate font-mono">{currentLoopVideo.url}</p>
                <p className="text-[9px] text-pink-500 font-bold mt-1 uppercase">De: {currentLoopVideo.submitted_by}</p>
              </div>
            ) : (
               <p className="text-[10px] text-zinc-600 italic text-center border border-dashed border-zinc-800 p-4 rounded-xl">Selecciona un video del historial para el loop</p>
            )}
          </section>

          <section className={`bg-zinc-900 p-6 rounded-3xl border border-zinc-800 border-l-4 shadow-xl transition-all ${displayPlaying?.isLoop ? 'border-l-pink-500' : 'border-l-emerald-500'}`}>
            <h2 className={`${displayPlaying?.isLoop ? 'text-pink-500' : 'text-emerald-500'} font-bold text-xs uppercase mb-4 flex items-center gap-2 tracking-widest`}><Tv size={16}/> Sonando Ahora</h2>
            {displayPlaying ? (
              <div className="space-y-3 animate-in slide-in-from-left-2">
                <p className="text-sm font-bold leading-tight uppercase tracking-tight italic">
                  {displayPlaying.isLoop ? 'MODO ESPERA (LOOP)' : `Video de ${displayPlaying.submitted_by}`}
                </p>
                <a href={displayPlaying.url} target="_blank" className="text-[10px] font-mono text-zinc-500 block truncate hover:text-white underline">{displayPlaying.url}</a>
                {!displayPlaying.isLoop && (
                  <button onClick={() => updateStatus(displayPlaying.id, 'finished')} className="w-full text-[10px] bg-zinc-800 py-2 rounded-lg hover:bg-red-500/20 hover:text-red-500 text-zinc-400 font-bold transition-all uppercase tracking-widest">Saltar Video</button>
                )}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-zinc-600 text-[10px] italic font-mono uppercase tracking-widest">Esperando pedidos...</p>
              </div>
            )}
          </section>
        </div>

        {/* COLUMNA 2: PENDIENTES */}
        <div className="lg:col-span-1 space-y-8">
          <section>
            <h2 className="text-zinc-400 font-bold text-xs uppercase mb-4 tracking-widest flex items-center gap-2">
              <Play size={14} className="text-pink-500"/> Pendientes ({pendingQueue.length})
            </h2>
            <div className="grid gap-3">
              {pendingQueue.map(v => (
                <div key={v.id} className="bg-zinc-900 p-4 rounded-2xl flex items-center justify-between border border-zinc-800 hover:border-zinc-700 transition-all shadow-lg animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-pink-500 text-[10px] font-black uppercase mb-1">{v.submitted_by}</p>
                    <a href={v.url} target="_blank" className="text-xs font-mono text-zinc-400 truncate flex items-center gap-2 hover:text-white underline decoration-zinc-800 group">
                      Ver Video <ExternalLink size={10}/>
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(v.id, 'approved')} className="bg-emerald-500/20 text-emerald-500 p-2 rounded-lg hover:bg-emerald-500 hover:text-black transition-all shadow-md"><Check size={18}/></button>
                    <button onClick={() => updateStatus(v.id, 'rejected')} className="bg-red-500/20 text-red-500 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-md"><X size={18}/></button>
                  </div>
                </div>
              ))}
              {pendingQueue.length === 0 && (
                <div className="border-2 border-dashed border-zinc-900 rounded-2xl p-8 flex flex-col items-center justify-center text-zinc-700">
                  <p className="text-[10px] uppercase tracking-widest">No hay pedidos nuevos</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-zinc-600 font-bold text-[10px] uppercase mb-4 tracking-widest">Próximos en cola ({approvedQueue.length})</h2>
            <div className="grid gap-2">
              {approvedQueue.map(v => (
                <div key={v.id} className="bg-zinc-900/40 p-3 rounded-xl flex items-center justify-between border border-zinc-800/50">
                  <p className="text-[10px] text-zinc-500 font-mono truncate w-40 italic">{v.url}</p>
                  <button onClick={() => updateStatus(v.id, 'pending')} className="text-[9px] font-bold text-zinc-600 hover:text-white uppercase transition-colors tracking-tighter">Devolver</button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* COLUMNA 3: HISTORIAL Y SELECCIÓN DE LOOP */}
        <div className="lg:col-span-1">
          <section className="bg-zinc-950/50 border border-zinc-900 rounded-3xl p-6">
            <h2 className="text-zinc-400 font-bold text-xs uppercase mb-6 tracking-widest flex items-center gap-2">
              <History size={16} className="text-zinc-600"/> Historial Reciente
            </h2>
            <div className="space-y-4">
              {historyQueue.map(v => (
                <div key={v.id} className={`flex items-center justify-between group p-2 rounded-lg transition-all ${v.is_loop_target ? 'bg-pink-500/10 border border-pink-500/20' : 'hover:bg-zinc-900/30'}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-bold uppercase tracking-tight ${v.is_loop_target ? 'text-pink-500' : 'text-zinc-400'}`}>
                      {v.submitted_by} {v.is_loop_target && '(LOOP ACTIVO)'}
                    </p>
                    <p className="text-[9px] font-mono text-zinc-700 truncate opacity-40 italic">{v.url}</p>
                  </div>
                  <div className="flex items-center gap-2">
                     <button 
                      onClick={() => updateStatus(v.id, 'approved')}
                      title="Volver a poner"
                      className="p-2 text-zinc-600 hover:text-emerald-500 transition-colors bg-zinc-900/50 rounded-lg"
                    >
                      <Repeat size={14}/>
                    </button>
                    <button 
                      onClick={() => setVideoAsLoop(v.id)}
                      title="Fijar como Loop"
                      className={`p-2 transition-colors rounded-lg font-black text-[9px] flex items-center gap-1 ${v.is_loop_target ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'bg-zinc-900/50 text-zinc-600 hover:text-pink-500'}`}
                    >
                      <Infinity size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}