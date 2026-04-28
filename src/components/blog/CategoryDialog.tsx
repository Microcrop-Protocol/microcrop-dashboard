import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { slugify } from '@/lib/slugify';
import type { BlogCategory } from '@/types';

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: BlogCategory | null;
  onSaved?: (cat: BlogCategory) => void;
}

export function CategoryDialog({ open, onOpenChange, category, onSaved }: CategoryDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setSlug(category?.slug ?? '');
      setSlugTouched(Boolean(category?.slug));
      setDescription(category?.description ?? '');
    }
  }, [open, category]);

  const handleNameChange = (next: string) => {
    setName(next);
    if (!slugTouched) setSlug(slugify(next));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
      };
      return category
        ? api.updateBlogCategory(category.id, payload)
        : api.createBlogCategory(payload);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['blog-categories'] });
      toast({
        title: category ? 'Category updated' : 'Category created',
        description: saved.name,
      });
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (err) => {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Could not save category',
        variant: 'destructive',
      });
    },
  });

  const canSubmit = name.trim().length > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>
            Categories group related posts. The slug is used in URLs and should be lowercase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Product updates"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-slug">Slug</Label>
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTouched(true);
              }}
              placeholder="product-updates"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description (optional)</Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown on category pages"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending ? 'Saving…' : category ? 'Save changes' : 'Create category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
