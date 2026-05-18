"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Archive, LockKeyhole, MailOpen, Plus } from "lucide-react";
import { api } from "@/lib/api";

export default function CapsulesPage() {
  const { id } = useParams<{ id: string }>();
  const [capsules, setCapsules] = useState<unknown[]>([]);
  const [form, setForm] = useState({ title: "", description: "", unlock_date: "", recipients: "" });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => api.listCapsules(id).then((data) => setCapsules(data as unknown[])).catch(() => {});

  useEffect(() => {
    api.listCapsules(id)
      .then((data) => setCapsules(data as unknown[]))
      .catch(() => {});
  }, [id]);

  const create = async () => {
    setCreating(true);
    try {
      await api.createCapsule(id, {
        title: form.title,
        description: form.description,
        unlock_date: form.unlock_date || undefined,
        recipients: form.recipients ? form.recipients.split(",").map((recipient) => recipient.trim()) : [],
      });
      setForm({ title: "", description: "", unlock_date: "", recipients: "" });
      setShowForm(false);
      load();
    } catch {} finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-surface max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="page-kicker">Capsules</p>
            <h1 className="page-title mt-2">Legacy Capsules</h1>
            <p className="page-subtitle mt-2">Curate messages and memory bundles for the future.</p>
          </div>
          <button onClick={() => setShowForm((visible) => !visible)} className="btn-ghost">
            <Plus size={17} />
            New Capsule
          </button>
        </div>

        {showForm && (
          <div className="card-glass mb-8 p-6">
            <h2 className="font-serif text-2xl text-text-primary">Create Capsule</h2>
            <div className="mt-5 space-y-4">
              <input className="input-dark" placeholder="Capsule title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              <textarea className="input-dark resize-none" rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              <input className="input-dark" type="date" value={form.unlock_date} onChange={(e) => setForm((f) => ({ ...f, unlock_date: e.target.value }))} />
              <input className="input-dark" placeholder="Recipients, comma-separated" value={form.recipients} onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))} />
              <button onClick={create} disabled={!form.title || creating} className="btn-gold">
                {creating ? "Creating..." : "Create Capsule"}
              </button>
            </div>
          </div>
        )}

        {capsules.length === 0 ? (
          <div className="card-glass py-20 text-center">
            <Archive className="mx-auto mb-4 text-text-muted" size={34} />
            <p className="text-sm text-text-muted">No capsules yet. Create a time-locked legacy message.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(capsules as Array<{ id: string; title: string; description?: string; unlock_date?: string; is_sealed: boolean }>).map((capsule) => {
              const Icon = capsule.is_sealed ? LockKeyhole : MailOpen;
              return (
                <div key={capsule.id} className="card-glass p-6">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-primary/60 text-gold-bright">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="font-serif text-xl text-text-primary">{capsule.title}</h3>
                      {capsule.unlock_date && <p className="mt-1 text-xs text-gold-bright">Opens {new Date(capsule.unlock_date).toLocaleDateString()}</p>}
                    </div>
                  </div>
                  {capsule.description && <p className="text-sm leading-6 text-text-secondary">{capsule.description}</p>}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
