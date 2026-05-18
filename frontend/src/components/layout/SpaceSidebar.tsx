"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Boxes,
  CheckSquare,
  Gauge,
  MessageCircle,
  Plus,
  Settings,
  Sparkles,
  Timeline,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = (id: string) => [
  { href: `/spaces/${id}`, icon: Gauge, label: "Dashboard" },
  { href: `/spaces/${id}/capture`, icon: UploadCloud, label: "Capture" },
  { href: `/spaces/${id}/setup`, icon: Boxes, label: "Setup" },
  { href: `/spaces/${id}/review`, icon: CheckSquare, label: "Review Memories" },
  { href: `/spaces/${id}/timeline`, icon: Timeline, label: "Timeline" },
  { href: `/spaces/${id}/talk`, icon: MessageCircle, label: "Talk" },
  { href: `/spaces/${id}/capsules`, icon: Archive, label: "Capsules" },
  { href: `/spaces/${id}/settings`, icon: Settings, label: "Settings" },
];

interface SpaceSidebarProps {
  spaceId: string;
  presenceName: string;
}

export default function SpaceSidebar({ spaceId, presenceName }: SpaceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 flex-shrink-0 flex-col border-r border-border-subtle bg-bg-primary/92">
      <Link href="/" className="flex items-center gap-3 border-b border-border-subtle px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-gold bg-gold-glow text-gold-bright">
          <Sparkles size={17} />
        </span>
        <span className="font-serif text-lg text-text-primary">Afterlight</span>
      </Link>

      <div className="border-b border-border-subtle px-5 py-5">
        <p className="page-kicker">Memory Space</p>
        <p className="mt-2 truncate font-serif text-2xl text-gold-bright">{presenceName}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems(spaceId).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={cn("sidebar-item", isActive && "active")}>
              <Icon size={17} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-subtle px-4 py-4">
        <Link href="/create" className="btn-ghost w-full justify-start px-3 py-2 text-xs">
          <Plus size={15} />
          New Memory Space
        </Link>
      </div>
    </aside>
  );
}
