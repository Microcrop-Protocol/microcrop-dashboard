import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, ShieldCheck, MapPin, Navigation, Map, Calculator,
  FileCheck, Smartphone, Loader2, Check, MapPinned, AlertTriangle, FileWarning,
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
import { isSimulatedTransaction } from '@/lib/simulated';
import { SimulatedBanner } from '@/components/ui/simulated-badge';
import type {
  Farmer, Plot, PolicyQuote, Policy, PaymentInstructions, GpsTrackResponse, CoverageType,
} from '@/types';
import {
  farmerRegistrationSchemaFor, plotCreationSchemaFor, policyConfigSchemaFor, defaultSumInsuredFor,
  type FarmerRegistrationData, type PlotCreationData, type PolicyConfigData,
} from '@/lib/validations/onboarding';
import { BoundaryWalkStep } from './BoundaryWalkStep';
import { BoundaryReviewMap } from './BoundaryReviewMap';
import { OnboardingStepper } from './OnboardingStepper';
import { SavedRecordNote } from './SavedRecordNote';
import { MissingPrerequisites } from './MissingPrerequisites';
import {
  fieldActionMissing, fieldStepDone, quoteInputsMatch, useSingleFlight, useStepProgress,
  type FieldStepState,
} from './step-access';
import { FarmerConsentPanel } from '@/components/farmers/FarmerConsentPanel';
import { useOrgMarket } from '@/hooks/useOrgMarket';
import {
  formatMoney as formatMarketMoney,
  phoneHint,
  withCurrencySuffix,
  type Market,
} from '@/lib/market';
import { marketSamples } from '@/lib/market-samples';
import { useCatalogue } from '@/hooks/useCatalogue';
import {
  findCatalogueItem, notSellableNote, notSellableReason, productLabel, soldUnderLabel,
} from '@/lib/catalogue';
import {
  CatalogueItemDetails, CatalogueSelectItems, CatalogueStatusBadge, CatalogueUnknownNote,
} from '@/components/catalogue/CatalogueOptions';

/**
 * Sums insured, premiums and fees in this wizard are LOCAL currency — what the farmer is quoted
 * and what mobile money collects. They are not USDC: the stablecoin leg is settlement plumbing
 * the field agent never sees.
 *
 * The currency COMES FROM THE ORGANIZATION'S MARKET. It used to be `const CURRENCY = 'KES'`,
 * justified on the grounds that Kenya was the only market the wizard was used in and the quote
 * endpoint returns no currency tag. The second half is still true — which is exactly why the
 * label has to be derived from the organization rather than guessed: nothing in the response
 * would contradict a wrong guess, so a Ghanaian field agent would be quoting GHS figures
 * labelled KES with nothing anywhere to catch it.
 *
 * `makeFormatMoney` returns the renderer bound to a market. It keeps the original defensive
 * shape: `undefined.toLocaleString()` throws, and a throw inside a step renderer is caught by
 * the app-level ErrorBoundary, which unmounts the wizard and loses every step of state the field
 * agent has collected. A dash is a far cheaper failure.
 */
function makeFormatMoney(market: Market | null) {
  return (value: number | string | null | undefined): string => {
    const amount = Number(value);
    if (value == null || !Number.isFinite(amount)) return market ? `${market.currency} —` : '—';
    return formatMarketMoney(amount, market);
  };
}

/**
 * Consent sits immediately after registration and before anything else is collected:
 * the plot walk, the GPS boundary and the KYC check all gather more personal data
 * about the same person, so the lawful basis for holding it belongs first. It is also
 * before Purchase, which is where the backend's (currently unwired) consent gate would
 * bite if it were ever switched on.
 */
const STEPS = [
  { id: 'register', title: 'Register', icon: UserPlus },
  { id: 'consent', title: 'Consent', icon: FileWarning },
  { id: 'kyc', title: 'Verify', icon: ShieldCheck },
  { id: 'plot', title: 'Plot', icon: MapPin },
  { id: 'walk', title: 'Boundary', icon: Navigation },
  { id: 'review', title: 'Review', icon: Map },
  { id: 'quote', title: 'Quote', icon: Calculator },
  { id: 'purchase', title: 'Purchase', icon: FileCheck },
  { id: 'payment', title: 'Payment', icon: Smartphone },
] as const;

type StepId = (typeof STEPS)[number]['id'];

/**
 * Steps are addressed by name, not by ordinal. Inserting the consent step shifted
 * every index in this file; the nine hand-written `setCurrentStep(4)`-style literals
 * that used to encode the order were one typo away from sending a field agent to the
 * wrong screen mid-onboarding.
 */
function stepIndex(id: StepId): number {
  return STEPS.findIndex((step) => step.id === id);
}

function stepTitle(id: StepId): string {
  return STEPS[stepIndex(id)]?.title ?? id;
}

function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

export function OnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Wizard state
  const {
    currentStep, visitedSteps, submitBlocked, setCurrentStep, showSubmitBlocked, clearSubmitBlocked,
  } = useStepProgress();
  // One request at a time from the click that starts it; every mutation releases on settle.
  const flight = useSingleFlight();
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [plot, setPlot] = useState<Plot | null>(null);
  const [boundaryResult, setBoundaryResult] = useState<GpsTrackResponse | null>(null);
  const [quote, setQuote] = useState<PolicyQuote | null>(null);
  // The coverage values `quote` was calculated from. Purchase sends these, not the live form.
  const [quotedValues, setQuotedValues] = useState<PolicyConfigData | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructions | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'polling' | 'completed' | 'failed'>('idle');
  const [paymentPhone, setPaymentPhone] = useState('');
  // `/payments/initiate` says so outright when the backend is in sandbox mode: NO STK push
  // was sent to the farmer's phone. Without surfacing it, this step tells the operator to
  // ask the farmer for a PIN on a prompt that will never arrive, and then reports the
  // policy "active" as if a premium had been paid.
  const [paymentSimulated, setPaymentSimulated] = useState(false);

  // Sync paymentPhone when farmer is registered
  useEffect(() => {
    if (farmer?.phoneNumber && !paymentPhone) {
      setPaymentPhone(farmer.phoneNumber);
    }
  }, [farmer, paymentPhone]);

  /**
   * The premium the farmer actually owes. The purchase response is authoritative
   * (it is the amount the backend wrote onto the policy); the quote is a fallback
   * for the window before the policy exists. Decimal fields arrive as strings, so
   * this is parsed rather than trusted to be a number.
   */
  const parsedAmountDue = Number(paymentInstructions?.amount ?? quote?.totalCost);
  const amountDue = Number.isFinite(parsedAmountDue) && parsedAmountDue > 0 ? parsedAmountDue : null;

  // The organization's market: its currency, its phone format, what its administrative divisions
  // are called, and what to call the mobile-money prompt.
  const { market, level1Label, level2Label, mobileMoneyLabel } = useOrgMarket();
  const formatMoney = makeFormatMoney(market);
  // Placeholder examples from the organization's own market; empty until it resolves.
  const samples = marketSamples(market);

  // The market's CROP line. The plot step offers every LISTED crop — the backend registers a plot
  // for a crop of any catalogue status — and labels the ones that cannot be insured yet, so a
  // field agent who picks one knows the quote step will not quote it.
  const catalogue = useCatalogue();
  const catalogueMarket = catalogue.market;
  const countryName = catalogueMarket?.countryName ?? market?.countryName ?? 'your market';

  // ── Forms ──────────────────────────────────────────────

  const farmerForm = useForm<FarmerRegistrationData>({
    // Market-driven: the phone is validated against THIS organization's market and the two
    // administrative-division messages use its own labels. See lib/validations/onboarding.
    resolver: zodResolver(farmerRegistrationSchemaFor(market)),
    defaultValues: {
      // Seeded from the market so a field agent is not handed a Kenyan dialling code to delete.
      // Empty while the market resolves, rather than wrong.
      phoneNumber: '',
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
    // `null` until the catalogue is known: the schema then accepts no crop rather than any.
    resolver: zodResolver(plotCreationSchemaFor(catalogue.state === 'known' ? catalogue.crops : null)),
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
    // Sum-insured bounds are the market's (a hint — the server enforces them at purchase).
    resolver: zodResolver(policyConfigSchemaFor(market)),
    defaultValues: {
      sumInsured: defaultSumInsuredFor(market),
      coverageType: 'DROUGHT',
      durationDays: 90,
    },
    mode: 'onChange',
  });

  // The market can resolve after the form mounts. Re-seed the opening sum insured into its
  // bounds then, but never over a value the agent has already typed.
  useEffect(() => {
    if (!market || quoteForm.formState.dirtyFields.sumInsured) return;
    const seeded = defaultSumInsuredFor(market);
    if (quoteForm.getValues('sumInsured') !== seeded) {
      quoteForm.setValue('sumInsured', seeded, { shouldValidate: true });
    }
  }, [market, quoteForm]);

  /**
   * The quote, while it still prices what the coverage form says. Editing the form after a
   * quote makes this null: the quote stops showing, and Purchase locks until it is recalculated.
   * Once the policy exists the form is closed, so the bought quote always stands.
   */
  const watchedQuoteValues = useWatch({ control: quoteForm.control });
  const currentQuote = quote && (policy != null || quoteInputsMatch(watchedQuoteValues, quotedValues))
    ? quote
    : null;

  /**
   * What each step's action reads. `fieldActionMissing(step, stepState)` is the one answer to
   * "can this be submitted?" — the submit handlers, the inline notices and the mutation
   * backstops below all ask it.
   */
  const stepState: FieldStepState = {
    farmer, plot, boundaryResult, quote: currentQuote, staleQuote: quote != null && currentQuote == null, policy,
  };
  const missingFor = (id: StepId) => fieldActionMissing(id, stepState);
  /** Backstop inside a mutation: never send a request whose prerequisites are missing. */
  const assertReady = (id: StepId) => {
    const missing = missingFor(id);
    if (missing.length) throw new Error(`${missing[0].label} first`);
  };

  // ── Mutations ──────────────────────────────────────────

  const registerMutation = useMutation({
    mutationFn: (data: FarmerRegistrationData) => {
      // The register step closes once a farmer exists; this is the backstop.
      if (farmer) throw new Error('This farmer is already registered');
      return api.registerFarmer(data);
    },
    onSuccess: (result) => {
      setFarmer(result);
      setCurrentStep(stepIndex('consent'));
      notifySuccess('Farmer registered', `${result.firstName} ${result.lastName} has been registered.`);
    },
    onError: (error) => {
      notifyError(error, "Couldn't register the farmer.");
    },
    onSettled: flight.release,
  });

  const kycMutation = useMutation({
    mutationFn: () => {
      assertReady('kyc');
      if (!farmer) throw new Error('No farmer registered');
      return api.fieldVerifyKyc(farmer.id);
    },
    onSuccess: () => {
      if (farmer) setFarmer({ ...farmer, kycStatus: 'APPROVED' });
      setCurrentStep(stepIndex('plot'));
      notifySuccess('Identity verified', 'KYC field verification completed successfully.');
    },
    onError: (error) => {
      notifyError(error, "Couldn't verify the farmer's identity.");
    },
    onSettled: flight.release,
  });

  const createPlotMutation = useMutation({
    mutationFn: (data: PlotCreationData) => {
      // The submit handler checks these first and says what is missing; this is the backstop.
      assertReady('plot');
      if (!farmer) throw new Error('No farmer registered');
      if (plot) throw new Error('This plot is already registered');
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
      setCurrentStep(stepIndex('walk'));
      notifySuccess('Plot created', `"${result.name}" has been registered.`);
    },
    onError: (error) => {
      notifyError(error, "Couldn't create the plot.");
    },
    onSettled: flight.release,
  });

  const quoteMutation = useMutation({
    mutationFn: (data: PolicyConfigData) => {
      assertReady('quote');
      if (!farmer || !plot) throw new Error('Missing farmer or plot data');
      return api.getPolicyQuote({
        farmerId: farmer.id,
        plotId: plot.id,
        sumInsured: data.sumInsured,
        coverageType: data.coverageType as CoverageType,
        durationDays: data.durationDays,
      });
    },
    onSuccess: (result, data) => {
      setQuote(result);
      setQuotedValues(data);
    },
    onError: (error) => {
      notifyError(error, "Couldn't get a premium quote.");
    },
    onSettled: flight.release,
  });

  const purchaseMutation = useMutation({
    mutationFn: () => {
      if (policy) throw new Error('This policy has already been purchased');
      assertReady('purchase');
      if (!farmer || !plot) throw new Error('Missing data');
      // Buy exactly what was quoted. A form edited since the quote leaves `currentQuote` null,
      // and the purchase click asks for a new quote; this is the backstop.
      const values = quotedValues;
      if (!currentQuote || !values) throw new Error('Get a premium quote for these values first');
      return api.purchasePolicy({
        farmerId: farmer.id,
        plotId: plot.id,
        sumInsured: values.sumInsured,
        coverageType: values.coverageType as CoverageType,
        durationDays: values.durationDays,
      });
    },
    onSuccess: (result) => {
      // /policies/purchase returns { policy, paymentInstructions } — keep both:
      // paymentInstructions.amount is the premium the STK push must charge.
      setPolicy(result.policy);
      setPaymentInstructions(result.paymentInstructions ?? null);
      setCurrentStep(stepIndex('payment'));
      notifySuccess('Policy created', `Policy ${result.policy.policyNumber} is ready for payment.`);
    },
    onError: (error) => {
      notifyError(error, "Couldn't create the policy.");
    },
    onSettled: flight.release,
  });

  const paymentMutation = useMutation({
    mutationFn: (phoneNumber: string) => {
      if (!policy) throw new Error('No policy created');
      if (amountDue == null) throw new Error('Premium amount unavailable — re-open the policy to collect payment');
      return api.initiatePayment({ policyId: policy.id, amount: amountDue, phoneNumber });
    },
    onSuccess: (result) => {
      setPaymentRef(result.reference);
      setPaymentStatus('polling');
      const simulated = isSimulatedTransaction(result);
      setPaymentSimulated(simulated);
      // Replay guard: the backend returned the EXISTING transaction and sent no
      // second STK prompt. Polling still applies — it is the same reference.
      if (simulated) {
        notifySuccess(
          'Test payment started',
          `No ${mobileMoneyLabel} prompt was sent and no money will be charged.`,
        );
      } else if (result.alreadyPending) {
        notifySuccess('Payment prompt already pending', result.instructions);
      } else {
        notifySuccess(
          'Payment request sent',
          `Check the farmer's phone for the ${mobileMoneyLabel} prompt.`,
        );
      }
    },
    onError: (error) => {
      notifyError(error, "Couldn't send the payment request.");
    },
    onSettled: flight.release,
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
          notifyError(
            null,
            `Payment confirmation timed out. Check the farmer's ${mobileMoneyLabel} messages.`,
          );
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
    // `mobileMoneyLabel` is in the deps because the timeout message names it. It is a stable
    // string derived from the organization's market, so including it does not restart the poll
    // in practice — but leaving it out would be a stale-closure bug the day the market resolves
    // mid-poll, which is exactly the window a slow first page load creates.
  }, [paymentStatus, paymentRef, queryClient, mobileMoneyLabel]);

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

  // The walk's save can resolve after the agent has moved on (TanStack runs a mutation's
  // onSuccess even once its component unmounts), so the handler reads the wizard's latest state
  // from a ref rather than the render that created it.
  const latestRef = useRef({ policy, currentStep });
  useEffect(() => {
    latestRef.current = { policy, currentStep };
  }, [policy, currentStep]);
  const [boundarySaving, setBoundarySaving] = useState(false);

  const handleBoundaryComplete = useCallback((result: GpsTrackResponse) => {
    const latest = latestRef.current;
    // A boundary saved after purchase must not replace the one the policy was bought on.
    if (latest.policy) return;
    setBoundaryResult(result);
    // A quote priced the plot as it was; a new boundary can move it, so the agent quotes again.
    setQuote(null);
    setQuotedValues(null);
    // Only move the agent on if they are still waiting on the walk.
    if (STEPS[latest.currentStep]?.id === 'walk') setCurrentStep(stepIndex('review'));
  }, [setCurrentStep]);

  // ── Stepper ────────────────────────────────────────────

  /**
   * Once the policy exists, nothing before it may be submitted again: a second POST would
   * register a second farmer, plot or policy. Those steps render their saved values read-only.
   * The same holds for any record already saved — the wizard has no edit path, so revisiting
   * the register or plot step shows the saved record instead of a form that would POST again.
   */
  const purchased = policy != null;
  const busy = registerMutation.isPending || kycMutation.isPending || createPlotMutation.isPending
    || boundarySaving || quoteMutation.isPending || purchaseMutation.isPending || paymentMutation.isPending;
  const doneState = { ...stepState, paymentCompleted: paymentStatus === 'completed' };
  const visited = (id: StepId) => visitedSteps.includes(stepIndex(id));

  /** In-step navigation. Like the stepper, it waits while a request is in flight. */
  const goTo = (id: StepId) => {
    if (!busy) setCurrentStep(stepIndex(id));
  };

  /**
   * Start a step's action only when nothing it needs is missing; otherwise make no request and
   * say what is missing instead. `start` runs at most once until its mutation settles.
   */
  const submitIfReady = (id: StepId, start: () => void) => {
    if (missingFor(id).length) {
      showSubmitBlocked();
      return;
    }
    clearSubmitBlocked();
    flight.run(start);
  };

  /**
   * The refusal shown on the current step after a submit with gaps. Read live, so each item
   * disappears as it is filled and the whole message goes once nothing is missing.
   */
  const renderSubmitBlocked = (id: StepId, action: string, fieldsIncomplete = false) => (
    submitBlocked && STEPS[currentStep]?.id === id ? (
      <MissingPrerequisites
        action={action}
        missing={missingFor(id)}
        fieldsIncomplete={fieldsIncomplete}
        stepTitle={stepTitle}
        onGoTo={goTo}
      />
    ) : null
  );

  /** Shown on arrival at a step that has nothing meaningful to show without earlier data. */
  const renderMissingNotice = (id: StepId, action: string) => (
    <MissingPrerequisites
      variant="notice"
      action={action}
      missing={missingFor(id)}
      stepTitle={stepTitle}
      onGoTo={goTo}
    />
  );

  const renderStepper = () => (
    <OnboardingStepper
      steps={STEPS}
      currentIndex={currentStep}
      busy={busy}
      isComplete={(id) => fieldStepDone(id, doneState, visited)}
      onSelect={setCurrentStep}
    />
  );

  // ══════════════════════════════════════════════════════
  // STEP RENDERERS
  // ══════════════════════════════════════════════════════

  // ── Step: Register Farmer ──────────────────────────────

  const renderRegisterStep = () => (farmer ? renderSavedFarmer() : renderRegisterForm());

  /** The register step once the farmer exists: re-submitting would register a second farmer. */
  const renderSavedFarmer = () => (
    <Card>
      <CardHeader>
        <CardTitle>Farmer Registered</CardTitle>
        <CardDescription>The details saved for this farmer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {farmer && (
          <dl className="grid gap-2 rounded-lg border p-4 text-sm sm:grid-cols-2">
            <div><dt className="inline text-muted-foreground">Name:</dt> <dd className="inline">{farmer.firstName} {farmer.lastName}</dd></div>
            <div><dt className="inline text-muted-foreground">Phone:</dt> <dd className="inline">{farmer.phoneNumber}</dd></div>
            <div><dt className="inline text-muted-foreground">National ID:</dt> <dd className="inline">{farmer.nationalId}</dd></div>
            <div><dt className="inline text-muted-foreground">{level1Label}:</dt> <dd className="inline">{farmer.county}</dd></div>
          </dl>
        )}
        <SavedRecordNote>
          This farmer is already registered, so the form is closed. Correct their details from the
          farmer&apos;s page — registering again here would create a second farmer.
        </SavedRecordNote>
        <Button className="w-full" onClick={() => goTo('consent')}>
          Continue
        </Button>
      </CardContent>
    </Card>
  );

  const renderRegisterForm = () => (
    <Card>
      <CardHeader>
        <CardTitle>Register Farmer</CardTitle>
        <CardDescription>Enter the farmer&apos;s details to create their account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...farmerForm}>
          <form
            onSubmit={farmerForm.handleSubmit(
              (data) => submitIfReady('register', () => registerMutation.mutate(data)),
              showSubmitBlocked,
            )}
            className="space-y-4"
          >
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
                  <FormControl><Input placeholder={samples?.lastName ?? ''} autoComplete="off" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={farmerForm.control} name="phoneNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input placeholder={market?.phoneExample ?? ''} autoComplete="off" {...field} />
                </FormControl>
                <FormDescription>{phoneHint(market)}</FormDescription>
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
                  <FormLabel>{level1Label} <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder={samples?.level1 ?? ''} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={farmerForm.control} name="subCounty" render={({ field }) => (
                <FormItem>
                  <FormLabel>{level2Label} <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder={samples?.level2 ?? ''} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={farmerForm.control} name="ward" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ward <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input placeholder={samples?.ward ?? ''} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={farmerForm.control} name="village" render={({ field }) => (
                <FormItem>
                  <FormLabel>Village <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input placeholder={samples?.village ?? ''} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {renderSubmitBlocked('register', 'register the farmer', hasErrors(farmerForm.formState.errors))}
            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Register Farmer
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  // ── Step: Consent ──────────────────────────────────────

  /**
   * The consent step DOES NOT BLOCK. Two reasons, both deliberate:
   *
   *  1. The backend reports `enforcedOnPurchase: false` — consent is recorded, not
   *     required, and a wizard that pretended otherwise would be lying about the
   *     product. The copy below says so instead of implying a gate.
   *  2. Every document in the registry is an unapproved placeholder, and the backend
   *     REFUSES to capture against a placeholder in production. Blocking here would
   *     make the whole wizard unusable in prod the day it shipped.
   *
   * When approved wording lands and `assertConsentForPolicy` is wired into
   * `policyService.purchase`, this is where the block belongs — gate Continue on the
   * status response's `hasValidConsent`, which already accounts for placeholder rows.
   */
  const renderConsentStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Record Consent</CardTitle>
        <CardDescription>
          Record what this farmer has agreed to, and how that agreement was captured
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {farmer ? (
          <FarmerConsentPanel farmerId={farmer.id} />
        ) : (
          renderMissingNotice('consent', 'record consent')
        )}

        <div className="space-y-2">
          <Button className="w-full" onClick={() => goTo('kyc')}>
            Continue
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Consent is not enforced on purchase, so onboarding continues either way.
            Whatever is recorded here stays on the farmer&apos;s record.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // ── Step: KYC Verification ─────────────────────────────

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
              <div><span className="text-muted-foreground">Phone:</span> {farmer.phoneNumber}</div>
              <div><span className="text-muted-foreground">National ID:</span> {farmer.nationalId}</div>
              <div><span className="text-muted-foreground">{level1Label}:</span> {farmer.county}</div>
            </div>
          </div>
        )}

        {farmer?.kycStatus === 'APPROVED' ? (
          <>
            <SavedRecordNote>This farmer&apos;s identity has been verified.</SavedRecordNote>
            <Button className="w-full" onClick={() => goTo('plot')}>
              Continue
            </Button>
          </>
        ) : (
          <>
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

            {renderSubmitBlocked('kyc', "verify the farmer's identity")}
            <Button
              onClick={() => submitIfReady('kyc', () => kycMutation.mutate())}
              className="w-full"
              disabled={kycMutation.isPending}
            >
              {kycMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              <ShieldCheck className="mr-2 h-4 w-4" />
              Confirm Identity Verification
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );

  // ── Step: Create Plot ──────────────────────────────────

  // The crop picked on the plot step, and — when it cannot be insured yet — the line that says so.
  const chosenCrop = findCatalogueItem(catalogueMarket, 'CROP', plotForm.watch('cropType'));
  const chosenCropNote = chosenCrop ? notSellableNote(chosenCrop, countryName, 'register') : null;

  const renderPlotStep = () => (plot ? renderSavedPlot() : renderPlotForm());

  /** The plot step once the plot exists: re-submitting would register a second plot. */
  const renderSavedPlot = () => (
    <Card>
      <CardHeader>
        <CardTitle>Plot Created</CardTitle>
        <CardDescription>The details saved for this plot</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {plot && (
          <dl className="grid gap-2 rounded-lg border p-4 text-sm sm:grid-cols-2">
            <div><dt className="inline text-muted-foreground">Name:</dt> <dd className="inline">{plot.name}</dd></div>
            <div><dt className="inline text-muted-foreground">Crop:</dt> <dd className="inline">{productLabel(catalogueMarket, 'CROP', plot.cropType)}</dd></div>
            <div><dt className="inline text-muted-foreground">Acreage:</dt> <dd className="inline">{plot.acreage}</dd></div>
            <div><dt className="inline text-muted-foreground">Location:</dt> <dd className="inline">{plot.latitude}, {plot.longitude}</dd></div>
          </dl>
        )}
        <SavedRecordNote>
          This plot is already registered, so the form is closed. Creating it again here would
          register a second plot.
        </SavedRecordNote>
        <Button
          className="w-full"
          onClick={() => goTo(boundaryResult ? 'review' : 'walk')}
        >
          Continue
        </Button>
      </CardContent>
    </Card>
  );

  const renderPlotForm = () => (
    <Card>
      <CardHeader>
        <CardTitle>Create Plot</CardTitle>
        <CardDescription>Register the farmer&apos;s plot details</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...plotForm}>
          <form
            onSubmit={plotForm.handleSubmit(
              (data) => submitIfReady('plot', () => createPlotMutation.mutate(data)),
              showSubmitBlocked,
            )}
            className="space-y-4"
          >
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
                        placeholder={samples?.latitude ?? ''}
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
                        placeholder={samples?.longitude ?? ''}
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
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={catalogue.state !== 'known'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={catalogue.state === 'loading' ? 'Loading crops…' : 'Select crop'}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <CatalogueSelectItems
                        items={catalogue.crops}
                        countryName={countryName}
                        emptyMessage={`No crops are offered in ${countryName}`}
                        purpose="register"
                      />
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {catalogue.state === 'unknown' && <CatalogueUnknownNote onRetry={catalogue.refetch} />}
            {chosenCropNote && (
              <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
                {chosenCropNote}. The plot can be registered, but no policy can be quoted on it yet.
              </p>
            )}
            <CatalogueItemDetails item={chosenCrop} countryName={countryName} />

            <FormField control={plotForm.control} name="plantingDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Planting Date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {renderSubmitBlocked('plot', 'create the plot', hasErrors(plotForm.formState.errors))}
            <Button type="submit" className="w-full" disabled={createPlotMutation.isPending}>
              {createPlotMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Create Plot
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  // ── Step: Review Boundary ──────────────────────────────

  const renderReviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle>Review Boundary</CardTitle>
        <CardDescription>Verify the plot boundary captured during the walk</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!boundaryResult && renderMissingNotice('review', 'review the boundary')}
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

            {purchased ? (
              <>
                <SavedRecordNote>
                  The policy has been purchased on this boundary, so it can no longer be re-walked here.
                </SavedRecordNote>
                <Button className="w-full" onClick={() => goTo('quote')}>
                  Continue
                </Button>
              </>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => goTo('walk')}>
                  Re-walk Boundary
                </Button>
                <Button className="flex-1" onClick={() => goTo('quote')}>
                  Confirm Boundary
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  // ── Step: Premium Quote ────────────────────────────────

  /**
   * Why this plot's crop cannot be quoted, or null. Reached for a coming-soon crop registered at
   * the plot step (which the backend allows), and when the catalogue changed since — said here,
   * before the quote request, instead of as a refused quote.
   */
  const plotCropReason = notSellableReason(catalogueMarket, 'CROP', plot?.cropType);
  const plotCropItem = findCatalogueItem(catalogueMarket, 'CROP', plot?.cropType);

  const renderQuoteStep = () => (purchased ? renderPurchasedQuote() : renderQuoteForm());

  /**
   * The quote step once the policy is bought. The form is closed: the purchase summary reads
   * these same form values, so editing them now would misstate what was bought.
   */
  const renderPurchasedQuote = () => {
    const values = quotedValues ?? quoteForm.getValues();
    return (
      <Card>
        <CardHeader>
          <CardTitle>Insurance Coverage</CardTitle>
          <CardDescription>The coverage the policy was purchased with</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Coverage</span><span>{values.coverageType} &middot; {values.durationDays} days</span></div>
            <div className="flex justify-between"><span>Sum Insured</span><span>{formatMoney(values.sumInsured)}</span></div>
            {quote && (
              <div className="flex justify-between border-t pt-2 font-bold">
                <span>Total</span>
                <span>{formatMoney(quote.totalCost)}</span>
              </div>
            )}
          </div>
          <SavedRecordNote>The policy has been purchased, so this quote can no longer be changed.</SavedRecordNote>
          <Button className="w-full" onClick={() => goTo('purchase')}>
            Continue
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderQuoteForm = () => (
    <Card>
      <CardHeader>
        <CardTitle>Insurance Coverage</CardTitle>
        <CardDescription>Configure the policy and get a premium quote</CardDescription>
      </CardHeader>
      <CardContent>
        {plotCropReason && (
          <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
            {plotCropReason}
          </div>
        )}
        <CatalogueItemDetails item={plotCropItem} countryName={countryName} className="mb-4" />
        <Form {...quoteForm}>
          <form
            onSubmit={quoteForm.handleSubmit(
              (data) => submitIfReady('quote', () => quoteMutation.mutate(data)),
              showSubmitBlocked,
            )}
            className="space-y-4"
          >
            <FormField control={quoteForm.control} name="sumInsured" render={({ field }) => (
              <FormItem>
                <FormLabel>{withCurrencySuffix('Sum Insured', market)} <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1000"
                    min={market?.minSumInsuredLocal}
                    max={market?.maxSumInsuredLocal}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                {market && (
                  <FormDescription>
                    Between {formatMoney(market.minSumInsuredLocal)} and {formatMoney(market.maxSumInsuredLocal)}
                  </FormDescription>
                )}
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

            {currentQuote && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Premium</span>
                  <span className="font-medium">{formatMoney(currentQuote.premium)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Platform Fee</span>
                  <span>{formatMoney(currentQuote.platformFee)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Total</span>
                  <span>{formatMoney(currentQuote.totalCost)}</span>
                </div>
                {currentQuote.riskScore != null && (
                  <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>Risk Score</span>
                    <span>{(currentQuote.riskScore * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}

            {renderSubmitBlocked('quote', 'get a quote', hasErrors(quoteForm.formState.errors))}
            <div className="flex gap-3">
              <Button type="submit" variant={currentQuote ? 'outline' : 'default'} disabled={quoteMutation.isPending || Boolean(plotCropReason)} className={currentQuote ? '' : 'w-full'}>
                {quoteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {currentQuote ? 'Recalculate' : 'Get Quote'}
              </Button>
              {currentQuote && !plotCropReason && (
                // type="button": inside the quote form, a default submit button would also send a
                // second quote request on its way to the purchase step.
                <Button type="button" className="flex-1" onClick={() => goTo('purchase')}>
                  Continue to Purchase
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  // ── Step: Purchase Policy ──────────────────────────────

  const renderPurchaseStep = () => {
    const quoteValues = quotedValues ?? quoteForm.getValues();
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
              {/* Rendered even with gaps: the summary shows what exists, and Purchase says what is missing. */}
              <p className="font-medium">{farmer ? `${farmer.firstName} ${farmer.lastName}` : '—'}</p>
              {farmer && (
                <p className="text-sm text-muted-foreground">{farmer.phoneNumber} &middot; {farmer.county}</p>
              )}
            </div>
            <div className="p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Plot</h4>
              <p className="font-medium">{plot?.name ?? '—'}</p>
              {plot && (
                <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                  {productLabel(catalogueMarket, 'CROP', plot.cropType)}
                  <CatalogueStatusBadge status={plotCropItem?.status} />
                  &middot; {plot.acreage} acres
                  {boundaryResult && ` \u00B7 ${Number(boundaryResult.plot.areaHectares).toFixed(2)} ha (measured)`}
                </p>
              )}
            </div>
            <div className="p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Coverage</h4>
              <p className="font-medium">{quoteValues.coverageType} &middot; {quoteValues.durationDays} days</p>
              <p className="text-sm text-muted-foreground">Sum Insured: {formatMoney(quoteValues.sumInsured)}</p>
            </div>
            {currentQuote && (
              <div className="p-4 bg-muted">
                <div className="flex justify-between font-bold">
                  <span>Total Cost</span>
                  <span>{formatMoney(currentQuote.totalCost)}</span>
                </div>
              </div>
            )}
          </div>

          {policy ? (
            <>
              <SavedRecordNote>
                Policy <span className="font-mono">{policy.policyNumber}</span> has been purchased.
                Purchasing again here would create a second policy.
              </SavedRecordNote>
              <Button className="w-full" onClick={() => goTo('payment')}>
                Continue to Payment
              </Button>
            </>
          ) : (
            <>
            {renderSubmitBlocked('purchase', 'purchase the policy')}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => goTo('quote')} disabled={purchaseMutation.isPending}>
                Back
              </Button>
              <Button className="flex-1" onClick={() => submitIfReady('purchase', () => purchaseMutation.mutate())} disabled={purchaseMutation.isPending || Boolean(plotCropReason)}>
                {purchaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Purchase Policy
              </Button>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Step: mobile-money payment ─────────────────────────

  const renderPaymentStep = () => {
    if (!policy) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{mobileMoneyLabel} payment</CardTitle>
            <CardDescription>Send a {mobileMoneyLabel} payment request to the farmer&apos;s phone</CardDescription>
          </CardHeader>
          <CardContent>{renderMissingNotice('payment', 'collect payment')}</CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>{mobileMoneyLabel} payment</CardTitle>
          <CardDescription>
            {paymentStatus === 'completed'
              ? 'Payment confirmed! The policy is now active.'
              : `Send a ${mobileMoneyLabel} payment request to the farmer's phone`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentSimulated && (
            <SimulatedBanner>
              This was a test payment. No {mobileMoneyLabel} prompt was sent to the farmer, no money was
              charged, and the policy it activates is test data — the farmer is not covered.
            </SimulatedBanner>
          )}
          {paymentStatus === 'idle' && (
            <>
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Policy</span>
                  <span className="font-mono">{policy?.policyNumber}</span>
                </div>
                {soldUnderLabel(policy?.catalogueStatus) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sold as</span>
                    <span>{soldUnderLabel(policy?.catalogueStatus)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Phone Number</span>
                  <Input 
                    value={paymentPhone} 
                    onChange={(e) => setPaymentPhone(e.target.value)} 
                    placeholder={market?.phoneExample ?? ''}
                    className="max-w-[200px]"
                  />
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Amount</span>
                  <span>{formatMoney(amountDue)}</span>
                </div>
              </div>
              {amountDue == null && (
                <p className="text-sm text-destructive">
                  The premium for this policy is unavailable, so no payment request can be
                  sent from here. Collect payment from the policy page instead.
                </p>
              )}
              <Button
                className="w-full"
                onClick={() => {
                  if (paymentPhone && amountDue != null) {
                    submitIfReady('payment', () => paymentMutation.mutate(paymentPhone));
                  }
                }}
                disabled={paymentMutation.isPending || !paymentPhone || amountDue == null}
              >
                {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                <Smartphone className="mr-2 h-4 w-4" />
                Send {mobileMoneyLabel} request
              </Button>
            </>
          )}

          {paymentStatus === 'polling' && (
            <div className="text-center py-8 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <div>
                <p className="font-medium">Waiting for payment confirmation...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {paymentSimulated
                    ? 'No prompt was sent to the farmer — there is nothing for them to confirm. Waiting for the test payment to settle.'
                    : `The farmer should see a ${mobileMoneyLabel} prompt on their phone. Ask them to enter their PIN to confirm.`}
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
                <p className="font-medium text-lg">
                  {paymentSimulated ? 'Test Run Complete' : 'Onboarding Complete!'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {paymentSimulated ? (
                    <>
                      {farmer?.firstName} {farmer?.lastName}&apos;s policy shows as active, but this
                      was a test: no premium was collected and they are NOT covered.
                    </>
                  ) : (
                    <>
                      {farmer?.firstName} {farmer?.lastName}&apos;s policy is now active.
                      They will receive an SMS confirmation shortly.
                    </>
                  )}
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
    // Switched on the step's id rather than its ordinal, so inserting or reordering a
    // step can never silently point a case at the wrong renderer.
    switch (STEPS[currentStep]?.id) {
      case 'register': return renderRegisterStep();
      case 'consent': return renderConsentStep();
      case 'kyc': return renderKycStep();
      case 'plot': return renderPlotStep();
      case 'walk': {
        if (purchased) return <Card><CardContent className="py-8 text-center text-muted-foreground">The policy has been purchased, so the boundary can no longer be re-walked here.</CardContent></Card>;
        if (!plot) {
          return (
            <Card>
              <CardHeader>
                <CardTitle>Walk the Boundary</CardTitle>
                <CardDescription>The walk is saved onto the plot, so the plot has to exist first</CardDescription>
              </CardHeader>
              <CardContent>{renderMissingNotice('walk', 'walk the boundary')}</CardContent>
            </Card>
          );
        }
        return (
          <BoundaryWalkStep plotId={plot.id} onComplete={handleBoundaryComplete} onSubmittingChange={setBoundarySaving} />
        );
      }
      case 'review': return renderReviewStep();
      case 'quote': return renderQuoteStep();
      case 'purchase': return renderPurchaseStep();
      case 'payment': return renderPaymentStep();
      default: return null;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Field Onboarding</h1>
      </div>
      {renderStepper()}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {renderStepContent()}
      </div>
    </div>
  );
}
