type AdminNavItem = {
  slug: string
  label: string
  icon: string
}

export const ADMIN_NAV_ITEMS: ReadonlyArray<AdminNavItem> = [
  { slug: '', label: 'Overview', icon: '◉' },
  { slug: 'profiles', label: 'Profiles', icon: '⚙' },
  { slug: 'skills', label: 'Skills', icon: '✦' },
  { slug: 'plugins', label: 'Plugins', icon: '◇' },
  { slug: 'memory', label: 'Memory', icon: '◌' },
  { slug: 'models', label: 'Models', icon: '◍' },
  { slug: 'files', label: 'Files', icon: '▣' },
  { slug: 'logs', label: 'Logs', icon: '≡' },
  { slug: 'jobs', label: 'Jobs', icon: '◷' },
  { slug: 'settings', label: 'Settings', icon: '⛭' },
]

export function AdminSidebar({ activeSlug }: { activeSlug: string | null }) {
  return (
    <nav class="admin-sidebar" aria-label="Admin navigation">
      <ul class="admin-nav-list">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = item.slug === activeSlug
          const href = item.slug === '' ? '/admin' : `/admin/${item.slug}`
          return (
            <li key={item.slug || 'overview'} class="admin-nav-item">
              <a
                href={href}
                class={`admin-nav-link${isActive ? ' admin-nav-link--active' : ''}`}
                {...(isActive ? { 'aria-current': 'page' } : {})}
              >
                <span class="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                <span class="admin-nav-label">{item.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
