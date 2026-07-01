import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error-messages";

/**
 * App-wide success/error notifications. Use these for ALL user-facing action
 * feedback so messaging is consistent and errors are always friendly.
 *
 *   notifySuccess("Policy created", "The farmer has been notified by SMS.");
 *   try { await save(); notifySuccess("Saved"); }
 *   catch (e) { notifyError(e, "Couldn't save your changes."); }
 */

export function notifySuccess(title: string, description?: string) {
  toast({ title, description });
}

/**
 * Show a friendly error toast. `error` may be anything thrown; it's run through
 * getErrorMessage so raw backend/technical text is never shown. Pass a
 * context-specific `fallback` (e.g. "Couldn't create the policy.") for the case
 * where the error carries no user-safe message.
 */
export function notifyError(error: unknown, fallback?: string) {
  toast({
    variant: "destructive",
    title: "Something went wrong",
    description: getErrorMessage(error, fallback),
  });
}
