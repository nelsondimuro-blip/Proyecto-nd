'use client'

import { usePathname } from 'next/navigation'

/** Solo aporta el estado que necesita el CSS para el modo movil. */
export default function Workspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const threadOpen = /^\/inbox\/[^/]+$/.test(pathname)

  return (
    <div className="workspace" data-thread-open={threadOpen}>
      {children}
    </div>
  )
}
