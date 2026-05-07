"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="bg-white border-b border-border/60 sticky top-0 z-50" style={{ boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div className="max-w-[1600px] mx-auto px-5 h-14 flex items-center justify-between gap-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-1 shrink-0">
          <span className="text-xl font-black tracking-tight text-foreground">immo</span>
          <span className="text-xl font-black tracking-tight text-primary">33</span>
          <span className="ml-2 text-xs font-medium text-muted-foreground hidden sm:block border border-border/60 rounded px-1.5 py-0.5">Gironde</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 ml-auto">
          <Link
            href="/"
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              pathname === "/"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            Annonces
          </Link>
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              pathname === "/admin"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Settings className="size-3.5" />
            Sources
          </Link>
        </nav>
      </div>
    </header>
  );
}
