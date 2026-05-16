import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        "bg-primary": "#05070B",
        "bg-secondary": "#070A12",
        "bg-tertiary": "#0B0D12",
        // Surfaces
        "surface-1": "#111318",
        "surface-2": "#151820",
        "surface-3": "#171A22",
        // Gold palette
        "gold-dim": "#C99A45",
        "gold-mid": "#D8A94F",
        "gold-bright": "#E4C06A",
        "gold-glow": "rgba(201,154,69,0.15)",
        // Blue accent
        "blue-core": "#1677FF",
        "blue-mid": "#38A3FF",
        "blue-bright": "#64B5FF",
        "blue-glow": "rgba(56,163,255,0.35)",
        // Text
        "text-primary": "#F7EFE3",
        "text-secondary": "#B8AA96",
        "text-muted": "#6B6459",
        // Borders
        "border-gold": "rgba(201,154,69,0.25)",
        "border-blue": "rgba(56,163,255,0.2)",
        "border-subtle": "rgba(255,255,255,0.06)",
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "radial-gold": "radial-gradient(ellipse at 50% 0%, rgba(201,154,69,0.12) 0%, transparent 70%)",
        "radial-blue": "radial-gradient(ellipse at 70% 50%, rgba(56,163,255,0.15) 0%, transparent 60%)",
        "gradient-gold": "linear-gradient(135deg, #C99A45, #E4C06A)",
        "gradient-dark": "linear-gradient(180deg, #070A12 0%, #05070B 100%)",
        "gradient-card": "linear-gradient(145deg, #171A22 0%, #111318 100%)",
      },
      boxShadow: {
        "gold-sm": "0 0 20px rgba(201,154,69,0.15)",
        "gold-md": "0 0 40px rgba(201,154,69,0.2)",
        "blue-sm": "0 0 20px rgba(56,163,255,0.15)",
        "blue-glow": "0 0 60px rgba(56,163,255,0.25)",
        "card": "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,154,69,0.1)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "wave": "wave 8s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        wave: {
          "0%, 100%": { transform: "translateX(0) scaleY(1)" },
          "50%": { transform: "translateX(-20px) scaleY(1.05)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      borderRadius: {
        "xl2": "1.25rem",
        "xl3": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
