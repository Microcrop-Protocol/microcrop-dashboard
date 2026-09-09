/**
 * DETERMINATIONS — the one artifact a Determination-tier partner buys, and until now it could
 * not see a single one.
 *
 * Determinations reached an organization only by hanging off a Payout, and a Tier 1 org has no
 * Payout by definition; the evidence package had exactly one route, gated PLATFORM_ADMIN. So the
 * buyer of the Determination plan had no surface at all for the thing it was paying for. This
 * page and its detail view are that surface.
 *
 * THREE COLUMNS FOR THREE FACTS. The table deliberately carries a separate column for what
 * MicroCrop determined, whether MicroCrop settled, and what the partner reported — never one
 * merged "status". In a list the temptation to collapse is strongest and the damage is worst: a
 * single column reading "Unsettled" across a Tier 1 book looks like an outage, and one reading
 * "Paid" would launder unverified partner claims into MicroCrop facts, at scale, in an export.
 *
 * NOT TIER-GATED. Both tiers determine; the tier decides who settles. The backend deliberately
 * mounts no tier middleware on these routes for the same reason.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { api } from '@/lib/api';
import { useServiceTier } from '@/hooks/useServiceTier';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PartnerReportBadge,
  SettlementFactBadge,
  TriggeredBadge,
} from '@/components/determinations/FactBadges';
import { formatOwed } from '@/lib/determinations';
import { DETERMINATION_STATUSES, determinationKindLabel } from '@/lib/determinations';
import { TIER1_LOCKED_NEXT } from '@/lib/tier';
import { formatDate } from '@/lib/utils';
import { FileSignature, AlertCircle, ClipboardList, CircleSlash } from 'lucide-react';
import type { DeterminationStatus, PartnerDetermination } from '@/types';

const ALL = '__ALL__';

export default function DeterminationsPage() {
  const navigate = useNavigate();
  const tier = useServiceTier();
  const [status, setStatus] = useState<string>(ALL);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['determinations', status],
    queryFn: () =>
      api.getDeterminations(status === ALL ? {} : { status: status as DeterminationStatus }),
  });

  const rows = useMemo(() => data?.data ?? [], [data]);

  // Counted on FACT 3, not on FACT 2: "how many farmers am I still expected to have paid and
  // told MicroCrop about" is the Tier 1 partner's actual operational question.
  const awaiting = rows.filter(
    (d) => d.partnerReport.reportRequired && d.partnerReport.status === 'NOT_REPORTED',
  ).length;
  const overdue = rows.filter((d) => d.partnerReport.status === 'OVERDUE').length;
  const triggered = rows.filter((d) => d.determined.triggered).length;

  const columns: ColumnDef<PartnerDetermination>[] = [
    {
      id: 'policyNumber',
      header: 'Policy',
      accessorFn: (row) => row.policy?.policyNumber ?? '—',
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <span className="font-medium">{row.original.policy?.policyNumber ?? '—'}</span>
          <span className="text-xs text-muted-foreground">
            {determinationKindLabel(row.original.determined.kind)}
          </span>
        </div>
      ),
    },
    {
      id: 'determined',
      header: 'MicroCrop determined',
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <TriggeredBadge triggered={row.original.determined.triggered} />
          <span className="text-xs text-muted-foreground">
            {formatDate(row.original.determined.assessedAt)}
          </span>
        </div>
      ),
    },
    {
      id: 'owed',
      header: 'Amount owed',
      // Always the policy's own currency, derived from its own sumInsured. Never a USDC figure —
      // a Tier 1 response carries none, and inventing one here would hand the partner an FX
      // dependency it explicitly did not buy.
      cell: ({ row }) => <span className="font-medium">{formatOwed(row.original.settlement)}</span>,
    },
    {
      id: 'settlement',
      header: 'Settled by MicroCrop',
      cell: ({ row }) => <SettlementFactBadge status={row.original.settlement.status} />,
    },
    {
      id: 'partnerReport',
      header: 'Your report',
      cell: ({ row }) => <PartnerReportBadge status={row.original.partnerReport.status} />,
    },
    {
      id: 'determinedAt',
      header: 'Determined',
      cell: ({ row }) => formatDate(row.original.determined.determinedAt),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Determinations</h1>
          <p className="text-muted-foreground">
            Every signed determination MicroCrop has issued for your policies, with its evidence
            package.
          </p>
        </div>
        <div className="w-56">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {DETERMINATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Only on a POSITIVELY-KNOWN Tier 1. While the tier is loading, and when it cannot be
          read, this says nothing at all rather than telling a settlement-tier partner it is on
          a plan it is not on. */}
      {tier.isDeterminationOnly && (
        <div role="note" className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm">
          <p className="font-medium">You settle these farmers, not MicroCrop</p>
          <p className="mt-1 text-muted-foreground">
            Your organization is on the Determination plan: MicroCrop determines whether the
            trigger fired and issues the signed determination and evidence package, and
            deliberately settles nothing. {TIER1_LOCKED_NEXT} Record what you paid on each
            determination so it appears in your audit trail.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Determinations" value={rows.length} icon={FileSignature} />
        <StatCard title="Trigger fired" value={triggered} icon={AlertCircle} />
        <StatCard title="Awaiting your report" value={awaiting} icon={ClipboardList} />
        <StatCard title="Reports overdue" value={overdue} icon={CircleSlash} />
      </div>

      {isError ? (
        <div role="alert" className="rounded-lg border border-error/40 bg-error/10 p-6 text-sm">
          <p className="font-medium">We couldn't load your determinations</p>
          <p className="mt-1 text-muted-foreground">
            This is a problem reading the list, not a problem with the determinations themselves.
          </p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          searchKey="policyNumber"
          searchPlaceholder="Search by policy number…"
          onRowClick={(row) => navigate(`/org/determinations/${row.id}`)}
          emptyMessage="No determinations yet. One is issued for a policy when its index is assessed."
        />
      )}
    </div>
  );
}
