import { useRef, useState } from 'react'
import axios from 'axios'
import { UploadCloud, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * FileUpload component for importing Sierra Chart TradesList exports.
 *
 * Accepts ``.txt`` files, uploads them to ``POST /import``, and
 * passes the parsed result to the parent via ``onDataLoaded``.
 */
const FileUpload = ({ onDataLoaded, setLoading, loading }) => {
    const [error, setError] = useState(null)
    const [importResult, setImportResult] = useState(null)
    const inputRef = useRef(null)

    const handleFileChange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        processFile(file)
    }

    const processFile = async (file) => {
        setLoading(true)
        setError(null)
        setImportResult(null)

        const formData = new FormData()
        formData.append('file', file)

        try {
            const response = await axios.post(
                'http://localhost:8000/import',
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            )

            const data = response.data
            setImportResult(data.import_summary)

            // Short delay so the user can see the import summary
            setTimeout(() => {
                onDataLoaded({
                    data: data.trades,
                    stats: data.stats,
                    charts: data.charts,
                    message: data.message,
                })
            }, 1200)
        } catch (err) {
            console.error(err)
            const msg = err.response?.data?.detail
                || "Failed to process file. Ensure it's a valid Sierra Chart TradesList export."
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
                style={{
                    border: '2px dashed rgba(99, 102, 241, 0.3)',
                    borderRadius: '16px',
                    padding: '3rem 4rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                }}
            >
                <input
                    type="file"
                    ref={inputRef}
                    className="hidden"
                    accept=".txt,.csv"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />

                {loading ? (
                    importResult ? (
                        <div className="flex flex-col items-center gap-2">
                            <CheckCircle2
                                size={48}
                                style={{ color: 'var(--success)' }}
                            />
                            <p style={{ color: 'var(--success)', fontWeight: 600, fontSize: '1.1rem' }}>
                                {importResult.inserted} trades imported
                            </p>
                            {importResult.skipped > 0 && (
                                <p className="text-secondary" style={{ fontSize: '0.9rem' }}>
                                    {importResult.skipped} duplicates skipped
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2
                                size={48}
                                className="animate-spin"
                                style={{ color: 'var(--accent)' }}
                            />
                            <p className="text-secondary">
                                Parsing trades…
                            </p>
                        </div>
                    )
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <UploadCloud size={64} className="text-secondary mb-4" />
                        <h2 style={{ fontSize: '1.8rem', margin: 0 }}>
                            Import Sierra Chart Trades
                        </h2>
                        <p className="text-secondary">
                            Drag & drop your <strong>TradesList</strong> file here or click to browse
                        </p>
                        <p className="text-secondary" style={{ opacity: 0.5, fontSize: '0.85rem', marginTop: '0.5rem' }}>
                            Accepts TradesList(sierra).txt exports · Duplicates are auto-skipped
                        </p>
                    </div>
                )}
            </div>

            {error && (
                <div
                    className="mt-4 flex items-center gap-2"
                    style={{
                        color: 'var(--danger)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        padding: '1rem 1.5rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        marginTop: '1rem',
                    }}
                >
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}
        </div>
    )
}

export default FileUpload
