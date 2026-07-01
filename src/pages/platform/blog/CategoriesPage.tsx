import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { notifySuccess, notifyError } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CategoryDialog } from '@/components/blog/CategoryDialog';
import type { BlogCategory } from '@/types';

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BlogCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BlogCategory | null>(null);

  const { data: categories = [], isLoading, isError } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => api.getBlogCategories(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBlogCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blog-categories'] });
      notifySuccess('Category deleted', 'Posts that used it are now uncategorized.');
      setConfirmDelete(null);
    },
    onError: (err) => notifyError(err, "Couldn't delete the category."),
  });

  const columns: ColumnDef<BlogCategory>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.slug}</span>
      ),
    },
    {
      accessorKey: 'postCount',
      header: 'Posts',
      cell: ({ row }) => row.original.postCount ?? 0,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(row.original);
            }}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(row.original);
            }}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Back to posts">
            <Link to="/platform/blog">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Categories</h1>
            <p className="text-muted-foreground">Group related posts</p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New category
        </Button>
      </div>

      {isError ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          We couldn't load categories. Please try again.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={categories}
          isLoading={isLoading}
          emptyMessage="No categories yet."
        />
      )}

      <CategoryDialog
        open={creating}
        onOpenChange={setCreating}
      />
      <CategoryDialog
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        category={editing}
      />

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              Posts assigned to "{confirmDelete?.name}" will become uncategorized. This cannot be undone.
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
