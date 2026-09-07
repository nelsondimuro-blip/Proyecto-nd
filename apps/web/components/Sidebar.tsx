'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/login/actions'

const LINKS = [
  { href: '/inbox', icon: '💬', label: 'Bandeja' },
  { href: '/accounts', icon: '📱', label: 'Numeros' },
  { href: '/team', icon: '👥', label: 'Equipo' },
]

export default function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname()

  return (
    <nav className="sidebar" aria-label="Navegacion principal">
      <div className="sidebar-logo" title={orgName}>
        {orgName.slice(0, 2).toUpperCase()}
      </div>

      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="sidebar-link"
          title={link.label}
          aria-label={link.label}
          data-active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
        >
          <span aria-hidden>{link.icon}</span>
        </Link>
      ))}

      <div className="sidebar-spacer" />

      <form action={signOut}>
        <button type="submit" className="sidebar-link" title="Cerrar sesion" style={{ border: 0, background: 'none', cursor: 'pointer' }}>
          <span aria-hidden>⏻</span>
        </button>
      </form>
    </nav>
  )
}
