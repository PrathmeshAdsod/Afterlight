"use client";

import { motion, type Variants } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Cpu,
  LockKeyhole,
  MessageCircle,
  Mic,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { isBackendAvailable } from "@/lib/api";

function MemoryField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;
    const marks = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      length: 8 + Math.random() * 28,
      speed: 0.0004 + Math.random() * 0.0007,
      alpha: 0.08 + Math.random() * 0.18,
    }));

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      frame += 1;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      marks.forEach((mark, index) => {
        const x = mark.x * window.innerWidth;
        const y = ((mark.y + frame * mark.speed) % 1) * window.innerHeight;
        const tint = index % 3 === 0 ? "208, 162, 79" : index % 3 === 1 ? "138, 163, 152" : "126, 167, 184";
        ctx.strokeStyle = `rgba(${tint}, ${mark.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + mark.length, y + mark.length * 0.18);
        ctx.stroke();
      });
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none opacity-70" style={{ zIndex: 0 }} />;
}

const fade: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger: Variants = { show: { transition: { staggerChildren: 0.08 } } };

const FEATURES = [
  { icon: Mic, title: "Voice conversation", desc: "Speak naturally and hear replies through browser speech or your ElevenLabs voice clone." },
  { icon: Cpu, title: "Gemma 4 extraction", desc: "Turn recordings, photos, and documents into reviewable memory cards on your machine." },
  { icon: ShieldCheck, title: "Steward review", desc: "Nothing enters the presence until you approve it, with sources kept visible." },
  { icon: LockKeyhole, title: "Local-first privacy", desc: "Ollama, SQLite, and your media vault stay on your laptop unless you choose otherwise." },
];

export default function LandingPage() {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    isBackendAvailable().then(setBackendOnline);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden app-shell">
      <MemoryField />
      <div className="archive-grid" />

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg-primary/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-gold bg-gold-glow text-gold-bright">
              <Sparkles size={17} />
            </span>
            <span className="font-serif text-xl text-text-primary">Afterlight</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#how" className="hidden text-sm text-text-muted transition-colors hover:text-text-primary md:inline">
              How it works
            </a>
            <a href="#features" className="hidden text-sm text-text-muted transition-colors hover:text-text-primary md:inline">
              Features
            </a>
            <Link href="/create" className="btn-gold px-4 py-2 text-sm">
              Begin
            </Link>
          </div>
        </div>
      </nav>

      {backendOnline === false && (
        <div className="fixed left-0 right-0 top-[69px] z-40 border-b border-blue-mid/20 bg-blue-mid/10 py-2 text-center text-xs text-blue-bright">
          Backend is offline. Start FastAPI to use local Gemma 4.
        </div>
      )}

      <main className="relative z-10">
        <section className="mx-auto flex min-h-[88vh] max-w-6xl flex-col items-center justify-center px-5 pb-14 pt-28 text-center">
          <motion.div initial="hidden" animate="show" variants={stagger} className="w-full">
            <motion.div variants={fade} className="mb-6 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-1/70 px-3 py-2 text-xs font-semibold text-sage-bright">
                <span className="h-2 w-2 rounded-sm bg-sage-mid" />
                Gemma 4 E2B via Ollama. Fully local.
              </span>
            </motion.div>

            <motion.h1 variants={fade} className="page-title text-6xl leading-none sm:text-7xl md:text-[7.5rem]">
              Afterlight
            </motion.h1>

            <motion.p variants={fade} className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-text-secondary md:text-xl">
              A private memory space for preserving someone&apos;s stories, voice, and values before they fade from everyday reach.
            </motion.p>

            <motion.div variants={fade} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/create" className="btn-gold px-7 py-3.5 text-base">
                Create a Memory Space <ArrowRight size={18} />
              </Link>
              <a href="#how" className="btn-ghost px-7 py-3.5 text-base">
                See the flow <ArrowDown size={18} />
              </a>
            </motion.div>

            <motion.div variants={fade} className="mx-auto mt-14 max-w-3xl">
              <div className="card-glass p-4 text-left">
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <MessageCircle size={16} className="text-blue-mid" />
                    Talk with Nani
                  </div>
                  <div className="flex items-center gap-2 text-xs text-sage-bright">
                    <span className="h-2 w-2 rounded-sm bg-sage-mid" />
                    Gemma ready
                  </div>
                </div>
                <div className="grid gap-4 pt-5 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="ml-auto max-w-[84%] rounded-lg border border-blue-mid/25 bg-blue-mid/10 px-4 py-3 text-sm text-text-primary">
                      What did you want us to remember most?
                    </div>
                    <div className="max-w-[88%] rounded-lg border border-border-gold bg-gold-glow px-4 py-3 text-sm leading-6 text-text-secondary">
                      Remember the small rituals. Tea after dinner, the songs in the kitchen, and how every visitor was fed before they sat down.
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-md border border-border-gold bg-gold-glow px-2.5 py-1 text-xs text-gold-bright">
                      <Archive size={13} />
                      Memory-backed
                    </div>
                  </div>
                  <div className="panel-muted flex flex-col justify-between p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-sage-mid">Source Vault</p>
                      <p className="mt-2 text-sm text-text-primary">Sunday kitchen recording</p>
                      <p className="mt-2 text-xs leading-5 text-text-muted">
                        Audio transcript, 3 source memories, 92% confidence.
                      </p>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                      {["Voice", "Photos", "Letters"].map((item) => (
                        <span key={item} className="rounded-md border border-border-subtle bg-bg-primary/50 px-2 py-2 text-text-secondary">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <section id="how" className="border-y border-border-subtle bg-surface-1/45 px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <p className="page-kicker text-center">How It Works</p>
            <h2 className="mt-3 text-center font-serif text-4xl text-text-primary md:text-5xl">From media to memory</h2>
            <div className="mt-12 grid gap-4 md:grid-cols-4">
              {[
                ["01", "Create", "Name the person and define your stewardship."],
                ["02", "Capture", "Upload recordings, photos, letters, and documents."],
                ["03", "Review", "Approve the memories Gemma extracts before use."],
                ["04", "Talk", "Ask questions with trust chips and visible sources."],
              ].map(([n, title, desc]) => (
                <div key={n} className="panel-muted p-5">
                  <p className="font-mono text-xs text-blue-mid">{n}</p>
                  <h3 className="mt-5 font-serif text-2xl text-text-primary">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="page-kicker">Workspace</p>
                <h2 className="mt-3 font-serif text-4xl text-text-primary md:text-5xl">Built for careful preservation</h2>
              </div>
              <p className="max-w-lg text-sm leading-6 text-text-secondary">
                The interface stays quiet and reviewable, because memory work needs confidence more than spectacle.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="card-glass p-5">
                    <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-bg-primary/60 text-gold-bright">
                      <Icon size={19} />
                    </div>
                    <h3 className="font-serif text-xl text-text-primary">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-text-secondary">{feature.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 border-t border-border-subtle pt-10 md:flex-row md:items-center">
            <div>
              <p className="page-kicker">Local And Private</p>
              <h2 className="mt-3 font-serif text-4xl text-text-primary">Your family archive stays on your machine.</h2>
            </div>
            <Link href="/create" className="btn-gold px-6 py-3">
              Start now <CheckCircle2 size={18} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
