/**
 * Sign in.
 *
 * WHY THIS IS TWO STEPS. The design is an email-first screen: one "Email address" field and
 * a "Continue" button, with no password in sight. The backend is unchanged and still wants
 * email+password in a single POST /auth/login, so the password is collected on a second
 * step and both are submitted together. This is a UI change only — no new endpoint, no new
 * token handling, no change to what is sent.
 *
 * Step one deliberately does NOT ask the backend whether the address exists. A "no account
 * with that email" response here would turn the sign-in page into an account-enumeration
 * oracle for a product whose customer list is its commercial position. Continue therefore
 * only checks that the address is well-formed, and a wrong email fails at the same place a
 * wrong password does, with the same message.
 */
import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { notifySuccess, notifyError } from '@/lib/notify';
import { isRoleAllowedOnSubdomain, getCorrectSubdomain, getSubdomainContext } from '@/lib/subdomain';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { AuthField, AuthPrimaryButton, AuthAltAction, OrDivider } from '@/components/auth/AuthFormParts';
import { authInlineLinkClass, authQuietLinkClass, authMutedTextClass } from '@/components/auth/auth-styles';

const loginSchema = z.object({
  email: z.string().min(1, 'Email address is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [step, setStep] = useState<'email' | 'password'>('email');
  // FOCUS MANAGEMENT ACROSS THE STEP CHANGE. Whichever control the user activated is
  // unmounted by the step change, which drops focus to <body> and strands a keyboard or
  // screen reader user at the top of the document. Each step therefore focuses its own
  // field on mount — except the very first paint, where stealing focus would skip the
  // heading and subtitle before the user has heard what page they are on.
  const [autoFocusEmail, setAutoFocusEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();
  const context = getSubdomainContext();
  const isDeactivated = searchParams.get('reason') === 'deactivated';

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { register, handleSubmit, trigger, getValues, formState } = form;

  const subtitle =
    context === 'portal'
      ? 'Sign in to the platform administration portal.'
      : 'Welcome back! Please sign in to continue.';

  // Advancing is a local validation, not a submit: the form element's onSubmit is bound to
  // this while step === 'email' so that pressing Enter in the field advances, exactly as
  // clicking Continue does.
  const goToPasswordStep = async () => {
    const ok = await trigger('email');
    if (ok) setStep('password');
  };

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const { user, tokens } = await api.login(values.email, values.password);
      login(user, tokens);

      // Role does not belong on this subdomain — bounce to the right one.
      if (!isRoleAllowedOnSubdomain(user.role)) {
        const redirect = getCorrectSubdomain(user.role);
        if (redirect) {
          notifySuccess('Wrong portal', `Redirecting you to ${redirect.label}...`);
          window.location.href = redirect.url;
          return;
        }
      }

      notifySuccess('Welcome back!', `Logged in as ${user.firstName} ${user.lastName}`);
      navigate(user.role === 'PLATFORM_ADMIN' ? '/platform/dashboard' : '/org/dashboard');
    } catch (error) {
      notifyError(error, 'Invalid email or password. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deactivatedBanner = isDeactivated ? (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Organization deactivated</AlertTitle>
      <AlertDescription>
        Your organization has been deactivated by the platform administrator. Please contact
        support for more information.
      </AlertDescription>
    </Alert>
  ) : null;

  return (
    <AuthLayout heading="Sign in" subtitle={subtitle} banner={deactivatedBanner}>
      <form
        noValidate
        onSubmit={
          step === 'email'
            ? (event) => {
                event.preventDefault();
                void goToPasswordStep();
              }
            : handleSubmit(onSubmit)
        }
      >
        {/*
          The keys are load-bearing, not decoration. Both branches render a <div> whose
          third child is an AuthField, so React reconciles them as the same element and
          merely updates its props — the input is never remounted, and `autoFocus`, which
          only fires on mount, silently does nothing. Focus then stays on the button that
          just unmounted, i.e. on <body>, and a keyboard user is dumped at the top of the
          document on every step change. Distinct keys force the unmount/remount.
        */}
        {step === 'email' ? (
          <div key="step-email" className="space-y-5">
            <GoogleAuthButton />
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
              error={formState.errors.email?.message}
              {...register('email')}
            />
            <AuthPrimaryButton type="submit">Continue</AuthPrimaryButton>
          </div>
        ) : (
          <div key="step-password" className="space-y-5">
            {/*
              Password managers key the credential on a username field that is present in
              the same form as the password. Splitting the steps would otherwise hide the
              email from them and break both autofill and save-on-submit.
            */}
            <input
              type="text"
              value={getValues('email')}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="username"
              className="sr-only"
            />

            <p className={`text-sm ${authMutedTextClass}`}>
              Signing in as <span className="font-medium text-white">{getValues('email')}</span>
            </p>

            <AuthField
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              autoFocus
              error={formState.errors.password?.message}
              labelAction={
                <Link to="/forgot-password" className={`text-[13px] ${authQuietLinkClass}`}>
                  Forgot password?
                </Link>
              }
              {...register('password')}
            />

            {/*
              The reveal toggle sits under the field rather than inside it. Overlaying a
              button on a 44px input leaves the control at roughly 32px of real estate and
              pushes long passwords under it; a plain text toggle below is a full-size
              target and does not fight the input's padding.
            */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className={`-mt-2 h-auto justify-start p-0 text-[13px] font-normal hover:bg-transparent ${authQuietLinkClass}`}
            >
              {showPassword ? (
                <EyeOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              )}
              {showPassword ? 'Hide password' : 'Show password'}
            </Button>

            <AuthPrimaryButton type="submit" loading={isLoading}>
              Sign in
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

      {context !== 'portal' && (
        <AuthAltAction>
          Don&apos;t have an account?{' '}
          <Link to="/register-organization" className={authInlineLinkClass}>
            Sign up
          </Link>
        </AuthAltAction>
      )}
    </AuthLayout>
  );
}
