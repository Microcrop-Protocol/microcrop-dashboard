import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, ShieldCheck, MapPin, Navigation, Map, Calculator,
  FileCheck, Smartphone, Loader2, Check, MapPinned, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { notifySuccess, notifyError } from '@/lib/notify';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Farmer, Plot, PolicyQuote, Policy, GpsTrackResponse, CoverageType } from '@/types';
import {
  createFarmerRegistrationSchema, plotCreationSchema, policyConfigSchema,
  CROP_TYPES,
  type FarmerRegistrationData, type PlotCreationData, type PolicyConfigData,
} from '@/lib/validations/onboarding';
import { useMarket, dialCodeFor, normalizePhone } from '@/lib/market';
import { BoundaryWalkStep } from './BoundaryWalkStep';
import { BoundaryReviewMap } from './BoundaryReviewMap';

const STEPS = [
  { id: 'register', title: 'Register', icon: UserPlus },
  { id: 'kyc', title: 'Verify', icon: ShieldCheck },
  { id: 'plot', title: 'Plot', icon: MapPin },
  { id: 'walk', title: 'Boundary', icon: Navigation },
  { id: 'review', title: 'Review', icon: Map },
  { id: 'quote', title: 'Quote', icon: Calculator },
  { id: 'purchase', title: 'Purchase', icon: FileCheck },
  { id: 'payment', title: 'Payment', icon: Smartphone },
] as const;

export function OnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { market } = useMarket();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [plot, setPlot] = useState<Plot | null>(null);
  const [boundaryResult, setBoundaryResult] = useState<GpsTrackResponse | null>(null);
  const [quote, setQuote] = useState<PolicyQuote | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'polling' | 'completed' | 'failed'>('idle');
  const [paymentPhone, setPaymentPhone] = useState('');

  // Sync paymentPhone when farmer is registered
  useEffect(() => {
    if (farmer?.phone && !paymentPhone) {
      setPaymentPhone(farmer.phone);
    }
  }, [farmer, paymentPhone]);

  // ── Forms ──────────────────────────────────────────────

  const farmerSchema = useMemo(() => createFarmerRegistrationSchema(market), [market]);
  const farmerForm = useForm<FarmerRegistrationData>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      phoneNumber: dialCodeFor(market),
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

  const plotForm = useForm<PlotCreationData>({
    resolver: zodResolver(plotCreationSchema),
    defaultValues: {
      name: '',
      latitude: 0,
      longitude: 0,
      acreage: 0,
      cropType: undefined as unknown as PlotCreationData['cropType'],
      plantingDate: '',
    },
    mode: 'onChange',
  });

  const quoteForm = useForm<PolicyConfigData>({
    resolver: zodResolver(policyConfigSchema),
    defaultValues: {
      sumInsured: 10000,
      coverageType: 'DROUGHT',
      durationDays: 90,
    },
    mode: 'onChange',
  });

  // ── Mutations ──────────────────────────────────────────

  const registerMutation = useMutation({
    mutationFn: (data: FarmerRegistrationData) =>
      api.registerFarmer({ ...data, phoneNumber: normalizePhone(data.phoneNumber, market) }),
    onSuccess: (result) => {
      setFarmer(result);
      setCurrentStep(1);
      notifySuccess('Farmer registered', `${result.firstName} ${result.lastName} has been registered.`);
    },
    onError: (error) => {
      notifyError(error, "Couldn't register the farmer.");
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
      notifyError(error, "Couldn't verify the farmer's identity.");
    },
  });

  const createPlotMutation = useMutation({
    mutationFn: (data: PlotCreationData) => {
      if (!farmer) throw new Error('No farmer registered');
      return api.createPlot(farmer.id, {
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        acreage: data.acreage,
        cropType: data.cropType,
        plantingDate: data.plantingDate || undefined,
      });
    },
    onSuccess: (result) => {
      setPlot(result);
      setCurrentStep(3);
      notifySuccess('Plot created', `"${result.name}" has been registered.`);
    },
    onError: (error) => {
      notifyError(error, "Couldn't create the plot.");
    },
  });

  const quoteMutation = useMutation({
    mutationFn: (data: PolicyConfigData) => {
      if (!farmer || !plot) throw new Error('Missing farmer or plot data');
      return api.getPolicyQuote({
        farmerId: farmer.id,
        plotId: plot.id,
        sumInsured: data.sumInsured,
        coverageType: data.coverageType as CoverageType,
        durationDays: data.durationDays,
      });
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
      if (!farmer || !plot) throw new Error('Missing data');
      const values = quoteForm.getValues();
      return api.purchasePolicy({
        farmerId: farmer.id,
        plotId: plot.id,
        sumInsured: values.sumInsured,
        coverageType: values.coverageType as CoverageType,
        durationDays: values.durationDays,
      });
    },
    onSuccess: (result) => {
      setPolicy(result);
      setCurrentStep(7);
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
      notifySuccess('Payment request sent', `Check the farmer's phone for the ${market.mobileMoney} prompt.`);
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
          notifyError(null, `Payment confirmation timed out. Check the farmer's ${market.mobileMoney} messages.`);
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
          queryClient.invalidateQueries({ queryKey: ['plots'] });
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

  const hasData = !!farmer || !!plot;
  useEffect(() => {
    if (!hasData || paymentStatus === 'completed') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasData, paymentStatus]);

  // ── Helpers ────────────────────────────────────────────

  const fillCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      notifyError(null, 'Your browser does not support geolocation.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        plotForm.setValue('latitude', Number(pos.coords.latitude.toFixed(6)), { shouldValidate: true });
        plotForm.setValue('longitude', Number(pos.coords.longitude.toFixed(6)), { shouldValidate: true });
        notifySuccess('Location captured', 'GPS coordinates have been set.');
      },
      (err) => {
        notifyError(err, "Couldn't get your current location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [plotForm]);

  const handleBoundaryComplete = useCallback((result: GpsTrackResponse) => {
    setBoundaryResult(result);
    setCurrentStep(4);
  }, []);

  // ── Stepper ────────────────────────────────────────────

  const renderStepper = () => (
    <nav aria-label="Onboarding progress" className="mb-8">
      <ol className="flex items-center">
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

  // ── Step 0: Register Farmer ────────────────────────────

  const renderRegisterStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Register Farmer</CardTitle>
        <CardDescription>Enter the farmer&apos;s details to create their account</CardDescription>
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
                <FormControl><Input placeholder={`${dialCodeFor(market)}712345678`} autoComplete="off" {...field} /></FormControl>
                <FormDescription>Phone number in {dialCodeFor(market)} format</FormDescription>
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
                  <FormLabel>County <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Kiambu" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={farmerForm.control} name="subCounty" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-County <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Kikuyu" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={farmerForm.control} name="ward" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ward <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="Kinoo" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={farmerForm.control} name="village" render={({ field }) => (
                <FormItem>
                  <FormLabel>Village <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="Kinoo Village" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Register Farmer
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  // ── Step 1: KYC Verification ───────────────────────────

  const renderKycStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Verify Identity</CardTitle>
        <CardDescription>Confirm the farmer&apos;s identity through field verification</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {farmer && (
          <div className="rounded-lg border p-4">
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">Name:</span> {farmer.firstName} {farmer.lastName}</div>
              <div><span className="text-muted-foreground">Phone:</span> {farmer.phone}</div>
              <div><span className="text-muted-foreground">National ID:</span> {farmer.nationalId}</div>
              <div><span className="text-muted-foreground">County:</span> {farmer.county}</div>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">Field Verification Required</p>
              <p className="text-amber-700 dark:text-amber-300 mt-1">
                Confirm the farmer is physically present and their identity documents match the registered details.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => farmer && kycMutation.mutate(farmer.id)}
          className="w-full"
          disabled={kycMutation.isPending || !farmer}
        >
          {kycMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          <ShieldCheck className="mr-2 h-4 w-4" />
          Confirm Identity Verification
        </Button>
      </CardContent>
    </Card>
  );

  // ── Step 2: Create Plot ────────────────────────────────

  const renderPlotStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Create Plot</CardTitle>
        <CardDescription>Register the farmer&apos;s plot details</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...plotForm}>
          <form onSubmit={plotForm.handleSubmit((data) => createPlotMutation.mutate(data))} className="space-y-4">
            <FormField control={plotForm.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Plot Name <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="North Field" autoComplete="off" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Location</span>
                <Button type="button" variant="outline" size="sm" onClick={fillCurrentLocation}>
                  <MapPinned className="mr-1.5 h-3.5 w-3.5" />
                  Use Current Location
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={plotForm.control} name="latitude" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="-1.286389"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={plotForm.control} name="longitude" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="36.817223"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={plotForm.control} name="acreage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Acreage <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="2.5"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={plotForm.control} name="cropType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Crop Type <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select crop" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CROP_TYPES.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={plotForm.control} name="plantingDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Planting Date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Button type="submit" className="w-full" disabled={createPlotMutation.isPending}>
              {createPlotMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Create Plot
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  // ── Step 4: Review Boundary ────────────────────────────

  const renderReviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Review Boundary</CardTitle>
        <CardDescription>Verify the plot boundary captured during the walk</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {boundaryResult && (
          <>
            <div className="rounded-lg overflow-hidden border" style={{ height: '400px' }}>
              <BoundaryReviewMap
                boundary={boundaryResult.plot.boundary}
                centroidLat={boundaryResult.plot.centroidLat}
                centroidLon={boundaryResult.plot.centroidLon}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{Number(boundaryResult.plot.areaHectares).toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Hectares</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{boundaryResult.metadata.finalVertices}</div>
                <div className="text-sm text-muted-foreground">Vertices</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{Number(boundaryResult.metadata.avgAccuracy).toFixed(1)}m</div>
                <div className="text-sm text-muted-foreground">Avg Accuracy</div>
              </div>
            </div>

            {boundaryResult.metadata.pointsFilteredOut > 0 && (
              <p className="text-sm text-muted-foreground">
                {boundaryResult.metadata.pointsFilteredOut} low-accuracy points filtered out
                of {boundaryResult.metadata.totalPointsReceived} total.
              </p>
            )}

            {boundaryResult.overlapWarning && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                <div className="flex gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{boundaryResult.overlapWarning}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setBoundaryResult(null); setCurrentStep(3); }}>
                Re-walk Boundary
              </Button>
              <Button className="flex-1" onClick={() => setCurrentStep(5)}>
                Confirm Boundary
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  // ── Step 5: Premium Quote ──────────────────────────────

  const renderQuoteStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Insurance Coverage</CardTitle>
        <CardDescription>Configure the policy and get a premium quote</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...quoteForm}>
          <form
            onSubmit={quoteForm.handleSubmit((data) => quoteMutation.mutate(data))}
            className="space-y-4"
          >
            <FormField control={quoteForm.control} name="sumInsured" render={({ field }) => (
              <FormItem>
                <FormLabel>Sum Insured (USDC) <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1000"
                    min="1000"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormDescription>Minimum 1,000 USDC</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={quoteForm.control} name="coverageType" render={({ field }) => (
              <FormItem>
                <FormLabel>Coverage Type <span className="text-destructive">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="DROUGHT">Drought</SelectItem>
                    <SelectItem value="FLOOD">Flood</SelectItem>
                    <SelectItem value="BOTH">Both (Drought &amp; Flood)</SelectItem>
                    <SelectItem value="COMPREHENSIVE">Comprehensive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={quoteForm.control} name="durationDays" render={({ field }) => (
              <FormItem>
                <FormLabel>Duration: {field.value} days <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Slider
                    value={[field.value]}
                    onValueChange={(v) => field.onChange(v[0])}
                    min={30}
                    max={365}
                    step={15}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {quote && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Premium</span>
                  <span className="font-medium">{quote.premium.toLocaleString()} USDC</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Platform Fee</span>
                  <span>{quote.platformFee.toLocaleString()} USDC</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Total</span>
                  <span>{quote.totalCost.toLocaleString()} USDC</span>
                </div>
                {quote.riskScore != null && (
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>Risk Score</span>
                    <span>{(quote.riskScore * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" variant={quote ? 'outline' : 'default'} disabled={quoteMutation.isPending} className={quote ? '' : 'w-full'}>
                {quoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {quote ? 'Recalculate' : 'Get Quote'}
              </Button>
              {quote && (
                <Button className="flex-1" onClick={() => setCurrentStep(6)}>
                  Continue to Purchase
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  // ── Step 6: Purchase Policy ────────────────────────────

  const renderPurchaseStep = () => {
    const quoteValues = quoteForm.getValues();
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirm Purchase</CardTitle>
          <CardDescription>Review all details before creating the policy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border divide-y">
            <div className="p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Farmer</h4>
              <p className="font-medium">{farmer?.firstName} {farmer?.lastName}</p>
              <p className="text-sm text-muted-foreground">{farmer?.phone} &middot; {farmer?.county}</p>
            </div>
            <div className="p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Plot</h4>
              <p className="font-medium">{plot?.name}</p>
              <p className="text-sm text-muted-foreground">
                {plot?.cropType} &middot; {plot?.acreage} acres
                {boundaryResult && ` \u00B7 ${Number(boundaryResult.plot.areaHectares).toFixed(2)} ha (measured)`}
              </p>
            </div>
            <div className="p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Coverage</h4>
              <p className="font-medium">{quoteValues.coverageType} &middot; {quoteValues.durationDays} days</p>
              <p className="text-sm text-muted-foreground">Sum Insured: {quoteValues.sumInsured.toLocaleString()} USDC</p>
            </div>
            {quote && (
              <div className="p-4 bg-muted">
                <div className="flex justify-between font-bold">
                  <span>Total Cost</span>
                  <span>{quote.totalCost.toLocaleString()} USDC</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(5)} disabled={purchaseMutation.isPending}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => purchaseMutation.mutate()} disabled={purchaseMutation.isPending}>
              {purchaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Purchase Policy
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── Step 7: M-Pesa Payment ─────────────────────────────

  const renderPaymentStep = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{market.mobileMoney} Payment</CardTitle>
          <CardDescription>
            {paymentStatus === 'completed'
              ? 'Payment confirmed! The policy is now active.'
              : `Send a ${market.mobileMoney} payment request to the farmer's phone`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentStatus === 'idle' && (
            <>
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Policy</span>
                  <span className="font-mono">{policy?.policyNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Phone Number</span>
                  <Input
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                    placeholder={`${dialCodeFor(market)}700000000`}
                    className="max-w-[200px]"
                  />
                </div>
                {quote && (
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Amount</span>
                    <span>{quote.totalCost.toLocaleString()} USDC</span>
                  </div>
                )}
              </div>
              <Button
                className="w-full"
                onClick={() => { if (paymentPhone) paymentMutation.mutate(paymentPhone); }}
                disabled={paymentMutation.isPending || !paymentPhone}
              >
                {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                <Smartphone className="mr-2 h-4 w-4" />
                Send {market.mobileMoney} Request
              </Button>
            </>
          )}

          {paymentStatus === 'polling' && (
            <div className="text-center py-8 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <div>
                <p className="font-medium">Waiting for payment confirmation...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The farmer should see a {market.mobileMoney} prompt on their phone. Ask them to enter their PIN to confirm.
                </p>
              </div>
            </div>
          )}

          {paymentStatus === 'completed' && (
            <div className="text-center py-8 space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-lg">Onboarding Complete!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {farmer?.firstName} {farmer?.lastName}&apos;s policy is now active.
                  They will receive an SMS confirmation shortly.
                </p>
              </div>
              <div className="flex gap-3 justify-center pt-4">
                <Button variant="outline" onClick={() => navigate('/org/farmers')}>
                  View Farmers
                </Button>
                <Button onClick={() => navigate(`/org/farmers/${farmer?.id}`)}>
                  View Farmer Details
                </Button>
              </div>
            </div>
          )}

          {paymentStatus === 'failed' && (
            <div className="text-center py-8 space-y-4">
              <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <p className="font-medium">Payment Failed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The payment could not be completed. You can retry or complete payment later from the policy page.
                </p>
              </div>
              <div className="flex gap-3 justify-center pt-4">
                <Button variant="outline" onClick={() => navigate(`/org/policies/${policy?.id}`)}>
                  View Policy
                </Button>
                <Button onClick={() => { setPaymentStatus('idle'); setPaymentRef(null); }}>
                  Retry Payment
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderRegisterStep();
      case 1: return renderKycStep();
      case 2: return renderPlotStep();
      case 3: {
        if (!plot) return <Card><CardContent className="py-8 text-center text-muted-foreground">Plot data missing. Please go back and create a plot first.</CardContent></Card>;
        return <BoundaryWalkStep plotId={plot.id} onComplete={handleBoundaryComplete} />;
      }
      case 4: return renderReviewStep();
      case 5: return renderQuoteStep();
      case 6: return renderPurchaseStep();
      case 7: return renderPaymentStep();
      default: return null;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Field Onboarding</h1>
        <p className="text-muted-foreground" role="status" aria-live="polite">
          Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
        </p>
      </div>
      {renderStepper()}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {renderStepContent()}
      </div>
    </div>
  );
}
