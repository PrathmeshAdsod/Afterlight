"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Circle, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { stepStatusColor } from "@/lib/utils";
import type { SetupStatus, SetupStep } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  pending: "Pending",
  running: "Running",
  done: "Complete",
  error: "Error",
  tool_missing: "Tool missing",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 size={16} className="text-emerald-300" />;
  if (status === "running") return <Loader2 size={16} className="animate-spin text-blue-bright" />;
  if (status === "error") return <XCircle size={16} className="text-red-300" />;
  if (status === "tool_missing") return <AlertTriangle size={16} className="text-amber-300" />;
  return <Circle size={16} className="text-text-muted" />;
}

function StepRow({ step }: { step: SetupStep }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = step.error || step.tool_missing || step.metrics || step.setup_instruction;

  return (
    <div className="border-b border-border-subtle last:border-0">
      <button
        type="button"
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.025]"
        onClick={() => hasDetail && setExpanded((value) => !value)}
      >
        <StatusIcon status={step.status} />
        <span className="flex-1 text-sm text-text-primary">{step.step_name}</span>
        <span className={`text-xs ${stepStatusColor(step.status)}`}>{STATUS_LABELS[step.status] || step.status}</span>
        {hasDetail && (expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />)}
      </button>

      {expanded && hasDetail && (
        <div className="space-y-2 px-12 pb-4">
          {step.tool_missing && (
            <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-xs">
              <p className="mb-1 font-medium text-amber-200">Tool missing: {step.tool_missing}</p>
              {step.setup_instruction && (
                <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-text-secondary">
                  {step.setup_instruction}
                </pre>
              )}
            </div>
          )}
          {step.error && (
            <div className="rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-xs">
              <p className="mb-1 font-medium text-red-200">Error</p>
              <p className="text-text-secondary">{step.error}</p>
            </div>
          )}
          {step.metrics && (
            <div className="rounded-lg border border-blue-mid/20 bg-blue-mid/10 p-3 text-xs">
              <p className="mb-2 font-medium text-blue-bright">Metrics</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {Object.entries(step.metrics).map(([key, value]) => (
                  <span key={key} className="text-text-muted">
                    {key}: <span className="text-text-secondary">{String(value)}</span>
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
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const [setupStatus, adapterStatus] = await Promise.all([
        api.getSetupStatus(id) as Promise<SetupStatus>,
        api.getAdapterJob(id).catch(() => null) as Promise<Record<string, unknown> | null>,
      ]);
      setStatus(setupStatus);
      setAdapter(adapterStatus);
    } catch {} finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(loadStatus);
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const hasRunningStep = status?.steps.some((step) => step.status === "running");

  return (
    <div className="page-surface max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="page-kicker">Setup</p>
            <h1 className="page-title mt-2">Presence Model Setup</h1>
            <p className="page-subtitle mt-2">Real processing status for the local pipeline.</p>
          </div>
          {hasRunningStep && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-mid/25 bg-blue-mid/10 px-3 py-2 text-sm text-blue-bright">
              <Loader2 size={15} className="animate-spin" />
              Processing
            </div>
          )}
        </div>

        {status && (
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Steps done", value: `${status.summary.completed_steps}/${status.summary.total_steps}` },
              { label: "Memory cards", value: status.summary.memory_cards_created },
              { label: "Persona capsule", value: status.summary.has_persona_capsule ? "Ready" : "Pending" },
            ].map((summary) => (
              <div key={summary.label} className="card-glass p-4">
                <p className="font-serif text-3xl text-gold-bright">{summary.value}</p>
                <p className="mt-1 text-xs text-text-muted">{summary.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="card-glass mb-6 overflow-hidden">
          {status?.steps.map((step) => <StepRow key={step.step_index} step={step} />) || (
            <div className="p-8 text-center text-sm text-text-muted">
              {loading ? "Loading..." : "No pipeline data. Upload and process assets first."}
            </div>
          )}
        </div>

        <div className="card-glass p-6">
          <h2 className="font-serif text-2xl text-text-primary">Adapter Fine-Tuning</h2>
          {adapter ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${
                  adapter.adapter_ready ? "text-emerald-300" :
                  adapter.status === "running" ? "text-blue-bright" :
                  adapter.status === "failed" ? "text-red-300" : "text-text-muted"
                }`}>
                  {adapter.adapter_ready ? "Adapter ready" :
                   adapter.status === "running" ? "Training running..." :
                   adapter.status === "failed" ? "Training failed" :
                   "Adapter not trained yet"}
                </span>
              </div>
              {Boolean(adapter.training_command) && (
                <div className="rounded-lg border border-blue-mid/20 bg-blue-mid/10 p-3">
                  <p className="mb-2 text-xs font-medium text-blue-bright">Training command</p>
                  <code className="break-all text-xs text-text-secondary">{String(adapter.training_command)}</code>
                </div>
              )}
              {Boolean(adapter.metrics) && (
                <div className="text-xs text-text-muted">
                  Loss: <span className="text-gold-bright">{String((adapter.metrics as Record<string, unknown>).train_loss ?? "-")}</span>
                  {" - "}Runtime: <span className="text-gold-bright">{String((adapter.metrics as Record<string, unknown>).train_runtime_seconds ?? "-")}s</span>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-text-muted">
              No adapter job created. Generate training data and call{" "}
              <code className="text-xs text-blue-bright">POST /api/memory-spaces/{id}/train-adapter</code>.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
