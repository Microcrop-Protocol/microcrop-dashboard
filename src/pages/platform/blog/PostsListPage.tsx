import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { api } from '@/lib/api';
import { formatDate, resolveFileUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PostStatusBadge } from '@/components/blog/PostStatusBadge';
import type { BlogPost, PostStatus } from '@/types';

const SITE_ORIGIN = 'https://microcrop.app';

export default function PostsListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<BlogPost | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['blog-posts', statusFilter, search],
    queryFn: () =>
      api.getBlogPosts({
        page: 1,
        pageSize: 50,
        status: statusFilter === 'all' ? undefined : (statusFilter as PostStatus),
        search: search.trim() || undefined,
      }),
  });

  const posts = data?.data ?? [];

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.publishBlogPost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blog-posts'] });
      toast({ title: 'Post published' });
    },
    onError: (err) =>
      toast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => api.unpublishBlogPost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blog-posts'] });
      toast({ title: 'Post unpublished' });
    },
    onError: (err) =>
      toast({
        title: 'Unpublish failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBlogPost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blog-posts'] });
      toast({ title: 'Post deleted' });
      setConfirmDelete(null);
    },
    onError: (err) =>
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const columns: ColumnDef<BlogPost>[] = [
    {
      id: 'cover',
      header: '',
      cell: ({ row }) => {
        const url = row.original.coverImageUrl;
        if (!url) {
          return <div className="h-10 w-16 rounded bg-muted" aria-hidden="true" />;
        }
        return (
          <img
            src={resolveFileUrl(url)}
            alt=""
            className="h-10 w-16 rounded object-cover"
            loading="lazy"
          />
        );
      },
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div>
          <div className="font-medium line-clamp-1">{row.original.title}</div>
          <div className="text-xs text-muted-foreground line-clamp-1">/{row.original.slug}</div>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <PostStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) =>
        row.original.category?.name ? (
          <span className="text-sm">{row.original.category.name}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: 'author',
      header: 'Author',
      cell: ({ row }) => {
        const a = row.original.author;
        if (!a) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <span className="text-sm">
            {a.firstName} {a.lastName}
          </span>
        );
      },
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.updatedAt, 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const post = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/platform/blog/${post.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {post.status === 'PUBLISHED' && (
                  <DropdownMenuItem asChild>
                    <a
                      href={`${SITE_ORIGIN}/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View on site
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {post.status === 'PUBLISHED' ? (
                  <DropdownMenuItem
                    onClick={() => unpublishMutation.mutate(post.id)}
                    disabled={unpublishMutation.isPending}
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Unpublish
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => publishMutation.mutate(post.id)}
                    disabled={publishMutation.isPending}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Publish now
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmDelete(post)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="text-muted-foreground">Author and manage marketing site posts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/platform/blog/categories">Categories</Link>
          </Button>
          <Button asChild>
            <Link to="/platform/blog/new">
              <Plus className="mr-2 h-4 w-4" />
              New post
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search posts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            autoComplete="off"
            aria-label="Search posts"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="UNPUBLISHED">Unpublished</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={posts}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/platform/blog/${row.id}/edit`)}
        emptyMessage="No posts yet. Click 'New post' to create one."
      />

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post?</DialogTitle>
            <DialogDescription>
              This will permanently remove "{confirmDelete?.title}". Existing redirects from the
              old slug will remain in place.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
