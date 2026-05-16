"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

export default function CapsulesPage() {
  const { id } = useParams<{ id: string }>();
  const [capsules, setCapsules] = useState<unknown[]>([]);
  const [form, setForm] = useState({ title: "", description: "", unlock_date: "", recipients: "" });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => api.listCapsules(id).then(d => setCapsules(d as unknown[])).catch(() => {});
  useEffect(() => { load(); }, [id]);

  const create = async () => {
    setCreating(true);
    try {
      await api.createCapsule(id, {
        title: form.title,
        description: form.description,
        unlock_date: form.unlock_date || undefined,
        recipients: form.recipients ? form.recipients.split(",").map(s => s.trim()) : [],
      });
      setForm({ title: "", description: "", unlock_date: "", recipients: "" });
      setShowForm(false);
      load();
    } catch {} finally { setCreating(false); }
  };

  return (
    <div className="p-10 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-serif text-4xl text-text-primary mb-2">Legacy Capsules</h1>
            <p className="text-text-secondary text-sm">Curate timeless messages for the future.</p>
          </div>
          <button onClick={() => setShowForm(s => !s)} className="btn-ghost text-sm">+ New Capsule</button>
        </div>

        {showForm && (
          <div className="card-glass p-6 mb-8">
            <h2 className="font-serif text-xl text-text-primary mb-4">Create Capsule</h2>
            <div className="space-y-4">
              <input className="input-dark" placeholder="Capsule title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <textarea className="input-dark resize-none" rows={2} placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <input className="input-dark" type="date" value={form.unlock_date} onChange={e => setForm(f => ({ ...f, unlock_date: e.target.value }))} />
              <input className="input-dark" placeholder="Recipients (comma-separated)" value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))} />
              <button onClick={create} disabled={!form.title || creating} className="btn-gold text-sm">
                {creating ? "Creating..." : "Create Capsule"}
              </button>
            </div>
          </div>
        )}

        {capsules.length === 0 ? (
          <div className="text-center py-20 card-glass">
            <div className="text-4xl mb-4">🔒</div>
            <p className="text-text-muted text-sm">No capsules yet. Create a time-locked legacy message.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {(capsules as Array<{ id: string; title: string; description?: string; unlock_date?: string; is_sealed: boolean }>).map(c => (
              <div key={c.id} className="card-glass p-6">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">{c.is_sealed ? "🔒" : "📬"}</span>
                  <div>
                    <h3 className="font-serif text-base text-text-primary">{c.title}</h3>
                    {c.unlock_date && <p className="text-xs text-gold-dim mt-1">Opens {new Date(c.unlock_date).toLocaleDateString()}</p>}
                  </div>
                </div>
                {c.description && <p className="text-sm text-text-secondary">{c.description}</p>}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
