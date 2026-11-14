import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

// Mencegah satu halaman yang galat membuat seluruh aplikasi kosong.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card flex flex-col items-center px-6 py-14 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <AlertTriangle className="size-6" />
        </div>
        <p className="font-medium text-slate-800">Halaman ini mengalami kesalahan</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">{String(this.state.error?.message || this.state.error)}</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="size-4" /> Coba lagi
        </button>
      </div>
    );
  }
}
