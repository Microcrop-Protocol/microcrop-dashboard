import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, FileText, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { KYBStatusBadge } from '@/components/kyb/KYBStatusBadge';
import { StatusBadge, getStatusVariant } from '@/components/ui/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import type { OrganizationApplication, ApplicationStatus } from '@/types';
import { organizationTypeLabels } from '@/lib/validations/kyb';

const columns: ColumnDef<OrganizationApplication>[] = [
  {
    accessorKey: 'name',
    header: 'Organization Name',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.getValue('name')}</div>
        <div className="text-sm text-muted-foreground">
          {row.original.contactFirstName} {row.original.contactLastName}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <StatusBadge variant={getStatusVariant(row.getValue('type'))}>
        {organizationTypeLabels[row.getValue('type') as string] || row.getValue('type')}
      </StatusBadge>
    ),
  },
  {
    accessorKey: 'contactEmail',
    header: 'Contact',
    cell: ({ row }) => (
      <div className="text-sm">
        <div>{row.original.contactEmail}</div>
        <div className="text-muted-foreground">{row.original.contactPhone}</div>
      </div>
    ),
  },
  {
    accessorKey: 'kybVerification',
    header: 'Documents',
    cell: ({ row }) => {
      // Count documents from kybVerification or check document URLs directly
      const kybDocs = row.original.kybVerification?.documents?.length ?? 0;
      const hasBusinessCert = !!row.original.businessRegistrationCertUrl;
      const hasTaxCert = !!row.original.taxPinCertUrl;
      const urlDocCount = (hasBusinessCert ? 1 : 0) + (hasTaxCert ? 1 : 0);
      const docCount = kybDocs || urlDocCount;

      return (
        <div className="flex items-center gap-1 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {docCount > 0 ? `${docCount} uploaded` : 'None'}
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <KYBStatusBadge status={row.getValue('status')} />,
  },
  {
    accessorKey: 'createdAt',
    header: 'Submitted',
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {formatDate(row.getValue('createdAt'))}
      </div>
    ),
  },
];

export default function KYBReviewPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['kyb-applications'],
    queryFn: () => api.getOrgApplications(),
  });

  const applications = data?.data ?? [];

  // Calculate stats
  const pendingCount = applications.filter(a => a.status === 'PENDING_REVIEW').length;
  const approvedCount = applications.filter(a => a.status === 'APPROVED').length;
  const rejectedCount = applications.filter(a => a.status === 'REJECTED').length;

  // Filter applications
  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesSearch =
      search === '' ||
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.contactEmail.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">KYB Review</h1>
        <p className="text-muted-foreground">
          Review and verify organization applications
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting verification</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Building2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">Organizations created</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{applications.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search applications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredApplications}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/platform/kyb-review/${row.id}`)}
      />
    </div>
  );
}
