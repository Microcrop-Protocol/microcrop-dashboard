import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/market";
import {
  useDemoMode,
  useLiveKpis,
  usePayoutEvents,
  useAnimatedNumber,
  type KpiKey,
  type KpiMetric,
} from "@/lib/demo";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className
}: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 pt-1">
                <span className={cn(
                  "text-xs font-medium tabular-nums",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}>
                  {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-muted-foreground">vs last period</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// LiveStatCard — additive, demo-mode-only "live ticking" variant.
//
// Props are identical to StatCard plus an optional `kpiKey` binding the card to
// a channel of the simulation engine. When demo mode is OFF (or no kpiKey) it
// renders the plain <StatCard/> with the exact props passed in, so production
// behavior is byte-for-byte unchanged.
// ---------------------------------------------------------------------------

interface LiveStatCardProps extends StatCardProps {
  /** Which live KPI channel to animate when demo mode is on. */
  kpiKey?: KpiKey;
  /** Payouts card: pulse amber whenever a fresh payout event fires. */
  pulseOnPayout?: boolean;
}

export function LiveStatCard({ kpiKey, pulseOnPayout, ...props }: LiveStatCardProps) {
  const { enabled } = useDemoMode();
  if (!enabled || !kpiKey) return <StatCard {...props} />;
  return <LiveStatCardInner kpiKey={kpiKey} pulseOnPayout={pulseOnPayout} {...props} />;
}

function formatMetricValue(v: number, m: KpiMetric): string {
  if (m.isPercent) return `${v.toFixed(1)}%`;
  if (m.isCurrency) return formatCurrency(v, m.currency, { notation: "compact", maximumFractionDigits: 1 });
  return Math.round(v).toLocaleString();
}

function formatDelta(d: number, m: KpiMetric): string {
  const sign = d > 0 ? "+" : "−";
  const abs = Math.abs(d);
  if (m.isPercent) return `${sign}${abs.toFixed(1)}%`;
  if (m.isCurrency) return `${sign}${formatCurrency(abs, m.currency, { notation: "compact", maximumFractionDigits: 1 })}`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

function LiveStatCardInner({
  kpiKey,
  pulseOnPayout,
  title,
  subtitle,
  icon: Icon,
  className,
}: Omit<LiveStatCardProps, "kpiKey"> & { kpiKey: KpiKey }) {
  const kpis = useLiveKpis();
  const metric = kpis.metrics[kpiKey];
  const animated = useAnimatedNumber(metric.value, { durationMs: 700, easing: "easeOut" });

  // One-shot +delta flash keyed on the engine's per-bump deltaId.
  const [flash, setFlash] = useState<{ id: string; delta: number } | null>(null);
  useEffect(() => {
    if (!metric.deltaId || metric.lastDelta === 0) return;
    setFlash({ id: metric.deltaId, delta: metric.lastDelta });
    const t = window.setTimeout(() => setFlash(null), 1500);
    return () => window.clearTimeout(t);
  }, [metric.deltaId, metric.lastDelta]);

  const positiveIsGood = kpiKey !== "lossRatio";
  const flashIsGood = flash ? (flash.delta > 0) === positiveIsGood : false;

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      {pulseOnPayout && <PayoutPulseRing />}
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {formatMetricValue(animated, metric)}
              </p>
              {flash && (
                <span
                  key={flash.id}
                  className={cn(
                    "animate-scale-in text-xs font-semibold tabular-nums",
                    flashIsGood ? "text-success" : "text-destructive",
                  )}
                >
                  {formatDelta(flash.delta, metric)}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {Icon && (
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
          )}
        </div>
        <Sparkline data={metric.spark} className="mt-3 h-5 w-full text-primary/60" />
      </CardContent>
    </Card>
  );
}

/** Tiny dependency-free SVG sparkline. */
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (!data || data.length < 2) return null;
  const w = 100;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Amber ring that pulses once each time a fresh payout event lands. */
function PayoutPulseRing() {
  const { latest } = usePayoutEvents();
  const [pulse, setPulse] = useState(false);
  const [seenId, setSeenId] = useState<string | null>(null);

  useEffect(() => {
    if (!latest || latest.id === seenId) return;
    setSeenId(latest.id);
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 1600);
    return () => window.clearTimeout(t);
  }, [latest, seenId]);

  if (!pulse) return null;
  return (
    <span
      className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-lg ring-2 ring-warning ring-offset-0"
      aria-hidden="true"
    />
  );
}
