"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function ListingTableRow({ id, children, even }: { id: string; children: ReactNode; even?: boolean }) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(`/annonce/${id}`)}
      className={`cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-blue-50/70
        ${even ? "bg-white" : "bg-slate-50/50"}`}
    >
      {children}
    </tr>
  );
}
