import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Afterlight — Preserve the stories before they fade.",
  description:
    "Afterlight helps you capture the moments, wisdom, and voice that make your loved one who they are — so future generations can truly know them.",
  keywords: ["memory preservation", "digital legacy", "grief support", "family history", "AI", "Gemma 4"],
  openGraph: {
    title: "Afterlight",
    description: "Preserve the stories before they fade.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
