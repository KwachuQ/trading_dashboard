import { useRef, useState } from 'react'
import axios from 'axios'
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react'

const FileUpload = ({ onDataLoaded, setLoading, loading }) => {
    const [error, setError] = useState(null)
    const inputRef = useRef(null)

    const handleFileChange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        processFile(file)
    }

    const processFile = async (file) => {
        setLoading(true)
        setError(null)

        const formData = new FormData()
        formData.append('file', file)

        try {
            // Assuming backend is at localhost:8000
            const response = await axios.post('http://localhost:8000/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            onDataLoaded(response.data)
        } catch (err) {
            console.error(err)
            const msg = err.response?.data?.detail || "Failed to process file. Ensure it's a valid CSV."
            setError(msg)
            setLoading(false)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }

    return (
        <div className="flex flex-col items-center justify-center h-full" style={{ minHeight: '60vh' }}>
            <div
                className="upload-zone"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => inputRef.current.click()}
            >
                <input
                    type="file"
                    ref={inputRef}
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileChange}
                />

                {loading ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 size={48} className="animate-spin text-accent" style={{ color: 'var(--accent)' }} />
                        <p className="text-secondary">Crunching the numbers...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <UploadCloud size={64} className="text-secondary mb-4" />
                        <h2 className="text-3xl">Upload Trading Data</h2>
                        <p className="text-secondary">Drag & drop your .csv file here or click to browse</p>
                        <p className="text-sm text-secondary opacity-50 mt-2">Supports generic trading exports (Date, PnL, Symbol required)</p>
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-4 flex items-center gap-2 text-danger bg-red-900/20 p-4 rounded-lg border border-red-500/20">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}
        </div>
    )
}

export default FileUpload
