'use client'

import { useActionState } from 'react'
import { createOrganization, type OnboardingState } from './actions'

export default function OnboardingForm() {
  const [state, action, pending] = useActionState(createOrganization, {} as OnboardingState)

  return (
    <form action={action}>
      {state.error ? <p className="alert">{state.error}</p> : null}

      <div className="field">
        <label htmlFor="name">Nombre del grupo</label>
        <input id="name" name="name" placeholder="Ej. Grupo Comercial ND" required />
      </div>

      <button className="btn" type="submit" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Creando...' : 'Crear espacio de trabajo'}
      </button>
    </form>
  )
}
