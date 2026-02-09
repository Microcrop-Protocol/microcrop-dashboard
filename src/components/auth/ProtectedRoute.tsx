import { useAuthStore } from "@/stores/authStore";
import { Navigate, useLocation } from "react-router-dom";
import { isRoleAllowedOnSubdomain, getCorrectSubdomain } from "@/lib/subdomain";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('PLATFORM_ADMIN' | 'ORG_ADMIN' | 'ORG_STAFF')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Enforce subdomain restrictions
  if (!isRoleAllowedOnSubdomain(user.role)) {
    const redirect = getCorrectSubdomain(user.role);
    if (redirect) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="max-w-md text-center space-y-4">
            <h2 className="text-xl font-semibold">Wrong Portal</h2>
            <p className="text-muted-foreground">
              Your account does not have access to this portal. Please use the correct one.
            </p>
            <a
              href={redirect.url}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to {redirect.label}
            </a>
          </div>
        </div>
      );
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    const redirectPath = user.role === 'PLATFORM_ADMIN' ? '/platform/dashboard' : '/org/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
