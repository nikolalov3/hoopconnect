import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AdminAuthProvider, useAdminAuth, ADMIN_EMAIL } from './context/AdminAuthContext'
import './admin.css'

const LoginPage     = lazy(() => import('./pages/LoginPage'))
const GeneratorPage = lazy(() => import('./pages/GeneratorPage'))
const HistoryPage   = lazy(() => import('./pages/HistoryPage'))
const AdminShell    = lazy(() => import('./layout/AdminShell'))

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="spinner"/>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading, isAdmin } = useAdminAuth()
  const location = useLocation()
  if (loading) return <Spinner/>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }}/>
  if (!isAdmin) return <Navigate to="/login" replace/>
  return children
}

function PublicOnly({ children }) {
  const { user, loading, isAdmin } = useAdminAuth()
  if (loading) return <Spinner/>
  if (user && isAdmin) return <Navigate to="/" replace/>
  return children
}

function Routing() {
  return (
    <Suspense fallback={<Spinner/>}>
      <Routes>
        <Route path="/login" element={<PublicOnly><LoginPage/></PublicOnly>}/>
        <Route element={<ProtectedRoute><AdminShell/></ProtectedRoute>}>
          <Route path="/"        element={<GeneratorPage/>}/>
          <Route path="/history" element={<HistoryPage/>}/>
        </Route>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </Suspense>
  )
}

export default function AdminApp() {
  useEffect(() => {
    document.documentElement.classList.add('admin-panel-root')
    document.body.classList.add('admin-panel')
    const prev = document.title
    document.title = 'Admin | HoopConnect'
    return () => {
      document.documentElement.classList.remove('admin-panel-root')
      document.body.classList.remove('admin-panel')
      document.title = prev
    }
  }, [])

  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Routing/>
      </AdminAuthProvider>
    </BrowserRouter>
  )
}
