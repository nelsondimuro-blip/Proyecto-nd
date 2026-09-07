'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface AuthFormState {
  error?: string
  message?: string
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  }
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData)

  if (!email || !password) return { error: 'Ingresa tu correo y contrasenia.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: 'Correo o contrasenia incorrectos.' }

  redirect('/inbox')
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData)

  if (!email || password.length < 8) {
    return { error: 'La contrasenia debe tener al menos 8 caracteres.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return { error: error.message }

  // Si el proyecto exige confirmacion por correo no hay sesion todavia.
  if (!data.session) {
    return { message: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesion.' }
  }

  redirect('/onboarding')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
