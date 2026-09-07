'use client'

import { useActionState, useState } from 'react'
import { signIn, signUp, type AuthFormState } from './actions'

const initialState: AuthFormState = {}

export default function LoginForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [state, action, pending] = useActionState(mode === 'signin' ? signIn : signUp, initialState)

  return (
    <form action={action}>
      {state.error ? <p className="alert">{state.error}</p> : null}
      {state.message ? (
        <p className="alert" data-tone="info">
          {state.message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="field">
        <label htmlFor="password">Contrasenia</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          required
        />
      </div>

      <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Un momento...' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
      </button>

      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        {mode === 'signin' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
        <button
          type="button"
          className="chip"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Registrarme' : 'Iniciar sesion'}
        </button>
      </p>
    </form>
  )
}
