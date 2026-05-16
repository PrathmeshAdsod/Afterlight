"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { MemoryCard } from "@/types";

const STATUS_OPTIONS = ["pending_review", "approved", "flagged", "rejected"];
const statusStyle: Record<string, string> = {
  approved: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
  pending_review: "text-amber-400 border-amber-400/30 bg-amber-400/5",
  flagged: "text-red-400 border-red-400/30 bg-red-400/5",
  rejected: "text-text-muted border-border-subtle bg-transparent",
};

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await api.listMemories(id, filter === "all" ? undefined : filter).catch(() => []);
    setCards(data as MemoryCard[]);
    setLoading(false);
  }, [id, filter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (cardId: string, status: string) => {
    await api.updateMemory(cardId, { status });
    load();
  };

  return (
    <div className="p-10 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-serif text-4xl text-text-primary mb-2">Review Memories</h1>
        <p className="text-text-secondary text-sm mb-8">Approve memory cards extracted by Gemma 4 from your uploads.</p>

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          {["all", ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full transition-all capitalize ${filter === s ? "bg-gold-dim text-bg-primary font-semibold" : "text-text-secondary border border-border-gold hover:border-gold-dim"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-text-muted text-sm animate-pulse">Loading...</div>
        ) : cards.length === 0 ? (
          <div className="text-center py-20 card-glass">
            <p className="text-text-muted text-sm">No memory cards yet. Process your uploads first.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {cards.map(card => (
              <motion.div key={card.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="card-glass p-5">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <h3 className="font-serif text-base text-text-primary leading-snug">{card.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 border ${statusStyle[card.status] || ""}`}>
                    {card.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed mb-3">{card.summary}</p>
                {card.source_quote && (
                  <blockquote className="text-xs text-gold-dim italic border-l-2 pl-3 mb-3"
                    style={{ borderColor: "#C99A45" }}>"{card.source_quote}"</blockquote>
                )}
                <div className="flex flex-wrap gap-1 mb-4">
                  {card.themes?.slice(0, 4).map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "rgba(56,163,255,0.06)", border: "1px solid rgba(56,163,255,0.1)", color: "#64B5FF" }}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  {card.status !== "approved" && (
                    <button onClick={() => updateStatus(card.id, "approved")}
                      className="text-xs px-3 py-1.5 rounded-lg text-emerald-400 transition-colors"
                      style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                      ✓ Approve
                    </button>
                  )}
                  {card.status !== "flagged" && (
                    <button onClick={() => updateStatus(card.id, "flagged")}
                      className="text-xs px-3 py-1.5 rounded-lg text-red-400 transition-colors"
                      style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                      ⚑ Flag
                    </button>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-3">Confidence: {Math.round(card.confidence * 100)}% · {card.language}</p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
