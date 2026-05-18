import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Afterlight - Preserve the stories before they fade.",
  description:
    "Afterlight helps you capture the moments, wisdom, and voice that make your loved one who they are, so future generations can truly know them.",
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
      <body className={`${inter.variable} ${cormorant.variable} antialiased`}>{children}</body>
    </html>
  );
}
