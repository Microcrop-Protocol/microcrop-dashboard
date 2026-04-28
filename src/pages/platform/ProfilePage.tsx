import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { resolveFileUrl } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { User } from '@/types';

const BIO_MAX = 500;

export default function ProfilePage() {
  const me = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [displayRole, setDisplayRole] = useState(me?.displayRole ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl ?? '');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setFirstName(me?.firstName ?? '');
    setLastName(me?.lastName ?? '');
    setPhone(me?.phone ?? '');
    setDisplayRole(me?.displayRole ?? '');
    setBio(me?.bio ?? '');
    setAvatarUrl(me?.avatarUrl ?? '');
  }, [me?.id]);

  const handleAvatarFile = async (file: File) => {
    setUploading(true);
    try {
      const result = await api.uploadBlogImage(file);
      setAvatarPath(result.path);
      setAvatarUrl(result.url);
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateMyProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        displayRole: displayRole.trim() || undefined,
        bio: bio.trim() || undefined,
        // Persist path (the backend stores paths and rewrites to URLs at read time).
        avatarUrl: avatarPath ?? avatarUrl ?? undefined,
      }),
    onSuccess: (updated: User) => {
      setUser(updated);
      toast({ title: 'Profile updated' });
    },
    onError: (err) =>
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      }),
  });

  const bioOver = bio.length > BIO_MAX;
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">
          This information appears as the author on blog posts you create.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Author info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-2xl font-medium text-primary">
              {avatarUrl ? (
                <img
                  src={resolveFileUrl(avatarUrl)}
                  alt="Avatar"
                  className="h-20 w-20 object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="space-y-2">
              <Label>Avatar</Label>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => {
                    const inp = document.createElement('input');
                    inp.type = 'file';
                    inp.accept = 'image/*';
                    inp.onchange = () => {
                      if (inp.files?.[0]) void handleAvatarFile(inp.files[0]);
                    };
                    inp.click();
                  }}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {uploading ? 'Uploading…' : avatarUrl ? 'Replace' : 'Upload avatar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Square images work best. Shown next to posts on the marketing site.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={me?.email ?? ''} readOnly disabled />
              <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254 …"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayRole">Display role</Label>
            <Input
              id="displayRole"
              value={displayRole}
              onChange={(e) => setDisplayRole(e.target.value)}
              placeholder="e.g. CEO & Co-founder"
            />
            <p className="text-xs text-muted-foreground">
              Free-text title shown next to your name on posts. Distinct from your system role
              ({me?.role.replace(/_/g, ' ')}).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="A short bio shown on author pages."
            />
            <p className={`text-xs ${bioOver ? 'text-destructive' : 'text-muted-foreground'}`}>
              {bio.length}/{BIO_MAX}
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || bioOver}>
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
