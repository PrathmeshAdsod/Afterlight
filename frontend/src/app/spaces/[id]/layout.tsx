"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import SpaceSidebar from "@/components/layout/SpaceSidebar";
import type { MemorySpace } from "@/types";

export default function SpaceLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [space, setSpace] = useState<MemorySpace | null>(null);

  useEffect(() => {
    if (id) api.getSpace(id).then(s => setSpace(s as MemorySpace)).catch(() => {});
  }, [id]);

  return (
    <div className="flex min-h-screen" style={{ background: "#05070B" }}>
      <SpaceSidebar spaceId={id} presenceName={space?.presence_name || "Loading..."} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
