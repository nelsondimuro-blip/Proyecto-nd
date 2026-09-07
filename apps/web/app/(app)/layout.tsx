import Sidebar from '@/components/Sidebar'
import { requireMembership } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { membership } = await requireMembership()

  return (
    <div className="app-shell">
      <Sidebar orgName={membership.organizations?.name ?? 'ND'} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}
