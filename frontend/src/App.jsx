import { useState } from 'react'
import FileUpload from './components/FileUpload'
import Dashboard from './components/Dashboard'
import { LayoutDashboard } from 'lucide-react'

function App() {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleDataLoaded = (data) => {
    setDashboardData(data)
    setLoading(false)
  }

  return (
    <div className="app-container">
      <header>
        <div className="flex items-center gap-2">
          <LayoutDashboard size={32} className="text-secondary" />
          <h1>Trading Dashboard</h1>
        </div>
        {dashboardData && (
          <button
            className="btn-primary"
            onClick={() => setDashboardData(null)}
          >
            Upload New File
          </button>
        )}
      </header>

      <main>
        {!dashboardData ? (
          <FileUpload onDataLoaded={handleDataLoaded} setLoading={setLoading} loading={loading} />
        ) : (
          <Dashboard data={dashboardData} />
        )}
      </main>
    </div>
  )
}

export default App
