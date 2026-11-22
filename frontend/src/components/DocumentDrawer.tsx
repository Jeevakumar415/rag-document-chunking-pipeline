import {
  Check,
  Clock3,
  FileText,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";

import type { DocumentItem } from "../types";

interface DocumentDrawerProps {
  documents: DocumentItem[];
  loading: boolean;
  error: string;
  retryingIds: Set<number>;
  onClose: () => void;
  onRefresh: () => void;
  onRetry: (documentId: number) => void;
}

function statusStyles(status: string): string {
  if (status === "completed") {
    return "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300";
  }
  if (status === "failed") {
    return "border-rose-400/15 bg-rose-400/[0.07] text-rose-300";
  }
  return "border-amber-300/15 bg-amber-300/[0.07] text-amber-200";
}

export default function DocumentDrawer({
  documents,
  loading,
  error,
  retryingIds,
  onClose,
  onRefresh,
  onRetry,
}: DocumentDrawerProps) {
  const readyCount = documents.filter(
    (document) => document.processing_status === "completed",
  ).length;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close workspace files"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
      />
      <section
        aria-labelledby="document-drawer-title"
        className="relative flex h-full w-full max-w-[410px] flex-col border-l border-white/[0.08] bg-[#0e1521] shadow-2xl shadow-black/50"
      >
        <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-cyan-300">
              Context files
            </p>
            <h2
              id="document-drawer-title"
              className="mt-1 text-lg font-semibold text-slate-100"
            >
              Workspace documents
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {readyCount} ready to search · {documents.length} total
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Refresh documents"
              aria-label="Refresh documents"
              onClick={onRefresh}
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-100"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-100"
            >
              <X size={17} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
            Available to chat
          </p>
          {error && (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-3 py-2.5 text-xs leading-5 text-rose-200"
            >
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
              <LoaderCircle size={15} className="animate-spin" /> Loading documents
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.09] px-5 py-10 text-center">
              <FileText size={22} className="mx-auto text-slate-600" />
              <p className="mt-3 text-sm text-slate-300">No documents uploaded</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Use the attach button below the chat to add a file.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-400/[0.08] text-blue-300">
                      <FileText size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">
                        {document.filename}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {document.file_type.toUpperCase()} ·{" "}
                        {new Intl.NumberFormat(undefined, {
                          maximumFractionDigits: 1,
                        }).format(document.file_size / 1024)}{" "}
                        KB
                      </p>
                      <span
                        className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] ${statusStyles(document.processing_status)}`}
                      >
                        {document.processing_status === "completed" ? (
                          <Check size={11} />
                        ) : document.processing_status === "failed" ? (
                          <X size={11} />
                        ) : (
                          <Clock3 size={11} />
                        )}
                        {document.processing_status === "completed"
                          ? "Ready"
                          : document.processing_status === "failed"
                            ? "Failed"
                            : "Processing"}
                      </span>
                      {typeof document.chunk_count === "number" && (
                        <span className="mt-2 block text-[10px] text-slate-500">
                          {document.chunk_count}{" "}
                          {document.chunk_count === 1 ? "chunk" : "chunks"} indexed
                        </span>
                      )}
                    </div>
                    {document.processing_status === "failed" && (
                      <button
                        type="button"
                        disabled={retryingIds.has(document.id)}
                        onClick={() => onRetry(document.id)}
                        className="shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-medium text-blue-300 transition hover:bg-blue-400/10 hover:text-cyan-200 disabled:opacity-50"
                      >
                        {retryingIds.has(document.id) ? (
                          <LoaderCircle size={13} className="animate-spin" />
                        ) : (
                          "Retry"
                        )}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="border-t border-white/[0.07] px-5 py-3 text-[10px] leading-4 text-slate-600">
          Only ready documents are included when searching for answers.
        </footer>
      </section>
    </div>
  );
}
