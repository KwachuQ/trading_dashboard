import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        // CRITICAL FIX: Use setState to trigger re-render with error details
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-red-500 bg-slate-900 h-screen overflow-auto">
                    <h1 className="text-3xl font-bold mb-6">Something went wrong.</h1>

                    <div className="mb-6">
                        <h2 className="text-xl font-semibold mb-2 text-white">Error Message:</h2>
                        <pre className="bg-slate-800 p-4 rounded text-red-300 whitespace-pre-wrap">
                            {this.state.error && this.state.error.toString()}
                            {!this.state.error && "No error object captured (Main Error null)"}
                        </pre>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-xl font-semibold mb-2 text-white">Component Stack:</h2>
                        <pre className="bg-slate-800 p-4 rounded text-slate-400 text-xs whitespace-pre-wrap font-mono">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                            {!this.state.errorInfo && "No stack trace captured"}
                        </pre>
                    </div>

                    <button
                        className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold"
                        onClick={() => window.location.reload()}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
