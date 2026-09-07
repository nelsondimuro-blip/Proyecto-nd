import { redirect } from 'next/navigation'
import { getMembership } from '@/lib/auth'
import OnboardingForm from './OnboardingForm'

export const metadata = { title: 'Crear espacio | Bandeja WhatsApp' }

export default async function OnboardingPage() {
  const { userId, membership } = await getMembership()

  if (!userId) redirect('/login')
  if (membership) redirect('/inbox')

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <h1 style={{ margin: '0 0 6px', fontSize: 20 }}>Crea tu espacio de trabajo</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>
          Es el contenedor de los numeros de WhatsApp, los contactos y las conversaciones del grupo.
        </p>
        <OnboardingForm />
      </div>
    </main>
  )
}
