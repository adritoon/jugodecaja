import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: {
          eventsPerSecond: 0, // Desactiva intentos de conexión
        },
      },
      // Esto fuerza al cliente a no inicializar el canal de websockets
      auth: {
        persistSession: true,
      }
    }
  )
}