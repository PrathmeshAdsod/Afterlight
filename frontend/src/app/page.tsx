"use client";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { isBackendAvailable } from "@/lib/api";

// ─── Particle canvas background ──────────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const N = 120;
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.3,
      color: Math.random() > 0.5 ? "#38A3FF" : "#C99A45",
      alpha: Math.random() * 0.5 + 0.1,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });
      // Draw connection lines for nearby blue particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = "#38A3FF";
            ctx.globalAlpha = (1 - dist / 100) * 0.06;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}

// ─── 3D tilt card ────────────────────────────────────────────────────────────
function TiltCard({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const x = useMotionValue(0); const y = useMotionValue(0);
  const rotX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 20 });
  const rotY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 20 });
  const gX = useTransform(x, [-0.5, 0.5], ["20%", "80%"]);
  const gY = useTransform(y, [-0.5, 0.5], ["20%", "80%"]);
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  }, [x, y]);
  const onLeave = useCallback(() => { x.set(0); y.set(0); }, [x, y]);
  return (
    <motion.div onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d", ...style }}
      className={className}>
      <motion.div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at ${gX}px ${gY}px, rgba(56,163,255,0.08), transparent 60%)` }} />
      {children}
    </motion.div>
  );
}

const fade = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger = { show: { transition: { staggerChildren: 0.1 } } };

const FEATURES = [
  { icon: "🎙", title: "Real-time voice", desc: "Speak with the presence using your mic. Replies are spoken back using browser speech or your ElevenLabs voice clone." },
  { icon: "🧠", title: "Gemma 4 memory extraction", desc: "Upload audio, video, photos, documents. Gemma 4 E2B extracts structured memories — running on your GPU." },
  { icon: "🔒", title: "Fully local & private", desc: "Ollama runs entirely on your device. No data leaves your machine. No accounts. No cloud." },
  { icon: "🎛", title: "QLoRA fine-tuning", desc: "Train a personal adapter on their real memories using 4-bit quantization on RTX 5050 GPU." },
  { icon: "✦", title: "Trust-grounded replies", desc: "Every response is anchored to approved memories with source chips you can inspect." },
  { icon: "🕰", title: "Life timeline", desc: "Chronological view of events, places, and milestones automatically extracted from media." },
];

export default function LandingPage() {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  useEffect(() => { isBackendAvailable().then(setBackendOnline); }, []);

  return (
    <div className="min-h-screen relative" style={{ background: "#05070B", perspective: "1200px" }}>
      <ParticleField />

      {/* Aurora blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,163,255,0.07) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-[30%] right-[5%] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(201,154,69,0.05) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-[10%] left-[30%] w-[600px] h-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,163,255,0.04) 0%, transparent 70%)", filter: "blur(100px)" }} />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5"
        style={{ background: "rgba(5,7,11,0.7)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(56,163,255,0.06)" }}>
        <div className="flex items-center gap-2.5">
          <motion.span animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 3 }}
            className="text-gold-dim">✦</motion.span>
          <span className="font-serif text-lg font-medium text-text-primary tracking-tight">Afterlight</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#how" className="text-sm text-text-muted hover:text-text-secondary transition-colors hidden md:block">How it works</a>
          <a href="#features" className="text-sm text-text-muted hover:text-text-secondary transition-colors hidden md:block">Features</a>
          <Link href="/create">
            <button className="btn-gold text-sm px-5 py-2">Begin</button>
          </Link>
        </div>
      </nav>

      {backendOnline === false && (
        <div className="fixed top-[65px] left-0 right-0 z-40 text-center py-2 text-xs"
          style={{ background: "rgba(56,163,255,0.06)", borderBottom: "1px solid rgba(56,163,255,0.12)", color: "#64B5FF" }}>
          Backend not running — start it to use Gemma 4 locally
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center pt-20">
        <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-4xl mx-auto w-full">

          {/* Badge */}
          <motion.div variants={fade} className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 text-xs px-4 py-1.5 rounded-full font-medium"
              style={{ background: "rgba(56,163,255,0.06)", border: "1px solid rgba(56,163,255,0.18)", color: "#64B5FF" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Gemma 4 E2B · RTX 5050 · Fully Local
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1 variants={fade}
            className="font-serif text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] mb-6"
            style={{ letterSpacing: "-0.03em" }}>
            <span className="text-text-primary">Preserve the </span>
            <span style={{
              background: "linear-gradient(135deg, #38A3FF 0%, #7BC8FF 40%, #C99A45 80%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>stories</span>
            <br />
            <span className="text-text-primary">before they fade.</span>
          </motion.h1>

          <motion.p variants={fade} className="text-text-secondary text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
            Capture the voice, memories, and wisdom of someone you love.
            Let Gemma 4 build a presence that future generations can truly speak with.
          </motion.p>

          <motion.div variants={fade} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/create">
              <button id="hero-cta" className="relative overflow-hidden group text-base px-9 py-4 rounded-full font-medium transition-all duration-300"
                style={{ background: "linear-gradient(135deg, #1667CC, #38A3FF)", color: "#fff", boxShadow: "0 0 30px rgba(56,163,255,0.3)" }}>
                <span className="relative z-10 flex items-center gap-2">+ Create a presence</span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: "linear-gradient(135deg, #38A3FF, #64B5FF)" }} />
              </button>
            </Link>
            <a href="#how">
              <button className="text-base px-9 py-4 rounded-full transition-all duration-300 text-text-secondary hover:text-text-primary"
                style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                How it works ↓
              </button>
            </a>
          </motion.div>

          {/* Trust pills */}
          <motion.div variants={fade} className="flex flex-wrap items-center justify-center gap-4 text-xs text-text-muted">
            {["🔒 Local-first", "◎ No cloud needed", "✦ Gemma 4 E2B", "🎙 Voice-enabled"].map(t => (
              <span key={t} className="px-3 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>{t}</span>
            ))}
          </motion.div>
        </motion.div>

        {/* 3D Chat Preview Card */}
        <motion.div initial={{ opacity: 0, y: 48, rotateX: 12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
          className="relative z-10 mt-20 w-full max-w-lg mx-auto group"
          style={{ perspective: "1000px" }}>
          <TiltCard className="relative card-glass p-6 rounded-2xl"
            style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,163,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
            {/* Glow top edge */}
            <div className="absolute top-0 left-1/4 right-1/4 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(56,163,255,0.4), transparent)" }} />
            <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#EF4444" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#F59E0B" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#10B981" }} />
              </div>
              <span className="text-xs text-text-muted ml-2">Talk · Afterlight</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.8)" }} />
                <span className="text-xs text-text-muted">Gemma 4 · Local</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="px-4 py-2.5 text-sm text-white max-w-[80%] rounded-2xl rounded-br-sm"
                  style={{ background: "linear-gradient(135deg, rgba(56,163,255,0.2), rgba(56,163,255,0.08))", border: "1px solid rgba(56,163,255,0.15)" }}>
                  What mattered most to you in life?
                </div>
              </div>
              <div className="flex justify-start">
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-text-muted px-1">Nani</span>
                  <div className="px-4 py-3 text-sm text-text-secondary max-w-[85%] leading-relaxed rounded-2xl rounded-bl-sm"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    Family, beta. Not the big moments — the quiet ones. Sunday mornings, the tea we shared, stories with no ending.
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full self-start"
                    style={{ background: "rgba(56,163,255,0.06)", border: "1px solid rgba(56,163,255,0.15)", color: "#64B5FF" }}>
                    ✦ Memory-backed · High confidence
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="flex-1 px-3 py-2 rounded-xl text-xs text-text-muted"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  Say something...
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(56,163,255,0.1)", border: "1px solid rgba(56,163,255,0.2)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64B5FF" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  </svg>
                </div>
              </div>
            </div>
          </TiltCard>
        </motion.div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section id="how" className="relative z-10 py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.p variants={fade} className="text-center text-xs uppercase tracking-widest mb-3"
              style={{ color: "#64B5FF" }}>How it works</motion.p>
            <motion.h2 variants={fade} className="font-serif text-4xl md:text-5xl text-text-primary text-center mb-20 font-light"
              style={{ letterSpacing: "-0.02em" }}>From memories to presence</motion.h2>
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { n: "01", t: "Create", d: "Name the person. Set the relationship. Describe who they were in a few words." },
                { n: "02", t: "Capture", d: "Upload audio, video, photos, text. GPU-accelerated transcription extracts everything." },
                { n: "03", t: "Review", d: "Gemma 4 surfaces memories. You approve each one before it enters the presence." },
                { n: "04", t: "Talk", d: "Speak naturally. Voice in, voice out. Every reply is grounded in real memories." },
              ].map((s, i) => (
                <motion.div key={s.n} variants={fade} className="relative group">
                  <div className="text-xs font-mono mb-4 transition-colors duration-300" style={{ color: "rgba(56,163,255,0.5)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#64B5FF")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(56,163,255,0.5)")}>{s.n}</div>
                  {i < 3 && <div className="hidden md:block absolute top-2 left-8 right-0 h-px"
                    style={{ background: "linear-gradient(90deg, rgba(56,163,255,0.2), transparent)" }} />}
                  <h3 className="font-serif text-xl text-text-primary mb-2">{s.t}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{s.d}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-24 px-6">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(180deg, transparent, rgba(56,163,255,0.02), transparent)" }} />
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.p variants={fade} className="text-center text-xs uppercase tracking-widest mb-3" style={{ color: "#64B5FF" }}>Features</motion.p>
            <motion.h2 variants={fade} className="font-serif text-4xl md:text-5xl text-text-primary text-center mb-16 font-light"
              style={{ letterSpacing: "-0.02em" }}>Everything in one place</motion.h2>
            <div className="grid md:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <motion.div key={f.title} variants={fade} transition={{ delay: i * 0.05 }}
                  className="group relative rounded-2xl p-6 cursor-default transition-all duration-300"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(56,163,255,0.2)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(56,163,255,0.03)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}>
                  <div className="text-2xl mb-4">{f.icon}</div>
                  <h3 className="font-medium text-text-primary mb-2 text-sm">{f.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Privacy ──────────────────────────────────────────── */}
      <section className="relative z-10 py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            <motion.p variants={fade} className="text-xs uppercase tracking-widest mb-3" style={{ color: "#64B5FF" }}>Privacy</motion.p>
            <motion.h2 variants={fade} className="font-serif text-4xl md:text-5xl text-text-primary mb-6 font-light"
              style={{ letterSpacing: "-0.02em" }}>Your memories stay yours.</motion.h2>
            <motion.p variants={fade} className="text-text-secondary text-lg leading-relaxed mb-14">
              Afterlight runs on your device using Ollama and Gemma 4. No account. No cloud. No data uploaded.
              The only optional external service is ElevenLabs voice — using your own key.
            </motion.p>
            <motion.div variants={fade} className="grid grid-cols-3 gap-4">
              {[["On-device AI", "Gemma 4 via Ollama"], ["Local database", "SQLite on your machine"], ["Your API keys", "You control all access"]].map(([l, s]) => (
                <div key={l} className="rounded-xl p-5 text-center"
                  style={{ background: "rgba(56,163,255,0.03)", border: "1px solid rgba(56,163,255,0.08)" }}>
                  <p className="text-sm font-medium text-text-primary">{l}</p>
                  <p className="text-xs text-text-muted mt-1">{s}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="relative z-10 py-28 px-6 text-center">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(56,163,255,0.04), transparent 60%)" }} />
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fade} className="font-serif text-5xl md:text-6xl text-text-primary mb-4 font-light"
            style={{ letterSpacing: "-0.025em" }}>
            Start preserving<br />
            <span style={{ background: "linear-gradient(135deg, #38A3FF, #C99A45)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              what matters.
            </span>
          </motion.h2>
          <motion.p variants={fade} className="text-text-secondary mb-10 text-lg">
            Free to run. No account needed. Just your machine and your memories.
          </motion.p>
          <motion.div variants={fade}>
            <Link href="/create">
              <button className="relative overflow-hidden group text-base px-12 py-4 rounded-full font-medium mx-auto transition-all duration-300"
                style={{ background: "linear-gradient(135deg, #1667CC, #38A3FF)", color: "#fff", boxShadow: "0 0 40px rgba(56,163,255,0.25)" }}>
                <span className="relative z-10">+ Create a presence</span>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: "linear-gradient(135deg, #38A3FF, #64B5FF)" }} />
              </button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-8 flex items-center justify-between text-xs text-text-muted"
        style={{ borderTop: "1px solid rgba(56,163,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <span className="text-gold-dim">✦</span>
          <span>Afterlight — Gemma 4 Good Hackathon 2025</span>
        </div>
        <span>Local-first · Private by design</span>
      </footer>
    </div>
  );
}
