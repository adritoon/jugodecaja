"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, VolumeX, SkipForward, MonitorPlay } from "lucide-react";

interface Video {
  id: string;
  url: string;
  submitted_by: string;
  status?: string;
  isLoop?: boolean;
}

const LIMIT_DURATION = false; // ¿Activar el corte? (true/false)
const MAX_SECONDS = 60;     // 10 Minutos (600 segundos)

export default function TVPage() {
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const supabase = createClient();
  const playerRef = useRef<any>(null);

  const getYouTubeID = (url: string) => {
    if (!url) return null;
    if (url.length === 11) return url;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    return match ? match[1] : null;
  };

  const fetchStatus = async () => {
    try {
      let { data: videoData } = await supabase.from("videos").select("*").eq("status", "playing").maybeSingle();

      if (!videoData) {
        const { data: nextVideo } = await supabase.from("videos").select("*").eq("status", "approved").order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (nextVideo) {
          videoData = nextVideo;
          await supabase.from("videos").update({ status: "playing" }).eq("id", nextVideo.id);
        }
      }

      if (!videoData) {
        const { data: settings } = await supabase.from("settings").select("*");
        const modeSetting = settings?.find(s => s.key === 'idle_mode');

        if (modeSetting?.value === 'loop') {
          const { data: loopVideo } = await supabase.from("videos").select("*").eq("is_loop_target", true).maybeSingle();
          if (loopVideo) {
            videoData = {
              ...loopVideo,
              id: 'active-loop-system',
              submitted_by: 'SISTEMA (LOOP)',
              isLoop: true 
            };
          }
        }
      }

      if (videoData) {
        setCurrentVideo((prev: Video | null) => {
          if (!prev || prev.id !== videoData!.id) return videoData as Video;
          return prev;
        });
      } else {
        setCurrentVideo(null);
      }

    } catch (e) {
      console.error("Error crítico en fetchStatus:", e);
    }
  };

  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    fetchStatus();
    const interval = setInterval(() => {
        fetchStatus(); // Tu chequeo de base de datos habitual

        // ✅ LÓGICA DE CORTE DE TIEMPO
        if (LIMIT_DURATION && playerRef.current && playerRef.current.getCurrentTime) {
        const currentTime = playerRef.current.getCurrentTime();
        
        // Si el video actual lleva más tiempo del permitido y NO es el loop
        if (currentTime > MAX_SECONDS && currentVideo && !currentVideo.isLoop) {
            console.log("✂️ Tiempo límite excedido. Saltando video...");
            handleNext();
        }
        }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentVideo]);

  const handleNext = async () => {
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (e) {}
      playerRef.current = null;
    }
    
    if (currentVideo && !currentVideo.isLoop) {
      await supabase.from("videos").update({ status: "finished" }).eq("id", currentVideo.id);
    }
    
    setCurrentVideo(null);
    fetchStatus(); 
  };

  useEffect(() => {
    const videoId = currentVideo ? getYouTubeID(currentVideo.url) : null;

    if (videoId && (window as any).YT && (window as any).YT.Player) {
      const currentPlayerVideoId = playerRef.current?.getVideoData?.()?.video_id;
      if (currentPlayerVideoId === videoId) {
        if (playerRef.current.getPlayerState && playerRef.current.getPlayerState() !== 1) playerRef.current.playVideo();
        return;
      }

      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
      }

      playerRef.current = new (window as any).YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          mute: isMuted ? 1 : 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          vq: 'hd1080' // Intento preliminar
        },
        events: {
          // ✅ 1. NUEVO: Al cargar el reproductor, forzamos calidad
          'onReady': (event: any) => {
             event.target.setPlaybackQuality('highres'); // Pide la máxima posible (4K/1080p)
             event.target.playVideo();
          },
          'onStateChange': (event: any) => {
            // ✅ 2. NUEVO: Si empieza a reproducir (status 1), forzamos de nuevo
            if (event.data === 1) { 
               event.target.setPlaybackQuality('highres');
            }

            if (event.data === 0) { // ENDED
              if (currentVideo?.isLoop) event.target.playVideo();
              else handleNext(); 
            }
          },
          'onError': () => {
             if (!currentVideo?.isLoop) handleNext();
          }
        }
      });
    }
  }, [currentVideo?.id, isMuted]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
      {currentVideo ? (
        <div className="absolute inset-0 w-full h-full bg-black">
          <div key={currentVideo.id} className="w-full h-full">
            <div id="youtube-player" className="w-full h-full"></div>
          </div>

          <div className="absolute bottom-10 left-10 bg-black/80 p-6 rounded-xl border-l-4 border-pink-500 z-10 shadow-2xl animate-in slide-in-from-left">
            <p className="text-pink-400 text-xs font-bold uppercase mb-1 tracking-widest">
              {currentVideo.isLoop ? 'Modo Espera' : 'Pedido por'}
            </p>
            <h2 className="text-white text-3xl font-black uppercase tracking-tighter max-w-2xl truncate">
              {currentVideo.submitted_by}
            </h2>
          </div>

          <div className="absolute top-10 right-10 flex gap-4 z-50">
            {isMuted && (
              <button 
                onClick={() => {
                  setIsMuted(false);
                  if (playerRef.current?.unMute) {
                    playerRef.current.unMute();
                    playerRef.current.setVolume(100);
                  }
                }}
                className="bg-white text-black font-bold px-8 py-4 rounded-full flex items-center gap-2 hover:scale-110 transition-all shadow-xl"
              >
                <VolumeX size={24} /> ACTIVA EL SONIDO
              </button>
            )}
            
            {!currentVideo.isLoop && (
              <button onClick={handleNext} className="bg-zinc-900/50 text-white/50 p-3 rounded-full hover:text-white transition-colors">
                <SkipForward size={24} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="relative mb-6">
            <Loader2 className="w-16 h-16 text-pink-500 animate-spin mx-auto opacity-20" />
            <MonitorPlay className="w-8 h-8 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h2 className="text-zinc-500 font-mono text-xs tracking-[0.4em] uppercase">
            Sincronizando señal...
          </h2>
        </div>
      )}
    </div>
  );
}