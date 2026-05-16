"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { stepStatusColor, stepStatusIcon } from "@/lib/utils";
import type { SetupStatus, SetupStep } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  pending: "Pending",
  running: "Running...",
  done: "Complete",
  error: "Error",
  tool_missing: "Tool missing",
};

function StepRow({ step }: { step: SetupStep }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = step.error || step.tool_missing || step.metrics || step.setup_instruction;

  return (
    <div className="border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
      <div className="flex items-center gap-4 py-3.5 px-4 cursor-pointer hover:bg-white/[0.01] transition-colors"
        onClick={() => hasDetail && setExpanded(e => !e)}>
        <span className={`text-sm w-4 font-mono ${stepStatusColor(step.status)}`}>{stepStatusIcon(step.status)}</span>
        <div className="flex-1">
          <span className="text-sm text-text-primary">{step.step_name}</span>
        </div>
        <span className={`text-xs ${stepStatusColor(step.status)}`}>{STATUS_LABELS[step.status] || step.status}</span>
        {step.status === "running" && (
          <div className="w-3 h-3 rounded-full border-2 border-blue-mid border-t-transparent animate-spin" />
        )}
        {hasDetail && <span className="text-text-muted text-xs">{expanded ? "▲" : "▼"}</span>}
      </div>

      {expanded && hasDetail && (
        <div className="px-12 pb-4 space-y-2">
          {step.tool_missing && (
            <div className="p-3 rounded-lg text-xs"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p className="text-amber-400 font-medium mb-1">Tool missing: {step.tool_missing}</p>
              {step.setup_instruction && (
                <pre className="text-text-secondary whitespace-pre-wrap font-mono text-xs mt-1">
                  {step.setup_instruction}
                </pre>
              )}
            </div>
          )}
          {step.error && (
            <div className="p-3 rounded-lg text-xs"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="text-red-400 font-medium mb-1">Error</p>
              <p className="text-text-secondary">{step.error}</p>
            </div>
          )}
          {step.metrics && (
            <div className="p-3 rounded-lg text-xs"
              style={{ background: "rgba(56,163,255,0.04)", border: "1px solid rgba(56,163,255,0.1)" }}>
              <p className="text-blue-mid font-medium mb-2">Metrics</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(step.metrics).map(([k, v]) => (
                  <span key={k} className="text-text-muted">
                    {k}: <span className="text-text-secondary">{String(v)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SetupPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [adapter, setAdapter] = useState<Record<string, unknown> | null>(null);
  type AdapterData = Record<string, unknown>;
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api.getSetupStatus(id) as Promise<SetupStatus>,
        api.getAdapterJob(id).catch(() => null) as Promise<Record<string, unknown> | null>,
      ]);
      setStatus(s);
      setAdapter(a);
    } catch {}
  }, [id]);

  useEffect(() => {
    loadStatus();
    setLoading(false);
    // Poll while running
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const hasRunningStep = status?.steps.some(s => s.status === "running");

  return (
    <div className="p-10 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-serif text-4xl text-text-primary mb-2">Presence Model Setup</h1>
            <p className="text-text-secondary text-sm">Real processing status — no fake indicators.</p>
          </div>
          {hasRunningStep && (
            <div className="flex items-center gap-2 text-blue-mid text-sm">
              <div className="w-2 h-2 rounded-full bg-blue-mid animate-pulse" />
              Processing
            </div>
          )}
        </div>

        {/* Summary */}
        {status && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Steps done", value: `${status.summary.completed_steps}/${status.summary.total_steps}` },
              { label: "Memory cards", value: status.summary.memory_cards_created },
              { label: "Persona capsule", value: status.summary.has_persona_capsule ? "Ready" : "Pending" },
            ].map(s => (
              <div key={s.label} className="card-glass p-4 text-center">
                <p className="font-serif text-2xl text-gold-dim">{s.value}</p>
                <p className="text-xs text-text-muted mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Steps */}
        <div className="card-glass overflow-hidden mb-6">
          {status?.steps.map(step => <StepRow key={step.step_index} step={step} />) || (
            <div className="p-8 text-center text-text-muted text-sm">
              {loading ? "Loading..." : "No pipeline data. Upload and process assets first."}
            </div>
          )}
        </div>

        {/* Adapter status */}
        <div className="card-glass p-6">
          <h2 className="font-serif text-xl text-text-primary mb-3">Adapter Fine-Tuning</h2>
          {adapter ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${
                  adapter.adapter_ready ? "text-emerald-400" :
                  adapter.status === "running" ? "text-blue-400" :
                  adapter.status === "failed" ? "text-red-400" : "text-text-muted"
                }`}>
                  {adapter.adapter_ready ? "✓ Adapter ready" :
                   adapter.status === "running" ? "● Training running..." :
                   adapter.status === "failed" ? "✗ Training failed" :
                   "○ Adapter not trained yet"}
                </span>
              </div>
              {Boolean(adapter.training_command) && (
                <div className="p-3 rounded-lg" style={{ background: "rgba(22,119,255,0.05)", border: "1px solid rgba(56,163,255,0.1)" }}>
                  <p className="text-xs text-blue-mid mb-2 font-medium">Training command</p>
                  <code className="text-xs text-text-secondary break-all">{String(adapter.training_command)}</code>
                </div>
              )}
              {Boolean(adapter.metrics) && (
                <div className="text-xs text-text-muted">
                  Loss: <span className="text-gold-dim">{String((adapter.metrics as Record<string,unknown>).train_loss ?? "—")}</span>
                  {" · "}Runtime: <span className="text-gold-dim">{String((adapter.metrics as Record<string,unknown>).train_runtime_seconds ?? "—")}s</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              No adapter job created. Generate training data and use{" "}
              <code className="text-xs text-blue-mid">POST /api/memory-spaces/{id}/train-adapter</code>{" "}
              to create one.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
