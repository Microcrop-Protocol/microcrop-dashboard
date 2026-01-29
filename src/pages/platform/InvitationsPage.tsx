import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isValid } from 'date-fns';
import { Search, Mail, Send, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { KYBStatusBadge } from '@/components/kyb/KYBStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ColumnDef } from '@tanstack/react-table';
import { useToast } from '@/hooks/use-toast';
import type { OrgAdminInvitation, InvitationStatus } from '@/types';

export default function InvitationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => api.getOrgInvitations(),
  });

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => api.sendOrgAdminInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: 'Invitation Resent',
        description: 'The invitation email has been sent again.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to resend invitation',
        variant: 'destructive',
      });
    },
  });

  const invitations = data?.data ?? [];

  // Calculate stats
  const pendingCount = invitations.filter(i => i.status === 'PENDING').length;
  const sentCount = invitations.filter(i => i.status === 'SENT').length;
  const acceptedCount = invitations.filter(i => i.status === 'ACCEPTED').length;
  const expiredCount = invitations.filter(i => {
    if (i.status === 'EXPIRED') return true;
    const expiresAt = new Date(i.tokenExpiresAt);
    return isValid(expiresAt) && expiresAt < new Date();
  }).length;

  // Filter invitations
  const filteredInvitations = invitations.filter((inv) => {
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesSearch =
      search === '' ||
      inv.email.toLowerCase().includes(search.toLowerCase()) ||
      inv.organizationName?.toLowerCase().includes(search.toLowerCase()) ||
      `${inv.firstName} ${inv.lastName}`.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const columns: ColumnDef<OrgAdminInvitation>[] = [
    {
      accessorKey: 'email',
      header: 'Recipient',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </div>
          <div className="text-sm text-muted-foreground">{row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: 'organizationName',
      header: 'Organization',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.organizationName}</div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as InvitationStatus;
        const expiresAt = new Date(row.original.tokenExpiresAt);
        const isExpired = isValid(expiresAt) && expiresAt < new Date();
        return <KYBStatusBadge status={isExpired && status !== 'ACCEPTED' ? 'EXPIRED' : status} />;
      },
    },
    {
      accessorKey: 'sentAt',
      header: 'Sent',
      cell: ({ row }) => {
        const sentAt = row.original.sentAt;
        return sentAt ? (
          <div className="text-sm text-muted-foreground">
            {formatDate(sentAt, 'MMM d, yyyy HH:mm', 'Not sent')}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Not sent</span>
        );
      },
    },
    {
      accessorKey: 'tokenExpiresAt',
      header: 'Expires',
      cell: ({ row }) => {
        const expiresAtValue = row.original.tokenExpiresAt;
        if (!expiresAtValue) {
          return <span className="text-sm text-muted-foreground">-</span>;
        }
        const expiresAt = new Date(expiresAtValue);
        const dateIsValid = isValid(expiresAt);
        const isExpired = dateIsValid && expiresAt < new Date();
        return (
          <div className={`text-sm ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
            {formatDate(expiresAtValue)}
            {isExpired && ' (Expired)'}
          </div>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const status = row.original.status;
        const expiresAt = new Date(row.original.tokenExpiresAt);
        const isExpired = isValid(expiresAt) && expiresAt < new Date();
        const canResend = (status === 'PENDING' || status === 'SENT') && !isExpired;

        if (!canResend) return null;

        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              resendMutation.mutate(row.original.id);
            }}
            disabled={resendMutation.isPending}
          >
            <RefreshCw className={`mr-1 h-3 w-3 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
            {status === 'PENDING' ? 'Send' : 'Resend'}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Invitations</h1>
        <p className="text-muted-foreground">
          Track and manage organization admin invitations
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Not yet sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <Mail className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting acceptance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{acceptedCount}</div>
            <p className="text-xs text-muted-foreground">Accounts created</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredCount}</div>
            <p className="text-xs text-muted-foreground">Need reissuance</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invitations..."
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
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="ACCEPTED">Accepted</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredInvitations}
        isLoading={isLoading}
      />
    </div>
  );
}
