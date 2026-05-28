import { AdminSidebar, ADMIN_NAV_ITEMS } from '../components/AdminSidebar.js'

function AdminOverview() {
  return (
    <div class="admin-overview">
      <h1 class="admin-page-title">Admin overview</h1>
      <p class="admin-page-lead color-fg-muted">
        Manage rooster runtime data and configuration. Pick a section from the sidebar.
      </p>
      <ul class="admin-overview-list">
        {ADMIN_NAV_ITEMS.filter((item) => item.slug !== '').map((item) => (
          <li key={item.slug}>
            <a href={`/admin/${item.slug}`} class="admin-overview-link">
              <span class="admin-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AdminSectionPlaceholder({ slug }: { slug: string }) {
  const item = ADMIN_NAV_ITEMS.find((nav) => nav.slug === slug)
  if (!item) {
    return (
      <div class="admin-section-placeholder">
        <h1 class="admin-page-title">Unknown admin section</h1>
        <p class="admin-page-lead color-fg-muted">
          No admin section named "{slug}". Return to the <a href="/admin">admin overview</a>.
        </p>
      </div>
    )
  }
  return (
    <div class="admin-section-placeholder">
      <h1 class="admin-page-title">{item.label}</h1>
      <p class="admin-page-lead color-fg-muted">
        This admin section ships in a later phase. Tracked separately from Phase 3.1.
      </p>
    </div>
  )
}

export function AdminLayout({ section }: { path?: string; section?: string }) {
  const slug = section ?? ''
  const knownSlugs = new Set(ADMIN_NAV_ITEMS.map((item) => item.slug))
  const activeSlug = knownSlugs.has(slug) ? slug : ''

  return (
    <div class="admin-layout">
      <AdminSidebar activeSlug={activeSlug} />
      <main class="admin-content" tabIndex={-1}>
        {slug === '' ? <AdminOverview /> : <AdminSectionPlaceholder slug={slug} />}
      </main>
    </div>
  )
}
