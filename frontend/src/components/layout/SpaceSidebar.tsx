"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = (id: string) => [
  { href: `/spaces/${id}`, icon: "◈", label: "Dashboard" },
  { href: `/spaces/${id}/capture`, icon: "⊕", label: "Capture" },
  { href: `/spaces/${id}/setup`, icon: "◎", label: "Setup" },
  { href: `/spaces/${id}/review`, icon: "◻", label: "Review Memories" },
  { href: `/spaces/${id}/timeline`, icon: "⊣", label: "Timeline" },
  { href: `/spaces/${id}/talk`, icon: "◉", label: "Talk with Them" },
  { href: `/spaces/${id}/capsules`, icon: "◌", label: "Capsules" },
  { href: `/spaces/${id}/settings`, icon: "⊙", label: "Settings" },
];

interface SpaceSidebarProps {
  spaceId: string;
  presenceName: string;
}

export default function SpaceSidebar({ spaceId, presenceName }: SpaceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col"
      style={{ background: "#0B0D12", borderRight: "1px solid rgba(201,154,69,0.1)", minHeight: "100vh" }}>
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5 border-b"
        style={{ borderColor: "rgba(201,154,69,0.1)" }}>
        <span className="text-gold-dim">✦</span>
        <span className="font-serif text-base text-text-primary">Afterlight</span>
      </Link>

      {/* Space name */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(201,154,69,0.08)" }}>
        <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Memory Space</p>
        <p className="font-serif text-lg text-gold-dim truncate">{presenceName}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems(spaceId).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={cn("sidebar-item", isActive && "active")}>
              <span className="text-sm w-4 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(201,154,69,0.08)" }}>
        <Link href="/create" className="text-xs text-text-muted hover:text-gold-dim transition-colors">
          + New Memory Space
        </Link>
      </div>
    </aside>
  );
}
