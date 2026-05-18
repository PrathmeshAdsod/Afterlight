"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FileAudio, FileImage, FileText, Film, Folder, RefreshCw, UploadCloud, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { formatFileSize } from "@/lib/utils";
import type { Asset } from "@/types";

const ACCEPT = ".mp3,.wav,.m4a,.ogg,.flac,.aac,.mp4,.mov,.avi,.mkv,.webm,.jpg,.jpeg,.png,.bmp,.tiff,.webp,.pdf,.txt";

export default function CapturePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  const loadAssets = useCallback(async () => {
    try {
      const data = await api.listAssets(id);
      setAssets(data as Asset[]);
    } catch {}
  }, [id]);

  useEffect(() => {
    api.listAssets(id)
      .then((data) => setAssets(data as Asset[]))
      .catch(() => {});
  }, [id]);

  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true);
    setError("");
    for (const file of Array.from(files)) {
      try {
        await api.uploadAsset(id, file);
      } catch (err: unknown) {
        setError(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : "error"}`);
      }
    }
    await loadAssets();
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  };

  const triggerProcessing = async () => {
    setProcessing(true);
    try {
      await api.triggerProcessing(id);
      router.push(`/spaces/${id}/setup`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start processing.");
      setProcessing(false);
    }
  };

  const iconFor = (type: string) => {
    const common = "text-gold-bright";
    if (type === "audio") return <FileAudio size={18} className={common} />;
    if (type === "video") return <Film size={18} className={common} />;
    if (type === "image") return <FileImage size={18} className={common} />;
    if (type === "document" || type === "text") return <FileText size={18} className={common} />;
    return <Folder size={18} className={common} />;
  };

  return (
    <div className="page-surface max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <p className="page-kicker">Capture</p>
          <h1 className="page-title mt-2">Capture Studio</h1>
          <p className="page-subtitle mt-2">Upload recordings, videos, photos, letters, PDFs, and plain text.</p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`mb-8 rounded-lg border-2 border-dashed p-10 text-center transition-all ${
            dragOver ? "border-gold-mid bg-gold-glow" : "border-border-gold bg-surface-1/55 hover:bg-gold-glow"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-border-gold bg-gold-glow text-gold-bright">
            <UploadCloud size={26} />
          </div>
          <p className="font-medium text-text-primary">{uploading ? "Uploading..." : "Drop files here or click to browse"}</p>
          <p className="mt-2 text-sm text-text-muted">MP3, WAV, MP4, MOV, JPG, PNG, PDF, TXT</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {assets.length > 0 && (
          <div className="card-glass mb-6 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-text-primary">{assets.length} file{assets.length !== 1 ? "s" : ""} uploaded</h2>
              <button onClick={loadAssets} className="btn-ghost px-3 py-2 text-xs">
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
            <div className="space-y-2">
              {assets.map((asset) => (
                <div key={asset.id} className="panel-muted flex items-center gap-3 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-primary/60">
                    {iconFor(asset.asset_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">{asset.original_filename}</p>
                    <p className="text-xs text-text-muted">
                      {asset.file_size_bytes ? formatFileSize(asset.file_size_bytes) : ""}
                      {asset.duration_seconds ? ` - ${Math.round(asset.duration_seconds / 60)}m` : ""}
                    </p>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs ${
                    asset.processing_status === "done" ? "border-emerald-400/30 text-emerald-300" :
                    asset.processing_status === "running" ? "border-blue-mid/30 text-blue-bright" :
                    "border-border-subtle text-text-muted"
                  }`}>
                    {asset.processing_status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {assets.length > 0 && (
          <button onClick={triggerProcessing} disabled={processing} className="btn-gold w-full py-4 text-base">
            <Workflow size={18} />
            {processing ? "Starting pipeline..." : "Process Memories with Gemma 4"}
          </button>
        )}

        <div className="panel-muted mt-6 p-4 text-xs text-text-muted">
          <p className="font-semibold text-blue-bright">Sample pipeline command</p>
          <code className="mt-2 block break-all text-text-secondary">python backend/scripts/run_sample_pipeline.py --space_id {id}</code>
        </div>
      </motion.div>
    </div>
  );
}
