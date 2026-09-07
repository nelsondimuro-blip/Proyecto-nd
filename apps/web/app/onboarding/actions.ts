'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface OnboardingState {
  error?: string
}

export async function createOrganization(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const name = String(formData.get('name') ?? '').trim()

  if (name.length < 2) return { error: 'Escribe el nombre del grupo de negocios.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { error } = await supabase.rpc('create_organization', { p_name: name })

  if (error) return { error: `No se pudo crear el espacio: ${error.message}` }

  redirect('/accounts')
}
