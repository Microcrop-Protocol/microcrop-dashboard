import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  Activity,
  Users,
  FileText,
  DollarSign,
  MapPin,
  AlertTriangle,
  Wallet,
  UserCog,
  Download,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  children?: { title: string; href: string }[];
}

const platformNavItems: NavItem[] = [
  { title: "Dashboard", href: "/platform/dashboard", icon: LayoutDashboard },
  { title: "Organizations", href: "/platform/organizations", icon: Building2 },
  {
    title: "Analytics",
    href: "/platform/analytics",
    icon: BarChart3,
    children: [
      { title: "Revenue", href: "/platform/analytics/revenue" },
      { title: "Policies", href: "/platform/analytics/policies" },
      { title: "Farmers", href: "/platform/analytics/farmers" },
      { title: "Payouts", href: "/platform/analytics/payouts" },
      { title: "Damage", href: "/platform/analytics/damage" },
    ],
  },
  { title: "Activity Log", href: "/platform/activity", icon: Activity },
];

const orgNavItems: NavItem[] = [
  { title: "Dashboard", href: "/org/dashboard", icon: LayoutDashboard },
  { title: "Farmers", href: "/org/farmers", icon: Users },
  { title: "Policies", href: "/org/policies", icon: FileText },
  { title: "Payouts", href: "/org/payouts", icon: DollarSign },
  { title: "Plots", href: "/org/plots", icon: MapPin },
  { title: "Damage", href: "/org/damage", icon: AlertTriangle },
  { title: "Financials", href: "/org/financials", icon: BarChart3 },
  { title: "Pool", href: "/org/pool", icon: Wallet },
  { title: "Staff", href: "/org/staff", icon: UserCog },
  { title: "Export", href: "/org/export", icon: Download },
  { title: "Activity", href: "/org/activity", icon: Activity },
];

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const location = useLocation();
  const { user, isPlatformAdmin } = useAuthStore();
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const navItems = isPlatformAdmin() ? platformNavItems : orgNavItems;

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar transition-transform duration-300 lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/microcropsymb.png"
              alt="MicroCrop"
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-bold text-sidebar-foreground">MicroCrop</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const hasChildren = item.children && item.children.length > 0;
              const isGroupOpen = openGroups.includes(item.title);

              if (hasChildren) {
                return (
                  <Collapsible
                    key={item.title}
                    open={isGroupOpen || item.children?.some((c) => isActive(c.href))}
                    onOpenChange={() => toggleGroup(item.title)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          item.children?.some((c) => isActive(c.href)) && "bg-sidebar-accent"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="h-4 w-4" />
                          {item.title}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            (isGroupOpen || item.children?.some((c) => isActive(c.href))) && "rotate-180"
                          )}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="ml-4 mt-1 space-y-1 border-l pl-4">
                      {item.children?.map((child) => (
                        <Button
                          key={child.href}
                          variant="ghost"
                          size="sm"
                          asChild
                          className={cn(
                            "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            isActive(child.href) &&
                              "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                          )}
                        >
                          <Link to={child.href} onClick={onClose}>
                            {child.title}
                          </Link>
                        </Button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  asChild
                  className={cn(
                    "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active &&
                      "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                  )}
                >
                  <Link to={item.href} onClick={onClose} className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User Info */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.role.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function SidebarTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClick}>
      <Menu className="h-5 w-5" />
    </Button>
  );
}
