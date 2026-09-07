/** Variables publicas: llegan al navegador, por eso solo la anon key. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
}

/** Variables privadas: solo se leen en el servidor (route handlers y RSC). */
export function serverEnv() {
  const gatewayUrl = process.env.GATEWAY_URL
  const gatewaySecret = process.env.GATEWAY_SHARED_SECRET

  if (!gatewayUrl || !gatewaySecret) {
    throw new Error('Faltan GATEWAY_URL o GATEWAY_SHARED_SECRET en el entorno del servidor')
  }

  return { gatewayUrl, gatewaySecret }
}
