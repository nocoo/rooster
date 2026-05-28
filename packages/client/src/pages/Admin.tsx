import { AdminSidebar, ADMIN_NAV_ITEMS } from '../components/AdminSidebar.js'
import { AdminProfilesPage } from './admin/Profiles.js'
import { AdminSkillsPage } from './admin/Skills.js'
import { AdminPluginsPage } from './admin/Plugins.js'
import { AdminMemoryPage } from './admin/Memory.js'
import { AdminModelsPage } from './admin/Models.js'
import { AdminFilesPage } from './admin/Files.js'

function renderAdminSection(slug: string) {
  if (slug === '') return <AdminOverview />
  if (slug === 'profiles') return <AdminProfilesPage />
  if (slug === 'skills') return <AdminSkillsPage />
  if (slug === 'plugins') return <AdminPluginsPage />
  if (slug === 'memory') return <AdminMemoryPage />
  if (slug === 'models') return <AdminModelsPage />
  if (slug === 'files') return <AdminFilesPage />
  return <AdminSectionPlaceholder slug={slug} />
}

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
  const isKnown = knownSlugs.has(slug)
  const activeSlug = isKnown ? slug : null

  return (
    <div class="admin-layout">
      <AdminSidebar activeSlug={activeSlug} />
      <main class="admin-content" tabIndex={-1}>
        {renderAdminSection(slug)}
      </main>
    </div>
  )
}
