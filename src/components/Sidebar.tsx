"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Settings,
  ScrollText,
  Bot,
  GitBranch,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/advisors", label: "Advisors", icon: Users },
  { href: "/rules", label: "Distribution Rules", icon: GitBranch },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/logs", label: "Logs", icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-line/60 bg-canvas-card hidden md:flex md:flex-col">
      <div className="px-5 py-5 border-b border-line/60">
        <div className="flex items-center gap-3">
          <Image
            src="/os4er-logo.png"
            alt="One Stop 4 Equity Release"
            width={44}
            height={30}
            priority
            className="h-9 w-auto shrink-0"
          />
          <div className="leading-tight">
            <div className="font-bold tracking-tight text-brand text-[13px]">
              One Stop 4
            </div>
            <div className="text-[11px] font-semibold text-accent-600 -mt-0.5">
              Equity Release
            </div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition",
                active
                  ? "bg-brand/10 text-brand"
                  : "text-ink-muted hover:bg-canvas-subtle hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-line/60 text-xs text-ink-soft">
        v0.1 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
