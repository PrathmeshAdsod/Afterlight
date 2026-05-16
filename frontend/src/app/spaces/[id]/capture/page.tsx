"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
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

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true);
    setError("");
    const arr = Array.from(files);
    for (const file of arr) {
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

  const typeIcon: Record<string, string> = {
    audio: "🎙", video: "🎬", image: "🖼", document: "📄", text: "📝"
  };

  return (
    <div className="p-10 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-serif text-4xl text-text-primary mb-2">Capture Studio</h1>
        <p className="text-text-secondary text-sm mb-8">Upload audio recordings, videos, photos, letters, and documents.</p>

        {/* Drop zone */}
        <div onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-16 text-center cursor-pointer transition-all mb-8 ${
            dragOver ? "border-gold-mid bg-gold-glow" : "border-border-gold hover:border-gold-dim hover:bg-gold-glow"
          }`}>
          <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden"
            onChange={e => e.target.files && uploadFiles(e.target.files)} />
          <div className="text-4xl mb-4">{uploading ? "⏳" : "☁"}</div>
          <p className="text-text-primary font-medium mb-1">
            {uploading ? "Uploading..." : "Drop files here or click to browse"}
          </p>
          <p className="text-xs text-text-muted mt-2">
            Audio · Video · Images · PDFs · Text files
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {["MP3","WAV","MP4","MOV","JPG","PNG","PDF","TXT"].map(f => (
              <span key={f} className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(201,154,69,0.08)", border: "1px solid rgba(201,154,69,0.15)", color: "#B8AA96" }}>{f}</span>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm p-3 rounded-lg mb-4"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}

        {/* Asset list */}
        {assets.length > 0 && (
          <div className="card-glass p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl text-text-primary">{assets.length} file{assets.length !== 1 ? "s" : ""} uploaded</h2>
              <button onClick={loadAssets} className="text-xs text-text-muted hover:text-gold-dim transition-colors">↻ Refresh</button>
            </div>
            <div className="space-y-2">
              {assets.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-lg">{typeIcon[a.asset_type] || "📁"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{a.original_filename}</p>
                    <p className="text-xs text-text-muted">
                      {a.file_size_bytes ? formatFileSize(a.file_size_bytes) : ""}{" "}
                      {a.duration_seconds ? `· ${Math.round(a.duration_seconds / 60)}m` : ""}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    a.processing_status === "done" ? "text-emerald-400" :
                    a.processing_status === "running" ? "text-blue-400" : "text-text-muted"
                  }`} style={{ background: "rgba(255,255,255,0.04)" }}>
                    {a.processing_status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Process button */}
        {assets.length > 0 && (
          <button onClick={triggerProcessing} disabled={processing}
            className="btn-gold w-full py-4 text-base flex items-center justify-center gap-2">
            {processing ? "Starting pipeline..." : <><span>◎</span> Process Memories with Gemma 4</>}
          </button>
        )}

        {/* Sample pipeline tip */}
        <div className="mt-6 p-4 rounded-xl text-xs text-text-muted"
          style={{ background: "rgba(56,163,255,0.04)", border: "1px solid rgba(56,163,255,0.1)" }}>
          <p className="font-medium text-blue-mid mb-1">Running the sample pipeline</p>
          <code className="text-text-secondary">python backend/scripts/run_sample_pipeline.py --space_id {id}</code>
        </div>
      </motion.div>
    </div>
  );
}
