import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { resolveFileUrl } from '@/lib/utils';

export interface CoverImageState {
  path: string | null;
  url: string | null;
  alt: string;
  width: number | null;
  height: number | null;
}

interface CoverImageUploaderProps {
  value: CoverImageState;
  onChange: (next: CoverImageState) => void;
}

export function CoverImageUploader({ value, onChange }: CoverImageUploaderProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  // Local blob: URL shown while the upload is in flight (or after, until reload).
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const releaseObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  // Drop the local preview when the parent supplies a fresh server-backed value
  // (e.g. after the post loads or save returns).
  useEffect(() => {
    if (!value.url) {
      releaseObjectUrl();
      setLocalPreview(null);
    }
  }, [value.url]);

  // Clean up on unmount.
  useEffect(() => () => releaseObjectUrl(), []);

  const handleFile = useCallback(
    async (file: File) => {
      // Show the picked file immediately so the preview never goes blank
      // while we wait on the upload round-trip.
      releaseObjectUrl();
      const localUrl = URL.createObjectURL(file);
      objectUrlRef.current = localUrl;
      setLocalPreview(localUrl);
      setUploading(true);
      try {
        const result = await api.uploadBlogImage(file);
        // Read natural dimensions from the local file (no round-trip needed).
        const dims = await readImageDimensions(localUrl);
        onChange({
          path: result.path,
          url: result.url,
          alt: value.alt,
          width: dims.width,
          height: dims.height,
        });
      } catch (err) {
        releaseObjectUrl();
        setLocalPreview(null);
        toast({
          title: 'Upload failed',
          description: err instanceof Error ? err.message : 'Could not upload image',
          variant: 'destructive',
        });
      } finally {
        setUploading(false);
      }
    },
    [onChange, toast, value.alt],
  );

  const onDrop = useCallback(
    (files: File[]) => {
      if (files[0]) void handleFile(files[0]);
    },
    [handleFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: uploading,
  });

  const remove = () => {
    releaseObjectUrl();
    setLocalPreview(null);
    onChange({ path: null, url: null, alt: '', width: null, height: null });
  };

  // Prefer the local blob URL (set immediately on file pick) over the server URL
  // so the preview is instant and doesn't depend on the upload round-trip rendering.
  const displayUrl = localPreview ?? (value.url ? resolveFileUrl(value.url) : null);

  return (
    <div className="space-y-3">
      {displayUrl ? (
        <div className="relative overflow-hidden rounded-md border bg-muted">
          <img
            src={displayUrl}
            alt={value.alt || 'Cover preview'}
            className="h-48 w-full object-cover"
            loading="lazy"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2"
            onClick={remove}
            aria-label="Remove cover image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`flex h-48 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:bg-muted/50'
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <>
              <Loader2 className="mb-2 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Uploading…</p>
            </>
          ) : (
            <>
              <ImageIcon className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">Drop an image, or click to browse</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WebP up to ~5 MB</p>
            </>
          )}
        </div>
      )}

      {displayUrl && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = 'image/*';
            inp.onchange = () => {
              if (inp.files?.[0]) void handleFile(inp.files[0]);
            };
            inp.click();
          }}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? 'Uploading…' : 'Replace image'}
        </Button>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cover-alt">Alt text</Label>
        <Input
          id="cover-alt"
          placeholder="Describe the image for screen readers"
          value={value.alt}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
        />
      </div>
    </div>
  );
}

function readImageDimensions(url: string): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null });
    img.onerror = () => resolve({ width: null, height: null });
    img.src = url;
  });
}
