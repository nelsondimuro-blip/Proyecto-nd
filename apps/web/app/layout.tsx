import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bandeja WhatsApp | Proyecto ND',
  description: 'Todos los WhatsApp del grupo de negocios en una sola bandeja de entrada.',
}

export const viewport: Viewport = {
  themeColor: '#0b1013',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
