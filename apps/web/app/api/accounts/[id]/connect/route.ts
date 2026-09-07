import { forwardAccountAction } from '@/lib/accounts'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return forwardAccountAction(id, 'connect')
}
