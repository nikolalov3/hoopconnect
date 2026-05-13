import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'

const Icon = {
  generator: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>
  ),
  history: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4v6h6"/>
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <path d="M16 17l5-5-5-5"/>
      <path d="M21 12H9"/>
    </svg>
  ),
}

const NAV = [
  { to: '/',        label: 'Generator umów', icon: Icon.generator, end: true },
  { to: '/history', label: 'Historia',       icon: Icon.history },
]

export default function AdminShell() {
  const navigate = useNavigate()
  const { signOut, user } = useAdminAuth()
  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <img src="/hoop.svg" alt="" className="admin-sidebar-logo"/>
          <div style={{ lineHeight: 1.1 }}>
            <div className="admin-sidebar-brand-name">HoopConnect</div>
            <div className="admin-sidebar-brand-sub">Admin</div>
          </div>
        </div>
        <nav className="admin-sidebar-nav">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'admin-nav-item' + (isActive ? ' active' : '')}
            >
              <span className="admin-nav-item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          {user?.email && (
            <div style={{ padding: '8px 12px 12px', fontSize: 12, color: '#8A9AB0' }}>
              {user.email}
            </div>
          )}
          <button onClick={handleLogout} className="admin-nav-item"
            style={{ width: '100%', background: 'transparent', border: 'none' }}>
            <span className="admin-nav-item-icon">{Icon.logout}</span>
            <span>Wyloguj</span>
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
