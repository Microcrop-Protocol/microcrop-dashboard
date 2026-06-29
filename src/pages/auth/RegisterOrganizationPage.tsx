import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/hooks/use-toast';
import { orgSignupSchema, orgTypeLabels, type OrgSignupFormData } from '@/lib/validations/kyb';

// Backend expects +254XXXXXXXXX; accept 07.../01... and normalise.
function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const p = phone.trim();
  if (!p) return undefined;
  if (p.startsWith('+254')) return p;
  if (p.startsWith('0')) return `+254${p.slice(1)}`;
  return p;
}

export default function RegisterOrganizationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrgSignupFormData>({
    resolver: zodResolver(orgSignupSchema),
  });
  const type = watch('type');

  const onSubmit = async (data: OrgSignupFormData) => {
    setIsLoading(true);
    try {
      const { user, tokens } = await api.registerOrganization({
        organizationName: data.organizationName,
        registrationNumber: data.registrationNumber,
        type: data.type,
        county: data.county || undefined,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phone: normalizePhone(data.phone),
      });
      login(user, tokens);
      toast({
        title: 'Welcome to MicroCrop',
        description: 'Your account is ready. Complete KYB verification to start underwriting.',
      });
      navigate('/org/kyb', { replace: true });
    } catch (error) {
      toast({
        title: 'Signup failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/microcropsymb.png" alt="MicroCrop" width={40} height={40} className="h-10 w-10 object-contain" loading="lazy" />
            <span className="text-xl font-bold">MicroCrop</span>
          </Link>
          <h1 className="text-2xl font-bold">Create your organization account</h1>
          <p className="mt-2 text-muted-foreground">
            Sign up to get started — you can complete KYB verification from your dashboard afterwards.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Organization</CardTitle>
              <CardDescription>Details about your organization.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="organizationName">Organization name</Label>
                <Input id="organizationName" {...register('organizationName')} placeholder="Acme Cooperative" />
                {errors.organizationName && <p className="mt-1 text-sm text-destructive">{errors.organizationName.message}</p>}
              </div>
              <div>
                <Label htmlFor="registrationNumber">Registration number</Label>
                <Input id="registrationNumber" {...register('registrationNumber')} placeholder="CPR/2024/0001" />
                {errors.registrationNumber && <p className="mt-1 text-sm text-destructive">{errors.registrationNumber.message}</p>}
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={(v) => setValue('type', v as OrgSignupFormData['type'], { shouldValidate: true })}>
                  <SelectTrigger id="type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(orgTypeLabels).map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && <p className="mt-1 text-sm text-destructive">{errors.type.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="county">County <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="county" {...register('county')} placeholder="Nakuru" />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Admin account</CardTitle>
              <CardDescription>This becomes the organization's first admin user.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" {...register('firstName')} />
                {errors.firstName && <p className="mt-1 text-sm text-destructive">{errors.firstName.message}</p>}
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" {...register('lastName')} />
                {errors.lastName && <p className="mt-1 text-sm text-destructive">{errors.lastName.message}</p>}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="phone" {...register('phone')} placeholder="0712345678" />
                {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...register('password')} />
                {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword.message}</p>}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="mt-6 w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create account
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
