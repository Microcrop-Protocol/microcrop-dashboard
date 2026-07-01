import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, ShieldCheck, MapPin, Calculator,
  FileCheck, Smartphone, Loader2, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { notifySuccess, notifyError } from '@/lib/notify';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Farmer, Herd, LivestockPolicyQuote, Policy, IBLISeason, CoverageType } from '@/types';
import {
  pastoralistRegistrationSchema, herdRegistrationSchema, livestockPolicyConfigSchema,
  LIVESTOCK_TYPES, calculateTLU,
  type PastoralistRegistrationData, type HerdRegistrationData, type LivestockPolicyConfigData,
} from '@/lib/validations/livestock-onboarding';

const STEPS = [
  { id: 'register', title: 'Register', icon: UserPlus },
  { id: 'kyc', title: 'Verify', icon: ShieldCheck },
  { id: 'herd', title: 'Herd', icon: MapPin },
  { id: 'quote', title: 'Quote', icon: Calculator },
  { id: 'purchase', title: 'Purchase', icon: FileCheck },
  { id: 'payment', title: 'Payment', icon: Smartphone },
] as const;

export function LivestockOnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [herd, setHerd] = useState<Herd | null>(null);
  const [quote, setQuote] = useState<LivestockPolicyQuote | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'polling' | 'completed' | 'failed'>('idle');
  const [paymentPhone, setPaymentPhone] = useState('');
  // Multi-country: narrow the insurance-unit list by country (units carry an ISO country).
  const [unitCountry, setUnitCountry] = useState<string>('all');

  // Sync paymentPhone when farmer is registered
  useEffect(() => {
    if (farmer?.phone && !paymentPhone) {
      setPaymentPhone(farmer.phone);
    }
  }, [farmer, paymentPhone]);

  // ── Queries ──────────────────────────────────────────────

  const { data: insuranceUnits } = useQuery({
    queryKey: ['insurance-units', 'active'],
    queryFn: () => api.getActiveInsuranceUnits(),
    select: (res) => res.data,
  });

  // ── Forms ──────────────────────────────────────────────

  const farmerForm = useForm<PastoralistRegistrationData>({
    resolver: zodResolver(pastoralistRegistrationSchema),
    defaultValues: {
      phoneNumber: '+254',
      nationalId: '',
      firstName: '',
      lastName: '',
      county: '',
      subCounty: '',
      ward: '',
      village: '',
    },
    mode: 'onChange',
  });

  const herdForm = useForm<HerdRegistrationData>({
    resolver: zodResolver(herdRegistrationSchema),
    defaultValues: {
      name: '',
      livestockType: 'CATTLE',
      headCount: 1,
      estimatedValue: 15000,
      insuranceUnitId: '',
    },
    mode: 'onChange',
  });

  const quoteForm = useForm<LivestockPolicyConfigData>({
    resolver: zodResolver(livestockPolicyConfigSchema),
    defaultValues: {
      season: 'LRLD',
      coverageType: 'DROUGHT',
    },
    mode: 'onChange',
  });

  // ── Mutations ──────────────────────────────────────────

  const registerMutation = useMutation({
    mutationFn: (data: PastoralistRegistrationData) => api.registerFarmer({
      ...data,
      subCounty: data.subCounty || undefined,
      ward: data.ward || undefined,
      village: data.village || undefined,
    }),
    onSuccess: (result) => {
      setFarmer(result);
      setCurrentStep(1);
      notifySuccess('Pastoralist registered', `${result.firstName} ${result.lastName} has been registered.`);
    },
    onError: (error) => {
      notifyError(error, "Couldn't register the pastoralist.");
    },
  });

  const kycMutation = useMutation({
    mutationFn: (farmerId: string) => api.fieldVerifyKyc(farmerId),
    onSuccess: () => {
      if (farmer) setFarmer({ ...farmer, kycStatus: 'APPROVED' });
      setCurrentStep(2);
      notifySuccess('Identity verified', 'KYC field verification completed successfully.');
    },
    onError: (error) => {
      notifyError(error, "Couldn't verify the pastoralist's identity.");
    },
  });

  const createHerdMutation = useMutation({
    mutationFn: (data: HerdRegistrationData) => {
      if (!farmer) throw new Error('No pastoralist registered');
      return api.createHerd({
        farmerId: farmer.id,
        name: data.name,
        livestockType: data.livestockType,
        headCount: data.headCount,
        estimatedValue: data.estimatedValue,
        insuranceUnitId: data.insuranceUnitId,
      });
    },
    onSuccess: (result) => {
      setHerd(result);
      setCurrentStep(3);
      notifySuccess('Herd registered', `"${result.name}" has been registered.`);
    },
    onError: (error) => {
      notifyError(error, "Couldn't register the herd.");
    },
  });

  const quoteMutation = useMutation({
    mutationFn: (data: LivestockPolicyConfigData) => {
      if (!farmer || !herd) throw new Error('Missing pastoralist or herd data');
      return api.getPolicyQuote({
        farmerId: farmer.id,
        herdId: herd.id,
        productType: 'LIVESTOCK',
        // Pass dummy sumInsured and duration as the backend ignores it for livestock and computes from TLU
        sumInsured: herd.headCount * Number(herd.estimatedValue),
        durationDays: 180, 
        coverageType: data.coverageType as CoverageType,
        season: data.season as IBLISeason,
      }) as unknown as Promise<LivestockPolicyQuote>;
    },
    onSuccess: (result) => {
      setQuote(result);
    },
    onError: (error) => {
      notifyError(error, "Couldn't get a premium quote.");
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: () => {
      if (!farmer || !herd || !quote) throw new Error('Missing data');
      const values = quoteForm.getValues();
      return api.purchasePolicy({
        farmerId: farmer.id,
        herdId: herd.id,
        productType: 'LIVESTOCK',
        sumInsured: quote.sumInsured,
        durationDays: 180,
        coverageType: values.coverageType as CoverageType,
        season: values.season as IBLISeason,
      });
    },
    onSuccess: (result) => {
      setPolicy(result);
      setCurrentStep(5);
      notifySuccess('Policy created', `Policy ${result.policyNumber} is ready for payment.`);
    },
    onError: (error) => {
      notifyError(error, "Couldn't create the policy.");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (phoneNumber: string) => {
      if (!policy) throw new Error('No policy created');
      return api.initiatePayment({ policyId: policy.id, phoneNumber });
    },
    onSuccess: (result) => {
      setPaymentRef(result.reference);
      setPaymentStatus('polling');
      notifySuccess('Payment request sent', "Check the pastoralist's phone for the M-Pesa prompt.");
    },
    onError: (error) => {
      notifyError(error, "Couldn't send the payment request.");
    },
  });

  // ── Payment status polling ─────────────────────────────

  useEffect(() => {
    if (paymentStatus !== 'polling' || !paymentRef) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;
    let delay = 3000;

    const poll = async () => {
      if (cancelled || attempts >= maxAttempts) {
        if (!cancelled && attempts >= maxAttempts) {
          setPaymentStatus('failed');
          notifyError(null, "Payment confirmation timed out. Check the pastoralist's M-Pesa messages.");
        }
        return;
      }
      attempts++;
      try {
        const status = await api.getPaymentStatusByRef(paymentRef);
        if (cancelled) return;
        if (status.status === 'COMPLETED') {
          setPaymentStatus('completed');
          queryClient.invalidateQueries({ queryKey: ['farmers'] });
          queryClient.invalidateQueries({ queryKey: ['policies'] });
          queryClient.invalidateQueries({ queryKey: ['herds'] });
          notifySuccess('Payment successful', 'The policy is now active.');
          return;
        } else if (status.status === 'FAILED') {
          setPaymentStatus('failed');
          notifyError(null, status.message || 'The payment was not completed.');
          return;
        }
      } catch {
        // Transient error — continue polling
      }
      delay = Math.min(delay * 1.5, 15000);
      if (!cancelled) setTimeout(poll, delay);
    };

    poll();

    return () => { cancelled = true; };
  }, [paymentStatus, paymentRef, queryClient]);

  // ── Unsaved changes warning ────────────────────────────

  const hasData = !!farmer || !!herd;
  useEffect(() => {
    if (!hasData || paymentStatus === 'completed') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasData, paymentStatus]);

  // ── Stepper ────────────────────────────────────────────

  const renderStepper = () => (
    <nav aria-label="Onboarding progress" className="mb-8 overflow-x-auto pb-4">
      <ol className="flex items-center min-w-[600px]">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center',
                index < STEPS.length - 1 && 'flex-1',
                index < STEPS.length - 1 && 'after:mx-2 after:h-0.5 after:flex-1 after:bg-border',
                isCompleted && 'after:bg-primary',
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-background text-primary animate-pulse ring-4 ring-primary/20',
                  !isCompleted && !isCurrent && 'border-muted-foreground/25 bg-background text-muted-foreground/50',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  'ml-2 hidden text-sm font-medium lg:inline',
                  isCurrent && 'text-foreground',
                  isCompleted && 'text-primary',
                  !isCompleted && !isCurrent && 'text-muted-foreground',
                )}
              >
                {step.title}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  // ══════════════════════════════════════════════════════
  // STEP RENDERERS
  // ══════════════════════════════════════════════════════

  // ── Step 0: Register Pastoralist ────────────────────────────

  const renderRegisterStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Register Pastoralist</CardTitle>
        <CardDescription>Enter the pastoralist&apos;s details to create their account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...farmerForm}>
          <form onSubmit={farmerForm.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={farmerForm.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Jane" autoComplete="off" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={farmerForm.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Mwangi" autoComplete="off" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={farmerForm.control} name="phoneNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="+254712345678" autoComplete="off" {...field} /></FormControl>
                <FormDescription>Include country code (e.g. +254)</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={farmerForm.control} name="nationalId" render={({ field }) => (
              <FormItem>
                <FormLabel>National ID <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="30000001" autoComplete="off" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={farmerForm.control} name="county" render={({ field }) => (
                <FormItem>
                  <FormLabel>County/Region <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Turkana" autoComplete="off" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={farmerForm.control} name="subCounty" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-County <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Turkana Central" autoComplete="off" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Register Pastoralist
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  // ── Step 1: KYC Verification ────────────────────────────

  const renderKycStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Verify Identity (KYC)</CardTitle>
        <CardDescription>Verify the pastoralist&apos;s physical identification documents</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {farmer && (
          <div className="rounded-lg bg-muted p-4">
            <h3 className="font-medium">Pastoralist Details</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{farmer.firstName} {farmer.lastName}</dd>
              <dt className="text-muted-foreground">ID Number</dt>
              <dd className="font-medium">{farmer.nationalId}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{farmer.phone}</dd>
              <dt className="text-muted-foreground">Location</dt>
              <dd className="font-medium">{farmer.county}</dd>
            </dl>
          </div>
        )}

        <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 text-warning">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-5 w-5" /> Physical Verification Required
          </div>
          <p className="mt-1 text-sm">
            By proceeding, you confirm that you have physically verified the pastoralist&apos;s original national ID card and that the details match.
          </p>
        </div>

        <div className="flex gap-4">
          <Button variant="outline" className="flex-1" onClick={() => setCurrentStep(0)}>Back</Button>
          <Button
            className="flex-1"
            onClick={() => { if (farmer) kycMutation.mutate(farmer.id); }}
            disabled={kycMutation.isPending || !farmer}
          >
            {kycMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Approve & Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ── Step 2: Register Herd ─────────────────────────────

  const renderHerdStep = () => {
    const headCount = herdForm.watch('headCount');
    const livestockType = herdForm.watch('livestockType');
    const estimatedValue = herdForm.watch('estimatedValue');
    
    const tlu = calculateTLU(livestockType, headCount);
    const totalValue = headCount * estimatedValue;

    // Countries available across the active units (for the multi-country filter).
    const countries = Array.from(
      new Set((insuranceUnits ?? []).map((u) => u.country).filter(Boolean)),
    ).sort();
    const visibleUnits = (insuranceUnits ?? []).filter(
      (u) => unitCountry === 'all' || u.country === unitCountry,
    );

    return (
      <Card>
        <CardHeader>
          <CardTitle>Register Herd</CardTitle>
          <CardDescription>Register the livestock to be insured</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...herdForm}>
            <form onSubmit={herdForm.handleSubmit((data) => createHerdMutation.mutate(data))} className="space-y-4">
              <FormField control={herdForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Herd Name/Identifier <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Main cattle herd" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {countries.length > 1 && (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select
                    value={unitCountry}
                    onValueChange={(v) => {
                      setUnitCountry(v);
                      // Clear the unit if it no longer matches the chosen country.
                      const current = insuranceUnits?.find((u) => u.id === herdForm.getValues('insuranceUnitId'));
                      if (current && v !== 'all' && current.country !== v) {
                        herdForm.setValue('insuranceUnitId', '');
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="All countries" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">All countries</SelectItem>
                      {countries.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Filter coverage regions by country.</FormDescription>
                </FormItem>
              )}

              <FormField control={herdForm.control} name="insuranceUnitId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Coverage Region (Insurance Unit) <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {visibleUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.county} {unit.subCounty ? ` - ${unit.subCounty}` : ''} ({unit.unitCode})
                        </SelectItem>
                      ))}
                      {!visibleUnits.length && (
                        <SelectItem value="none" disabled>No active insurance units found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>Livestock insurance covers forage failure in a specific county region.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={herdForm.control} name="livestockType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Livestock Type <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LIVESTOCK_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={herdForm.control} name="headCount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Animals <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={herdForm.control} name="estimatedValue" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Value (Per Head) in KES <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="number" min={100} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="rounded-lg bg-muted/50 p-4 border grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Calculated TLU</div>
                  <div className="text-2xl font-bold">{Number(tlu).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">Tropical Livestock Units</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Herd Value</div>
                  <div className="text-2xl font-bold">KES {totalValue.toLocaleString()}</div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createHerdMutation.isPending}>
                {createHerdMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Register Herd
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  };

  // ── Step 3: Get Quote ──────────────────────────────────

  const renderQuoteStep = () => {
    // Determine the current season dynamically
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const suggestedSeason = (currentMonth >= 3 && currentMonth <= 9) ? 'LRLD' : 'SRSD';

    return (
      <Card>
        <CardHeader>
          <CardTitle>Policy Quote</CardTitle>
          <CardDescription>Configure livestock IBLI coverage</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...quoteForm}>
            <form onSubmit={quoteForm.handleSubmit((data) => quoteMutation.mutate(data))} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={quoteForm.control} name="season" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insurance Season</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || suggestedSeason}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select season" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LRLD">LRLD (Long Rains Long Dry)</SelectItem>
                        <SelectItem value="SRSD">SRSD (Short Rains Short Dry)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Livestock policies cover a specific season.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={quoteForm.control} name="coverageType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coverage Peril</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select coverage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DROUGHT">Drought / Forage Failure (IBLI)</SelectItem>
                        <SelectItem value="COMPREHENSIVE">Comprehensive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {!quote ? (
                <Button type="submit" className="w-full" disabled={quoteMutation.isPending}>
                  {quoteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Calculate Premium
                </Button>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Premium Breakdown</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tropical Livestock Units (TLU)</span>
                          <span className="font-medium">{Number(quote.tluCount).toFixed(2)} TLU</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Premium Rate (per TLU)</span>
                          <span className="font-medium">KES {quote.premiumPerTLU.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Base Premium</span>
                          <span className="font-medium">KES {quote.premium.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Platform Fee</span>
                          <span className="font-medium">KES {quote.platformFee.toLocaleString()}</span>
                        </div>
                        <div className="my-2 h-px bg-border" />
                        <div className="flex justify-between text-base font-bold">
                          <span>Total Amount Due</span>
                          <span className="text-primary">KES {quote.totalCost.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" className="flex-1" onClick={() => setQuote(null)} type="button">
                      Recalculate
                    </Button>
                    <Button className="flex-1" onClick={() => setCurrentStep(4)} type="button">
                      Proceed to Purchase
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  };

  // ── Step 4: Purchase Policy ────────────────────────────

  const renderPurchaseStep = () => {
    if (!farmer || !herd || !quote) return null;
    
    const season = quoteForm.getValues('season');
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirm Purchase</CardTitle>
          <CardDescription>Review policy details before final purchase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Policyholder</h4>
              <p className="font-medium">{farmer.firstName} {farmer.lastName} ({farmer.phone})</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Herd</h4>
                <p className="font-medium">{herd.name}</p>
                <p className="text-sm">{herd.headCount} {herd.livestockType}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Coverage</h4>
                <p className="font-medium">IBLI {season}</p>
                <p className="text-sm">Unit: {quote.insuranceUnitCode}</p>
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => purchaseMutation.mutate()}
            disabled={purchaseMutation.isPending}
          >
            {purchaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Policy
          </Button>
        </CardContent>
      </Card>
    );
  };

  // ── Step 5: Payment ────────────────────────────────────

  const renderPaymentStep = () => {
    if (!policy) return null;

    if (paymentStatus === 'completed') {
      return (
        <Card className="border-success/50 bg-success/5">
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-success">
              <Check className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-success">Payment Successful!</h3>
              <p className="text-muted-foreground mt-2">
                Policy <span className="font-medium text-foreground">{policy.policyNumber}</span> is now active.
              </p>
            </div>
            <div className="mt-6 flex w-full gap-4">
              <Button variant="outline" className="flex-1" onClick={() => navigate('/org/policies')}>View Policies</Button>
              <Button className="flex-1" onClick={() => navigate(0)}>Onboard Another</Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>M-Pesa Payment</CardTitle>
          <CardDescription>Send an M-Pesa STK prompt to the pastoralist</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Amount to Pay</div>
              <div className="text-2xl font-bold">KES {policy.premium + policy.platformFee}</div>
            </div>
            <Smartphone className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>

          {paymentStatus === 'idle' || paymentStatus === 'failed' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">M-Pesa Phone Number</label>
                <Input 
                  value={paymentPhone} 
                  onChange={(e) => setPaymentPhone(e.target.value)} 
                  placeholder="+254700000000"
                />
                <p className="text-xs text-muted-foreground">The prompt will be sent to this number.</p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (paymentPhone) paymentMutation.mutate(paymentPhone);
                }}
                disabled={paymentMutation.isPending || !paymentPhone}
              >
                {paymentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {paymentStatus === 'failed' ? 'Retry Payment' : 'Send Payment Prompt'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div>
                <h3 className="font-medium">Waiting for Payment</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                  An M-Pesa prompt has been sent to the phone. Waiting for the pastoralist to enter their PIN...
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Livestock Onboarding</h1>
        <p className="text-muted-foreground">Register pastoralists, herds, and issue IBLI policies.</p>
      </div>

      {renderStepper()}

      <div className="mt-8">
        {currentStep === 0 && renderRegisterStep()}
        {currentStep === 1 && renderKycStep()}
        {currentStep === 2 && renderHerdStep()}
        {currentStep === 3 && renderQuoteStep()}
        {currentStep === 4 && renderPurchaseStep()}
        {currentStep === 5 && renderPaymentStep()}
      </div>
    </div>
  );
}
