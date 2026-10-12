import { ApiError } from "@/lib/api/client";

/**
 * Turn any thrown error (ApiError, network failure, unexpected Error) into a
 * concise, user-facing message. Never leaks raw technical/stack/SQL text — falls
 * back to a friendly generic message.
 *
 * Precedence: known backend `code` → validation field detail → a backend message
 * that reads as user copy → an HTTP-status generic → the caller's fallback.
 */

// Friendly copy for HTTP statuses (used when the backend message is technical).
const STATUS_MESSAGES: Record<number, string> = {
  0: "Can't reach the server. Check your internet connection and try again.",
  400: "Some details look incorrect. Please review your input and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  408: "The request timed out. Please try again.",
  409: "That conflicts with something that already exists.",
  413: "That file is too large to upload.",
  422: "Some details look incorrect. Please review your input and try again.",
  429: "You're doing that too quickly. Please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again.",
  502: "The server is temporarily unavailable. Please try again in a moment.",
  503: "The service is temporarily unavailable. Please try again in a moment.",
  504: "The request took too long. Please try again.",
};

// Specific copy for backend error `code`s worth a tailored message. Add entries
// here only for codes that actually reach a user-facing API response AND whose
// backend message isn't already clear (keep keys matching the backend exactly).
const CODE_MESSAGES: Record<string, string> = {
  SCREENING_RED:
    "Compliance screening flagged this organization (RED). Resolve the screening result before approving.",
  REGULATOR_LICENSE_REQUIRED:
    "The insurance regulator operating license is required. Add the license number and upload the certificate.",
  REGULATOR_LICENSE_EXPIRY_REQUIRED: "Please provide the operating license's expiry date.",
  REGULATOR_LICENSE_EXPIRED: "The operating license on file has expired. Submit a current license.",
  // The registration number moved from signup to KYB submission, so these two now reach a
  // partner mid-form rather than mid-signup. The backend's own copy for both is already good
  // and long (it explains what the number is and where to find it), but it exceeds the
  // isUserSafeMessage length ceiling, so without these entries it would be replaced by the
  // generic "Some details look incorrect" / "That conflicts with something" — which says
  // nothing about which field or what to do.
  REGISTRATION_NUMBER_REQUIRED:
    "Your company registration number is required. It must match the business-registration certificate you upload.",
  REGISTRATION_NUMBER_TAKEN:
    "That company registration number is already registered to another organization. Check it against your certificate, or contact MicroCrop.",
  // A capability refusal is a PLAN BOUNDARY, not a fault. If one ever reaches a toast — the
  // gates in lib/capability.ts exist to stop that — it must not read as an error.
  CAPABILITY_NOT_ENABLED:
    "That isn't enabled for your organization. Contact MicroCrop to have it switched on.",
};

// Heuristic: is this string already written as end-user copy (vs. a raw
// technical/stack/DB message we should hide)?
function isUserSafeMessage(msg?: string | null): msg is string {
  if (!msg) return false;
  const m = msg.trim();
  if (m.length < 3 || m.length > 160) return false;
  return !/(exception|stack|trace|prisma|sequelize|\bsql\b|econn|etimedout|enotfound|socket|\bundefined\b|\bnull\b|typeerror|referenceerror|\bat\s|https?:\/\/|\/[a-z]+\/[a-z]+\.js|[{}]|:\d{2,5}\b)/i.test(m);
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof ApiError) {
    if (error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code];

    // Validation errors: surface the first field-level detail if it reads cleanly.
    if ((error.status === 400 || error.status === 422) && error.details?.length) {
      const detail = error.details.find((d) => isUserSafeMessage(d?.message))?.message;
      if (detail) return detail;
    }

    // The backend often writes good user-facing copy ("Invalid email or password",
    // "Account temporarily locked", "Email already registered") — prefer it.
    if (isUserSafeMessage(error.message)) return error.message;

    if (STATUS_MESSAGES[error.status]) return STATUS_MESSAGES[error.status];
    return fallback;
  }

  // Non-ApiError: raw Error messages are usually not user copy — stay generic.
  return fallback;
}
