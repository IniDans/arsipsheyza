import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, AlertTriangle } from 'lucide-react';
import { call } from '../lib/api';
import { Spinner } from './ui';

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

const asset = (p) => new URL(`./pdfjs/${p}/`, window.location.href).href;
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export default function PdfViewer({ fileId }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTask = useRef(null);
  const [doc, setDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [zoom, setZoom] = useState('fit');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [width, setWidth] = useState(0);

  // Memuat dokumen
  useEffect(() => {
    let cancelled = false;
    let task = null;
    setDoc(null);
    setError('');
    setLoading(true);
    setPageNum(1);
    setPageInput('1');
    (async () => {
      try {
        const [pdfjs, bytes] = await Promise.all([loadPdfjs(), call('files:read', fileId)]);
        if (cancelled) return;
        task = pdfjs.getDocument({
          data: new Uint8Array(bytes),
          cMapUrl: asset('cmaps'),
          cMapPacked: true,
          standardFontDataUrl: asset('standard_fonts'),
          wasmUrl: asset('wasm'),
          iccUrl: asset('iccs'),
          isEvalSupported: false,
        });
        const loaded = await task.promise;
        if (!cancelled) setDoc(loaded);
      } catch (err) {
        if (!cancelled) setError(err?.name === 'PasswordException' ? 'Dokumen PDF dilindungi password.' : err.message || 'Gagal membuka PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      renderTask.current?.cancel();
      task?.destroy()?.catch?.(() => {});
    };
  }, [fileId]);

  // Mengikuti lebar kontainer untuk mode "pas lebar"
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const render = useCallback(async () => {
    if (!doc || !canvasRef.current || !width) return;
    renderTask.current?.cancel();
    try {
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const scale = zoom === 'fit' ? Math.max(0.2, (width - 32) / base.width) : zoom;
      const viewport = page.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const task = page.render({
        canvas,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      renderTask.current = task;
      await task.promise;
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') setError(err.message);
    }
  }, [doc, pageNum, zoom, width]);

  useEffect(() => {
    render();
  }, [render]);

  const total = doc?.numPages || 0;
  const go = (n) => {
    const p = Math.min(Math.max(1, n), total || 1);
    setPageNum(p);
    setPageInput(String(p));
    containerRef.current?.scrollTo({ top: 0 });
  };
  const currentScale = zoom === 'fit' ? null : zoom;
  const zoomStep = (dir) => {
    const cur = currentScale ?? 1;
    const idx = ZOOMS.findIndex((z) => z >= cur);
    const next = dir > 0 ? ZOOMS[Math.min(ZOOMS.length - 1, (ZOOMS[idx] === cur ? idx : idx - 1) + 1)] : ZOOMS[Math.max(0, idx - 1)];
    setZoom(next);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-200/70">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1">
          <ToolButton label="Halaman sebelumnya" onClick={() => go(pageNum - 1)} disabled={pageNum <= 1}>
            <ChevronLeft className="size-4" />
          </ToolButton>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go(Number(pageInput) || 1);
            }}
            className="flex items-center gap-1.5 text-sm text-slate-600"
          >
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
              onBlur={() => go(Number(pageInput) || 1)}
              className="h-7 w-11 rounded-md border border-slate-300 text-center text-sm tabular-nums"
              aria-label="Nomor halaman"
            />
            <span className="tabular-nums">/ {total || '–'}</span>
          </form>
          <ToolButton label="Halaman berikutnya" onClick={() => go(pageNum + 1)} disabled={pageNum >= total}>
            <ChevronRight className="size-4" />
          </ToolButton>
        </div>
        <div className="flex items-center gap-1">
          <ToolButton label="Perkecil" onClick={() => zoomStep(-1)} disabled={currentScale === ZOOMS[0]}>
            <ZoomOut className="size-4" />
          </ToolButton>
          <span className="w-14 text-center text-xs text-slate-600 tabular-nums">
            {zoom === 'fit' ? 'Pas' : `${Math.round(zoom * 100)}%`}
          </span>
          <ToolButton label="Perbesar" onClick={() => zoomStep(1)} disabled={currentScale === ZOOMS[ZOOMS.length - 1]}>
            <ZoomIn className="size-4" />
          </ToolButton>
          <ToolButton label="Pas lebar" onClick={() => setZoom('fit')} active={zoom === 'fit'}>
            <Maximize2 className="size-4" />
          </ToolButton>
        </div>
      </div>
      <div ref={containerRef} className="relative flex-1 overflow-auto p-4">
        {loading && <Spinner label="Membuka dokumen…" />}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-slate-600">
            <AlertTriangle className="mb-2 size-6 text-amber-500" />
            {error}
          </div>
        )}
        <canvas ref={canvasRef} className={`mx-auto bg-white shadow-md ${doc && !error ? '' : 'hidden'}`} />
      </div>
    </div>
  );
}

function ToolButton({ label, children, active, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? 'bg-sky-50 text-navy-700' : ''
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
