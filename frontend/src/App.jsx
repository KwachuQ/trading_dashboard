import { useState, useEffect, useCallback } from 'react'
import FileUpload from './components/FileUpload'
import Dashboard from './components/Dashboard'
import { LayoutDashboard, Upload, Database } from 'lucide-react'

/**
 * Root application component.
 *
 * On mount, attempts to load persisted trades from the backend database.
 * If trades exist, the dashboard is shown immediately.  The user can
 * always import additional files via the header button.
 */
function App() {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [dbStatus, setDbStatus] = useState('connecting') // 'ok' | 'empty' | 'error'

  /**
   * Load trades from the database on application start.
   */
  const loadFromDb = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:8000/trades')
      if (!response.ok) throw new Error('Backend unreachable')

      const data = await response.json()
      if (data.data && data.data.length > 0) {
        setDashboardData(data)
        setDbStatus('ok')
        setShowImport(false)
      } else {
        setDbStatus('empty')
        setShowImport(true)
      }
    } catch {
      setDbStatus('error')
      setShowImport(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFromDb()
  }, [loadFromDb])

  /**
   * Handler called after a successful file import.
   * Updates the dashboard with the freshly returned data.
   */
  const handleDataLoaded = (data) => {
    setDashboardData(data)
    setShowImport(false)
    setLoading(false)
    setDbStatus('ok')
  }

  /**
   * Reload from DB — useful after trade mutations (tag edits, merges).
   */
  const handleRefresh = useCallback(async () => {
    await loadFromDb()
  }, [loadFromDb])

  return (
    <div className="app-container">
      <header>
        <div className="flex items-center gap-2">
          <LayoutDashboard size={32} className="text-secondary" />
          <h1>Trading Dashboard</h1>
          {dbStatus === 'ok' && (
            <span className="flex items-center gap-1 ml-4 text-xs text-emerald-400 opacity-60">
              <Database size={12} />
              DB Connected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {dashboardData && !showImport && (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => setShowImport(true)}
            >
              <Upload size={18} />
              Import Trades
            </button>
          )}
          {showImport && dashboardData && (
            <button
              className="btn-primary flex items-center gap-2 !bg-white/10 !shadow-none"
              onClick={() => setShowImport(false)}
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </header>

      <main>
        {loading ? (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
            <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full mb-4" />
            <p className="text-secondary">Loading trades from database…</p>
          </div>
        ) : showImport ? (
          <FileUpload
            onDataLoaded={handleDataLoaded}
            setLoading={setLoading}
            loading={loading}
          />
        ) : dashboardData ? (
          <Dashboard data={dashboardData} onRefresh={handleRefresh} />
        ) : (
          <FileUpload
            onDataLoaded={handleDataLoaded}
            setLoading={setLoading}
            loading={loading}
          />
        )}
      </main>
    </div>
  )
}

export default App
