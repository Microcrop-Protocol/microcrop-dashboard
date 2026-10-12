/**
 * Create account — self-service organization signup.
 *
 * SHAPE. The design's sign-up screen mirrors sign-in: one email field and a Continue
 * button. Signup here needs rather more than an email — organization name, registration
 * number, type, the admin's name and a password — so the email is step one, exactly as the
 * design shows, and the remaining details follow on step two. One POST, unchanged.
 *
 * WHAT THIS DOES NOT DO. It does not collect KYB documents, and it must not start. KYB is
 * post-signup by design: auth.service registerOrganization sets kybStatus=NOT_STARTED and
 * onboardingStep=KYB_VERIFICATION, and the organization stays gated until a platform admin
 * verifies it from the dashboard. This page's job ends at creating the account and handing
 * the user to Settings -> Verification.
 *
 * The field set and its validation live in lib/validations/kyb.ts (orgSignupSchema) and are
 * untouched here — this change is the surface, not the contract.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { notifySuccess, notifyError } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { orgSignupSchemaFor, type OrgSignupFormData } from '@/lib/validations/kyb';
import {
  countryOptions,
  level1Label,
  marketOrNull,
  normalizePhoneForMarket,
  phoneHint,
} from '@/lib/market';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { AuthField, AuthPrimaryButton, AuthAltAction, OrDivider } from '@/components/auth/AuthFormParts';
import {
  authInlineLinkClass,
  authInputClass,
  authLabelClass,
  authQuietLinkClass,
} from '@/components/auth/auth-styles';


export default function RegisterOrganizationPage() {
  const [step, setStep] = useState<'email' | 'details'>('email');
  // See the note in LoginPage: the activated control is unmounted by the step change, so
  // each step claims focus on mount — other than the first paint.
  const [autoFocusEmail, setAutoFocusEmail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<OrgSignupFormData>({
    /*
      The schema is a FUNCTION of the chosen country, so the optional phone is validated against
      that market's format. A static schema could only accept "any supported market", which
      would let a Kenyan organization store a Ghanaian number — the exact mismatch the backend's
      service layer refuses after the fact.

      It reads the country off the VALUES the resolver is handed rather than off `watch`:
      referencing `watch` here would be referencing the useForm return value inside its own
      initializer. This way the schema is also always built from the values being validated,
      with no stale-closure window after the country changes.
    */
    resolver: (values, context, options) =>
      zodResolver(orgSignupSchemaFor((values as OrgSignupFormData).countryCode))(
        values,
        context,
        options,
      ),
  });
  const countryCode = watch('countryCode');
  const market = marketOrNull(countryCode);

  const goToDetailsStep = async () => {
    const ok = await trigger('email');
    if (ok) setStep('details');
  };

  const onSubmit = async (data: OrgSignupFormData) => {
    setIsLoading(true);
    try {
      const { user, tokens } = await api.registerOrganization({
        organizationName: data.organizationName,
        // The one field with irreversible downstream consequence: it picks the currency, the
        // premium bounds, the payment provider and the KYB document set.
        countryCode: data.countryCode,
        county: data.county || undefined,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        // Normalised against the CHOSEN market, so a Ghanaian admin's 024... becomes +23324...
        // rather than being prefixed +254 by a hardcoded Kenyan normaliser.
        phone: normalizePhoneForMarket(data.phone, marketOrNull(data.countryCode)),
      });
      login(user, tokens);
      notifySuccess(
        'Welcome to MicroCrop',
        'Your account is ready. Complete verification in Settings to start underwriting.',
      );
      navigate('/org/settings/verification', { replace: true });
    } catch (error) {
      notifyError(error, "Couldn't create your account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      heading="Create account"
      subtitle={
        step === 'email'
          ? 'Get started with MicroCrop. Verification comes later, from your dashboard.'
          : 'A few details about your organization and the first admin user.'
      }
      wide={step === 'details'}
    >
      <form
        noValidate
        onSubmit={
          step === 'email'
            ? (event) => {
                event.preventDefault();
                void goToDetailsStep();
              }
            : handleSubmit(onSubmit)
        }
      >
        {/* Keyed so the step change remounts the subtree and `autoFocus` actually fires —
            see the longer note on the same lines in LoginPage. */}
        {step === 'email' ? (
          <div key="step-email" className="space-y-5">
            <GoogleAuthButton label="Sign up with Google" />
            <OrDivider />
            <AuthField
              id="email"
              label="Email address"
              type="email"
              inputMode="email"
              placeholder="hello@app.com"
              autoComplete="email"
              autoFocus={autoFocusEmail}
              spellCheck={false}
              error={errors.email?.message}
              {...register('email')}
            />
            <AuthPrimaryButton type="submit">Continue</AuthPrimaryButton>
          </div>
        ) : (
          <div key="step-details" className="space-y-5">
            <input
              type="text"
              value={getValues('email') ?? ''}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="username"
              className="sr-only"
            />

            {/*
              Section headings are h2 so the document outline reads h1 "Create account" →
              h2 "Organization" → h2 "Your account". They replace the two Cards the old page
              used; the design calls for no card borders on this panel.
            */}
            <section className="space-y-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#8a8d95]">
                Organization
              </h2>

              <AuthField
                id="organizationName"
                label="Organization name"
                placeholder="Acme Cooperative"
                autoFocus
                error={errors.organizationName?.message}
                {...register('organizationName')}
              />

              <div>
                {/*
                  Radix Select renders a button, not a <select>, so htmlFor cannot bind to it.
                  Label + SelectTrigger share an id/aria-labelledby pair instead, which is the
                  association Radix documents.

                  NO DEFAULT VALUE, on purpose. The backend defaults a missing countryCode to KE
                  for backward compatibility, and relying on that is how every self-signup
                  organization silently became Kenyan. A pre-selected "Kenya" would reproduce the
                  same wrong data while making it look like the partner chose it.
                */}
                <Label htmlFor="countryCode" id="countryCode-label" className={authLabelClass}>
                  Country of operation
                </Label>
                <Select
                  // `?? ''` keeps it controlled from first paint: RHF has no default here, so a
                  // bare value is undefined on mount and Radix logs "changing from uncontrolled
                  // to controlled" the moment a country is picked. The empty string matches no
                  // SelectItem, so the placeholder shows and the form state stays undefined —
                  // which is what the schema's required_error message depends on.
                  value={countryCode ?? ''}
                  onValueChange={(v) =>
                    setValue('countryCode', v as OrgSignupFormData['countryCode'], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger
                    id="countryCode"
                    aria-labelledby="countryCode-label countryCode"
                    aria-invalid={errors.countryCode ? true : undefined}
                    aria-describedby={
                      errors.countryCode ? 'countryCode-error' : 'countryCode-hint'
                    }
                    className={cn(authInputClass, 'justify-between text-left')}
                  >
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.countryCode ? (
                  <p id="countryCode-error" role="alert" className="mt-1.5 text-xs text-[#f0646f]">
                    {errors.countryCode.message}
                  </p>
                ) : (
                  <p id="countryCode-hint" className="mt-1.5 text-xs text-[#8a8d95]">
                    {market
                      ? `Sets your currency (${market.currency}), how premiums are collected (${market.mobileMoneyLabel}) and which regulator's licence your verification needs (${market.regulator}).`
                      : 'Sets your currency, how premiums are collected and which documents your verification needs.'}
                  </p>
                )}
              </div>

              <AuthField
                id="county"
                // The column is `county`; what it is CALLED is per-market (Kenya: County,
                // Ghana: Region). Before a country is chosen there is no market, so the label
                // falls back to the default market's — a label is the one place guessing is
                // acceptable, and the field is optional.
                label={level1Label(market)}
                hint="Optional."
                error={errors.county?.message}
                {...register('county')}
              />

              <p className="text-xs text-[#8a8d95]">
                Your company registration number, documents and regulator licence are collected
                after you sign up, in Settings &rarr; Verification.
              </p>
            </section>

            <section className="space-y-5 pt-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#8a8d95]">
                Your account
              </h2>

              <p className="text-sm text-[#8a8d95]">
                Signing up as <span className="font-medium text-white">{getValues('email')}</span>
              </p>

              <div className="grid gap-5 sm:grid-cols-2">
                <AuthField
                  id="firstName"
                  label="First name"
                  autoComplete="given-name"
                  error={errors.firstName?.message}
                  {...register('firstName')}
                />
                <AuthField
                  id="lastName"
                  label="Last name"
                  autoComplete="family-name"
                  error={errors.lastName?.message}
                  {...register('lastName')}
                />
              </div>

              <AuthField
                id="phone"
                label="Phone"
                type="tel"
                inputMode="tel"
                // Market-driven, so a Ghanaian admin is not shown a Kenyan number to copy.
                placeholder={market?.phoneLocalExample ?? ''}
                autoComplete="tel"
                hint={market ? `Optional. ${phoneHint(market)}` : 'Optional.'}
                error={errors.phone?.message}
                {...register('phone')}
              />

              <AuthField
                id="password"
                label="Password"
                type="password"
                autoComplete="new-password"
                hint="At least 8 characters, with an uppercase letter, a number and a special character."
                error={errors.password?.message}
                {...register('password')}
              />

              <AuthField
                id="confirmPassword"
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
            </section>

            <AuthPrimaryButton type="submit" loading={isLoading}>
              Create account
            </AuthPrimaryButton>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep('email');
                setAutoFocusEmail(true);
              }}
              className={`h-auto w-full justify-center p-0 text-[13px] font-normal hover:bg-transparent ${authQuietLinkClass}`}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Use a different email
            </Button>
          </div>
        )}
      </form>

      <AuthAltAction>
        Already have an account?{' '}
        <Link to="/login" className={authInlineLinkClass}>
          Sign in
        </Link>
      </AuthAltAction>
    </AuthLayout>
  );
}
