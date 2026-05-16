import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TrustChip } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function trustChipLabel(chip: TrustChip): string {
  const labels: Record<TrustChip, string> = {
    recorded: "Recorded",
    memory_backed: "Memory-backed",
    style_inferred: "Style-inferred",
    unknown: "Unknown",
    restricted: "Restricted",
    system_boundary: "System boundary",
  };
  return labels[chip] || chip;
}

export function trustChipClass(chip: TrustChip): string {
  const classes: Record<TrustChip, string> = {
    recorded: "chip-recorded",
    memory_backed: "chip-memory-backed",
    style_inferred: "chip-style-inferred",
    unknown: "chip-unknown",
    restricted: "chip-restricted",
    system_boundary: "chip-system-boundary",
  };
  return classes[chip] || "chip-style-inferred";
}

export function stepStatusColor(status: string): string {
  switch (status) {
    case "done": return "text-emerald-400";
    case "running": return "text-blue-400";
    case "error": return "text-red-400";
    case "tool_missing": return "text-amber-400";
    case "pending": return "text-text-secondary";
    default: return "text-text-muted";
  }
}

export function stepStatusIcon(status: string): string {
  switch (status) {
    case "done": return "✓";
    case "running": return "●";
    case "error": return "✗";
    case "tool_missing": return "⚠";
    case "pending": return "○";
    default: return "—";
  }
}
