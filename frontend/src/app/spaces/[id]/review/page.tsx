"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Flag, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { MemoryCard } from "@/types";

const STATUS_OPTIONS = ["pending_review", "approved", "flagged", "rejected"];
const statusStyle: Record<string, string> = {
  approved: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  pending_review: "text-amber-200 border-amber-400/30 bg-amber-400/10",
  flagged: "text-red-200 border-red-400/30 bg-red-400/10",
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

  useEffect(() => {
    api.listMemories(id, filter === "all" ? undefined : filter)
      .then((data) => setCards(data as MemoryCard[]))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, [id, filter]);

  const updateStatus = async (cardId: string, status: string) => {
    await api.updateMemory(cardId, { status });
    load();
  };

  return (
    <div className="page-surface max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <p className="page-kicker">Review</p>
          <h1 className="page-title mt-2">Review Memories</h1>
          <p className="page-subtitle mt-2">Approve memory cards extracted by Gemma 4 before they shape conversation.</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {["all", ...STATUS_OPTIONS].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-all ${
                filter === status ? "border-gold-mid bg-gold-glow text-gold-bright" : "border-border-subtle text-text-secondary hover:border-border-gold"
              }`}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-text-muted animate-pulse">Loading...</div>
        ) : cards.length === 0 ? (
          <div className="card-glass py-20 text-center">
            <ShieldCheck className="mx-auto mb-4 text-text-muted" size={34} />
            <p className="text-sm text-text-muted">No memory cards yet. Process your uploads first.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((card) => (
              <motion.div key={card.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-glass p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="font-serif text-xl leading-snug text-text-primary">{card.title}</h3>
                  <span className={`flex-shrink-0 rounded-md border px-2 py-1 text-xs ${statusStyle[card.status] || ""}`}>
                    {card.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mb-3 text-sm leading-6 text-text-secondary">{card.summary}</p>
                {card.source_quote && (
                  <blockquote className="mb-3 border-l-2 border-gold-mid pl-3 text-xs italic leading-5 text-gold-bright">
                    &quot;{card.source_quote}&quot;
                  </blockquote>
                )}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {card.themes?.slice(0, 4).map((theme) => (
                    <span key={theme} className="rounded-md border border-blue-mid/20 bg-blue-mid/10 px-2 py-1 text-xs text-blue-bright">
                      {theme}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  {card.status !== "approved" && (
                    <button onClick={() => updateStatus(card.id, "approved")} className="btn-ghost px-3 py-2 text-xs text-emerald-200">
                      <Check size={14} />
                      Approve
                    </button>
                  )}
                  {card.status !== "flagged" && (
                    <button onClick={() => updateStatus(card.id, "flagged")} className="btn-ghost px-3 py-2 text-xs text-red-200">
                      <Flag size={14} />
                      Flag
                    </button>
                  )}
                </div>
                <p className="mt-3 text-xs text-text-muted">Confidence: {Math.round(card.confidence * 100)}% - {card.language}</p>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
