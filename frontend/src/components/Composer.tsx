import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUp,
  Check,
  FileText,
  LoaderCircle,
  Paperclip,
  X,
} from "lucide-react";

import type { DocumentItem } from "../types";

interface ComposerProps {
  disabled?: boolean;
  sending: boolean;
  onSend: (prompt: string) => void;
  onUpload: (
    file: File,
    onProgress: (progress: number) => void,
  ) => Promise<DocumentItem>;
  onRetryDocument: (documentId: number) => void;
  onOpenDocuments: () => void;
}

interface UploadNotice {
  filename: string;
  progress: number;
  status: "uploading" | "processing" | "completed" | "failed";
  document?: DocumentItem;
  error?: string;
}

const ACCEPTED_TYPES = new Set(["pdf", "docx", "txt", "md", "csv"]);

function isSupportedFile(file: File): boolean {
  return ACCEPTED_TYPES.has(file.name.split(".").pop()?.toLowerCase() ?? "");
}

export default function Composer({
  disabled = false,
  sending,
  onSend,
  onUpload,
  onRetryDocument,
  onOpenDocuments,
}: ComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [upload, setUpload] = useState<UploadNotice | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const uploadFile = async (file?: File) => {
    if (!file || upload?.status === "uploading") return;
    if (!isSupportedFile(file)) {
      setUpload({
        filename: file.name,
        progress: 0,
        status: "failed",
        error: "Choose a PDF, DOCX, TXT, MD, or CSV file.",
      });
      return;
    }

    setUpload({ filename: file.name, progress: 0, status: "uploading" });
    try {
      const document = await onUpload(file, (progress) => {
        setUpload((current) =>
          current ? { ...current, progress } : current,
        );
      });
      setUpload({
        filename: document.filename,
        progress: 100,
        status:
          document.processing_status === "failed"
            ? "failed"
            : document.processing_status === "completed"
              ? "completed"
              : "processing",
        document,
        error:
          document.processing_status === "failed"
            ? "Upload saved, but processing needs a retry."
            : undefined,
      });
    } catch (error) {
      setUpload({
        filename: file.name,
        progress: 0,
        status: "failed",
        error:
          error instanceof Error ? error.message : "The file could not be uploaded.",
      });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || sending || disabled) return;
    onSend(message);
    setPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    void uploadFile(event.target.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void uploadFile(event.dataTransfer.files[0]);
  };

  return (
    <div
      data-composer-dropzone
      className="relative mx-auto w-full max-w-[820px] px-4 pb-4 pt-2 sm:px-7 sm:pb-6"
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-2xl border border-dashed border-cyan-300/50 bg-[#0b0f17]/95 text-center shadow-[0_0_40px_rgba(6,182,212,0.12)]">
          <div>
            <Paperclip size={22} className="mx-auto text-cyan-200" />
            <p className="mt-2 text-sm font-medium text-slate-100">
              Drop to add to your workspace
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              PDF, DOCX, TXT, MD, or CSV
            </p>
          </div>
        </div>
      )}
      {upload && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#111827] px-3 py-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-400/[0.08] text-blue-300">
            {upload.status === "uploading" || upload.status === "processing" ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : upload.status === "completed" ? (
              <Check size={14} className="text-emerald-300" />
            ) : (
              <FileText size={14} className="text-rose-300" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] text-slate-300">
              {upload.filename}
            </span>
            {upload.status === "uploading" ? (
              <span
                role="progressbar"
                aria-valuenow={upload.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Uploading ${upload.filename}`}
                className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.07]"
              >
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-[width]"
                  style={{ width: `${Math.max(upload.progress, 4)}%` }}
                />
              </span>
            ) : upload.status === "processing" ? (
              <span className="mt-0.5 block text-[10px] text-amber-200">
                Uploaded · processing document
              </span>
            ) : upload.error ? (
              <span className="mt-0.5 block truncate text-[10px] text-rose-300">
                {upload.error}
              </span>
            ) : (
              <span className="mt-0.5 block text-[10px] text-emerald-300">
                Added to workspace · ready to search
              </span>
            )}
          </span>
          {upload.status === "failed" && upload.document && (
            <button
              type="button"
              onClick={() => {
                if (upload.document) onRetryDocument(upload.document.id);
              }}
              className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium text-blue-300 hover:bg-blue-400/10"
            >
              Retry
            </button>
          )}
          {upload.status === "failed" && !upload.document && (
            <button
              type="button"
              onClick={onOpenDocuments}
              className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium text-blue-300 hover:bg-blue-400/10"
            >
              Files
            </button>
          )}
          {upload.status !== "uploading" && (
            <button
              type="button"
              aria-label="Dismiss upload status"
              onClick={() => setUpload(null)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}
      <form
        onSubmit={submitPrompt}
        className="rounded-2xl border border-white/[0.09] bg-[#111827] shadow-[0_12px_42px_rgba(0,0,0,0.24)] transition focus-within:border-blue-400/30"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            event.currentTarget.style.height = "auto";
            event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask the RAG Document Chunking Pipeline..."
          aria-label="Ask a question"
          className="max-h-[180px] min-h-12 w-full resize-none bg-transparent px-4 pb-1 pt-4 text-[13px] leading-6 text-slate-100 outline-none placeholder:text-slate-600 sm:px-5"
        />
        <div className="flex items-center justify-between gap-3 px-2.5 pb-2.5 sm:px-3">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.csv"
              className="hidden"
              onChange={handleFileInput}
            />
            <button
              type="button"
              disabled={upload?.status === "uploading"}
              onClick={() => inputRef.current?.click()}
              title="Attach a document"
              aria-label="Attach a document"
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-cyan-200 disabled:opacity-40"
            >
              <Paperclip size={16} />
            </button>
            <span className="hidden text-[10px] text-slate-600 sm:inline">
              Add files · PDF, DOCX, TXT, MD, CSV
            </span>
          </div>
          <div className="flex items-center gap-2">
            {sending && (
              <span className="hidden items-center gap-1.5 text-[10px] text-slate-500 sm:flex">
                <LoaderCircle size={12} className="animate-spin text-cyan-300" />
                Searching
              </span>
            )}
            <button
              type="submit"
              disabled={disabled || sending || !prompt.trim()}
              title="Send message"
              aria-label="Send message"
              className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white shadow-[0_4px_16px_rgba(37,99,235,0.2)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-[#263246] disabled:text-slate-500 disabled:shadow-none"
            >
              {sending ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <ArrowUp size={17} />
              )}
            </button>
          </div>
        </div>
      </form>
      <p className="mt-2 text-center text-[10px] text-slate-600">
        RAG Document Chunking Pipeline can make mistakes. Verify important information.
        <span className="hidden sm:inline"> · Enter to send, Shift+Enter for a new line</span>
      </p>
    </div>
  );
}
