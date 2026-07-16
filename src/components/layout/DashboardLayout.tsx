import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { DemoModeProvider } from "@/lib/demo";
import { SimulationBadge } from "@/components/demo/SimulationBadge";
import { IndexTicker } from "@/components/demo/IndexTicker";

interface DashboardLayoutProps {
  title?: string;
}

export function DashboardLayout({ title }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    // DemoModeProvider is a transparent pass-through when VITE_DEMO_MODE !== 'true'
    // (no timers, no engine import) so production behaviour is unchanged. It sits
    // here — inside App's QueryClientProvider and the authenticated ProtectedRoute —
    // so the whole shell (header, ticker, and the routed <Outlet/> pages) can read
    // useDemoMode() and the seeded org market. The demo shell pieces below all
    // self-null when demo mode is off.
    <DemoModeProvider>
      <div className="flex min-h-screen w-full">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
          Skip to main content
        </a>
        <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col">
          <AppHeader title={title} onMenuClick={() => setSidebarOpen(true)} />
          {/* Global demo shell — both render nothing outside demo mode. */}
          <SimulationBadge variant="banner" />
          <IndexTicker />
          <main id="main-content" className="flex-1 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 md:pb-[max(1.5rem,env(safe-area-inset-bottom))] scroll-mt-16">
            <Outlet />
          </main>
        </div>
      </div>
    </DemoModeProvider>
  );
}
