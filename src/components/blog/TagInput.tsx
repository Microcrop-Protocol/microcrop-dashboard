import { useMemo, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { slugify } from '@/lib/slugify';

interface TagInputProps {
  // Existing tags loaded from a post are slugs; newly added tags carry their
  // human-entered display name. The backend slugifies either form to resolve/create.
  value: string[];
  onChange: (next: string[]) => void;
}

export function TagInput({ value, onChange }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const { data: tags = [] } = useQuery({
    queryKey: ['blog-tags'],
    queryFn: () => api.getBlogTags(),
  });

  const slugToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tags) map.set(t.slug, t.name);
    return map;
  }, [tags]);

  // Slugs already present, so we can de-dupe regardless of whether an entry is
  // stored as a slug (loaded post) or a display name (freshly typed).
  const selectedSlugs = useMemo(() => new Set(value.map((v) => slugify(v))), [value]);

  const suggestions = useMemo(() => {
    const trimmed = draft.trim().toLowerCase();
    if (!trimmed) return [];
    return tags
      .filter((t) => !selectedSlugs.has(t.slug))
      .filter((t) => t.name.toLowerCase().includes(trimmed) || t.slug.includes(trimmed))
      .slice(0, 6);
  }, [draft, tags, selectedSlugs]);

  const add = (raw: string) => {
    const name = raw.trim();
    if (!name) {
      setDraft('');
      return;
    }
    const slug = slugify(name);
    if (!slug || selectedSlugs.has(slug)) {
      setDraft('');
      return;
    }
    // Keep the human-entered display name for new tags; the backend derives the slug.
    onChange([...value, name]);
    setDraft('');
  };

  const remove = (entry: string) => {
    onChange(value.filter((s) => s !== entry));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 rounded-md border bg-background px-2 py-1.5 min-h-[42px]">
        {value.map((entry) => (
          <span
            key={entry}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
          >
            {slugToName.get(entry) ?? entry}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => remove(entry)}
              aria-label={`Remove ${slugToName.get(entry) ?? entry}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          className="h-7 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
          placeholder={value.length ? '' : 'Add tags…'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <Button
              key={s.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => add(s.name)}
            >
              + {s.name}
            </Button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Press Enter or comma to add. New tags will be created automatically.</p>
    </div>
  );
}
