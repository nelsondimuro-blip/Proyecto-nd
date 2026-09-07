import 'server-only'
import { serverEnv } from '@/lib/env'

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GatewayError'
  }
}

/**
 * Llama al gateway de WhatsApp. Solo desde el servidor: el secreto compartido
 * nunca debe llegar al navegador.
 */
export async function callGateway<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { gatewayUrl, gatewaySecret } = serverEnv()

  let response: Response
  try {
    response = await fetch(`${gatewayUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        'x-gateway-secret': gatewaySecret,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    })
  } catch (err) {
    throw new GatewayError(`No se pudo contactar al gateway: ${(err as Error).message}`, 503)
  }

  const text = await response.text()
  const payload = text ? (JSON.parse(text) as any) : null

  if (!response.ok) {
    throw new GatewayError(payload?.error ?? `El gateway respondio ${response.status}`, response.status)
  }

  return payload as T
}
