"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  PiggyBank,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLastSynced } from "@/hooks/use-last-synced";
import { useSync } from "@/hooks/use-sync";

const navItems = [
  { title: "Portfolio", url: "/", icon: BarChart3 },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Options", url: "/options", icon: Target },
  { title: "Dividends", url: "/dividends", icon: Banknote },
  { title: "Deposits", url: "/deposits", icon: PiggyBank },
  { title: "Performance", url: "/performance", icon: TrendingUp },
];

function formatRelativeTime(isoDate: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SyncProgressText({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  return (
    <span className="text-muted-foreground text-xs">
      Syncing {completed}/{total}...
    </span>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { trigger, isSyncing, progress } = useSync();
  const { lastSynced, isLoading: isLastSyncedLoading } = useLastSynced();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-xs font-bold">
                  F
                </div>
                <span className="text-lg font-semibold">Folio</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.url === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.url)
                    }
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 px-2 py-1 group-data-[collapsible=icon]:px-0">
          <div className="text-muted-foreground group-data-[collapsible=icon]:hidden text-xs">
            {isSyncing && progress?.type === "progress" ? (
              <SyncProgressText
                completed={progress.completed}
                total={progress.total}
              />
            ) : isLastSyncedLoading ? (
              <span>Loading...</span>
            ) : lastSynced ? (
              <span>Last synced: {formatRelativeTime(lastSynced)}</span>
            ) : (
              <span>Never synced</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => trigger()}
            disabled={isSyncing}
            className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
          >
            <RefreshCw
              className={isSyncing ? "animate-spin" : undefined}
            />
            <span className="group-data-[collapsible=icon]:hidden">
              {isSyncing ? "Syncing..." : "Sync Now"}
            </span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
