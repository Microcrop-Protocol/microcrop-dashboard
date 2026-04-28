import { useMemo, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { slugify } from '@/lib/slugify';

interface TagInputProps {
  value: string[]; // tag slugs
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

  const suggestions = useMemo(() => {
    const trimmed = draft.trim().toLowerCase();
    if (!trimmed) return [];
    return tags
      .filter((t) => !value.includes(t.slug))
      .filter((t) => t.name.toLowerCase().includes(trimmed) || t.slug.includes(trimmed))
      .slice(0, 6);
  }, [draft, tags, value]);

  const add = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    const slug = slugify(name);
    if (!slug || value.includes(slug)) {
      setDraft('');
      return;
    }
    onChange([...value, slug]);
    setDraft('');
  };

  const remove = (slug: string) => {
    onChange(value.filter((s) => s !== slug));
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
        {value.map((slug) => (
          <span
            key={slug}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
          >
            {slugToName.get(slug) ?? slug}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => remove(slug)}
              aria-label={`Remove ${slug}`}
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
