import LoginForm from './LoginForm'

export const metadata = { title: 'Entrar | Bandeja WhatsApp' }

export default function LoginPage() {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <h1 style={{ margin: '0 0 6px', fontSize: 20 }}>Bandeja unificada de WhatsApp</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>
          Todos los numeros del grupo de negocios en un solo lugar.
        </p>
        <LoginForm />
      </div>
    </main>
  )
}
