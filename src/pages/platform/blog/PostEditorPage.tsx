import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  EyeOff,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Send,
} from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { api } from '@/lib/api';
import { slugify } from '@/lib/slugify';
import { resolveFileUrl } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { notifySuccess, notifyError } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CoverImageUploader, type CoverImageState } from '@/components/blog/CoverImageUploader';
import { TagInput } from '@/components/blog/TagInput';
import { CategoryDialog } from '@/components/blog/CategoryDialog';
import { PostStatusBadge } from '@/components/blog/PostStatusBadge';
import type { BlogPost, PostStatus } from '@/types';

const SITE_ORIGIN = 'https://microcrop.app';
const EXCERPT_MAX = 280;
const NO_CATEGORY = '__none__';

interface FormState {
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  body: string;
  cover: CoverImageState;
  metaTitle: string;
  metaDescription: string;
  categoryId: string | null;
  tagSlugs: string[];
}

const empty: FormState = {
  title: '',
  slug: '',
  slugTouched: false,
  excerpt: '',
  body: '',
  cover: { path: null, url: null, alt: '', width: null, height: null },
  metaTitle: '',
  metaDescription: '',
  categoryId: null,
  tagSlugs: [],
};

export default function PostEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const [form, setForm] = useState<FormState>(empty);
  const [originalSlug, setOriginalSlug] = useState<string>('');
  const [originalStatus, setOriginalStatus] = useState<PostStatus | null>(null);
  const [seoOpen, setSeoOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [confirmSlugChange, setConfirmSlugChange] = useState<null | (() => void)>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing post
  const postQuery = useQuery({
    queryKey: ['blog-post', id],
    queryFn: () => api.getBlogPost(id!),
    enabled: isEditing,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => api.getBlogCategories(),
  });

  // Seed form from loaded post
  useEffect(() => {
    if (postQuery.data) {
      const p = postQuery.data;
      setForm({
        title: p.title,
        slug: p.slug,
        slugTouched: true,
        excerpt: p.excerpt ?? '',
        body: p.body ?? '',
        cover: {
          path: p.coverImagePath ?? null,
          url: p.coverImageUrl ?? null,
          alt: p.coverImageAlt ?? '',
          width: p.coverImageWidth ?? null,
          height: p.coverImageHeight ?? null,
        },
        metaTitle: p.metaTitle ?? '',
        metaDescription: p.metaDescription ?? '',
        categoryId: p.category?.id ?? p.categoryId ?? null,
        tagSlugs: (p.tags ?? []).map((t) => t.slug),
      });
      setOriginalSlug(p.slug);
      setOriginalStatus(p.status);
    }
  }, [postQuery.data]);

  const status: PostStatus = postQuery.data?.status ?? 'DRAFT';
  const scheduledFor = postQuery.data?.scheduledFor;

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleTitleChange = (next: string) => {
    setForm((f) => ({
      ...f,
      title: next,
      slug: f.slugTouched ? f.slug : slugify(next),
    }));
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    excerpt: form.excerpt.trim(),
    body: form.body,
    coverImagePath: form.cover.path ?? undefined,
    coverImageAlt: form.cover.alt.trim() || undefined,
    coverImageWidth: form.cover.width ?? undefined,
    coverImageHeight: form.cover.height ?? undefined,
    metaTitle: form.metaTitle.trim() || undefined,
    metaDescription: form.metaDescription.trim() || undefined,
    ogImagePath: form.cover.path ?? undefined,
    categoryId: form.categoryId,
    tagSlugs: form.tagSlugs,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (isEditing && id) {
        return api.updateBlogPost(id, payload);
      }
      return api.createBlogPost({
        title: payload.title,
        slug: payload.slug,
        excerpt: payload.excerpt,
        body: payload.body,
        coverImagePath: payload.coverImagePath,
        coverImageAlt: payload.coverImageAlt,
        coverImageWidth: payload.coverImageWidth,
        coverImageHeight: payload.coverImageHeight,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        ogImagePath: payload.ogImagePath,
        categoryId: payload.categoryId,
        tagSlugs: payload.tagSlugs,
      });
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['blog-posts'] });
      qc.invalidateQueries({ queryKey: ['blog-post', saved.id] });
      notifySuccess('Draft saved');
      if (!isEditing) {
        navigate(`/platform/blog/${saved.id}/edit`, { replace: true });
      }
    },
    onError: (err) => notifyError(err, "Couldn't save the draft."),
  });

  const publishMutation = useMutation({
    mutationFn: async (when?: string) => {
      // Save first to capture the latest content, then publish.
      const saved = await (isEditing && id ? api.updateBlogPost(id, buildPayload()) : api.createBlogPost(buildPayload()));
      return api.publishBlogPost(saved.id, when);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['blog-posts'] });
      qc.invalidateQueries({ queryKey: ['blog-post', saved.id] });
      notifySuccess(saved.status === 'SCHEDULED' ? 'Post scheduled' : 'Post published');
      setScheduleOpen(false);
      if (!isEditing) {
        navigate(`/platform/blog/${saved.id}/edit`, { replace: true });
      }
    },
    onError: (err) => notifyError(err, "Couldn't publish the post."),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => api.unpublishBlogPost(id!),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['blog-posts'] });
      qc.invalidateQueries({ queryKey: ['blog-post', saved.id] });
      notifySuccess('Post unpublished');
    },
    onError: (err) => notifyError(err, "Couldn't unpublish the post."),
  });

  const slugChangedOnPublished =
    isEditing &&
    originalStatus === 'PUBLISHED' &&
    form.slug.trim() &&
    form.slug.trim() !== originalSlug;

  const guardSlugThen = (action: () => void) => {
    if (slugChangedOnPublished) {
      setConfirmSlugChange(() => action);
    } else {
      action();
    }
  };

  const insertInlineImage = async (file: File) => {
    try {
      const result = await api.uploadBlogImage(file);
      const md = `\n\n![](${result.url})\n\n`;
      setForm((f) => ({ ...f, body: (f.body || '') + md }));
      notifySuccess('Image inserted');
    } catch (err) {
      notifyError(err, "Couldn't upload the image.");
    }
  };

  const onPickInlineImage = () => fileInputRef.current?.click();

  const canSubmit =
    form.title.trim().length > 0 && form.excerpt.trim().length > 0 && !saveMutation.isPending;
  const excerptCount = form.excerpt.length;
  const excerptOver = excerptCount > EXCERPT_MAX;

  const slugPreview = form.slug || (form.title ? slugify(form.title) : 'your-post-slug');

  if (isEditing && postQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isEditing && postQuery.isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/platform/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to posts
          </Link>
        </Button>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            We couldn't load this post. Please try again.
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold">{isEditing ? 'Edit post' : 'New post'}</h1>
            <p className="text-sm text-muted-foreground">
              {isEditing ? `Editing "${postQuery.data?.title}"` : 'Drafts auto-save when you click Save'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => guardSlugThen(() => saveMutation.mutate())}
            disabled={!canSubmit || excerptOver}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save draft'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={!canSubmit || excerptOver}>
                <Send className="mr-2 h-4 w-4" />
                {publishMutation.isPending ? 'Working…' : 'Publish'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => guardSlugThen(() => publishMutation.mutate(undefined))}
              >
                <Send className="mr-2 h-4 w-4" />
                Publish now
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setScheduleAt(defaultScheduleAt());
                  setScheduleOpen(true);
                }}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                Schedule…
              </DropdownMenuItem>
              {status === 'PUBLISHED' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => unpublishMutation.mutate()}
                    disabled={unpublishMutation.isPending}
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Unpublish
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="A clear, compelling title"
                  className="text-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => update({ slug: slugify(e.target.value), slugTouched: true })}
                  placeholder="auto-generated-from-title"
                />
                <p className="text-xs text-muted-foreground">
                  {SITE_ORIGIN}/blog/<span className="font-medium text-foreground">{slugPreview}</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={form.excerpt}
                  onChange={(e) => update({ excerpt: e.target.value })}
                  rows={3}
                  placeholder="A short summary shown on listings and link previews"
                />
                <p className={`text-xs ${excerptOver ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {excerptCount}/{EXCERPT_MAX}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 pt-6">
              <Label>Cover image</Label>
              <CoverImageUploader value={form.cover} onChange={(cover) => update({ cover })} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between">
                <Label>Body</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void insertInlineImage(f);
                    e.target.value = '';
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={onPickInlineImage}>
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Insert image
                </Button>
              </div>
              <div data-color-mode="light">
                <MDEditor
                  value={form.body}
                  onChange={(v) => update({ body: v ?? '' })}
                  height={500}
                  preview="live"
                  textareaProps={{
                    placeholder: 'Write your post in Markdown…',
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Markdown supported. Pasting from Google Docs will paste plain text.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <PostStatusBadge status={status} />
              </div>
              {status === 'SCHEDULED' && scheduledFor && (
                <p className="text-xs text-muted-foreground">
                  Scheduled for {new Date(scheduledFor).toLocaleString()}
                </p>
              )}
              {status === 'PUBLISHED' && postQuery.data?.publishedAt && (
                <p className="text-xs text-muted-foreground">
                  Published {new Date(postQuery.data.publishedAt).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="category">Category</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setCategoryDialogOpen(true)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  New
                </Button>
              </div>
              <Select
                value={form.categoryId ?? NO_CATEGORY}
                onValueChange={(v) => update({ categoryId: v === NO_CATEGORY ? null : v })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Uncategorized" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 pt-6">
              <Label>Tags</Label>
              <TagInput value={form.tagSlugs} onChange={(tagSlugs) => update({ tagSlugs })} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 pt-6">
              <Label>Author</Label>
              <AuthorPreview />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                    <span className="text-sm font-medium">SEO</span>
                    <span className="text-xs text-muted-foreground">{seoOpen ? 'Hide' : 'Show'}</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="metaTitle">Meta title</Label>
                    <Input
                      id="metaTitle"
                      value={form.metaTitle}
                      onChange={(e) => update({ metaTitle: e.target.value })}
                      placeholder="Defaults to post title"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="metaDescription">Meta description</Label>
                    <Textarea
                      id="metaDescription"
                      value={form.metaDescription}
                      onChange={(e) => update({ metaDescription: e.target.value })}
                      rows={2}
                      placeholder="Defaults to excerpt"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Open Graph image uses the cover image by default.
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </aside>
      </div>

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onSaved={(c) => update({ categoryId: c.id })}
      />

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule post</DialogTitle>
            <DialogDescription>
              The post will publish automatically at the chosen time. The marketing site rebuilds on publish.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="schedule-at">Publish at</Label>
            <Input
              id="schedule-at"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                guardSlugThen(() => {
                  if (!scheduleAt) return;
                  publishMutation.mutate(new Date(scheduleAt).toISOString());
                })
              }
              disabled={!scheduleAt || publishMutation.isPending}
            >
              {publishMutation.isPending ? 'Scheduling…' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmSlugChange)}
        onOpenChange={(o) => !o && setConfirmSlugChange(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change slug on a published post?</DialogTitle>
            <DialogDescription>
              Changing the slug of a published post will break existing links unless visitors are
              redirected. The backend will save the old slug as a redirect, but external links
              already cached elsewhere may temporarily 404.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSlugChange(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const action = confirmSlugChange;
                setConfirmSlugChange(null);
                action?.();
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function AuthorPreview() {
    const initials = useMemo(() => {
      const f = me?.firstName?.[0] ?? '';
      const l = me?.lastName?.[0] ?? '';
      return `${f}${l}`.toUpperCase() || '?';
    }, []);
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {me?.avatarUrl ? (
            <img
              src={resolveFileUrl(me.avatarUrl)}
              alt="Author avatar"
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium">
            {me?.firstName} {me?.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {me?.displayRole || me?.role.replace(/_/g, ' ')}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
          <Link to="/platform/profile">Edit</Link>
        </Button>
      </div>
    );
  }
}

function defaultScheduleAt(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60);
  // Format for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
