import { z } from 'zod';

// Kenyan phone number format: +254XXXXXXXXX or 07XXXXXXXX or 01XXXXXXXX
const kenyanPhoneRegex = /^(\+254|0)[17]\d{8}$/;

export const organizationRegistrationSchema = z.object({
  // Organization details
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be less than 100 characters'),
  registrationNumber: z
    .string()
    .min(1, 'Registration number is required')
    .max(50, 'Registration number must be less than 50 characters'),
  type: z.enum(['COOPERATIVE', 'NGO', 'MFI', 'INSURANCE_COMPANY', 'GOVERNMENT', 'OTHER'], {
    required_error: 'Please select an organization type',
  }),

  // Contact person details
  contactFirstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters'),
  contactLastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters'),
  contactEmail: z
    .string()
    .email('Please enter a valid email address'),
  contactPhone: z
    .string()
    .regex(kenyanPhoneRegex, 'Please enter a valid Kenyan phone number (+254... or 07... or 01...)'),
});

export type OrganizationRegistrationFormData = z.infer<typeof organizationRegistrationSchema>;

// Self-service org signup: organization + first admin user (with password).
// KYB documents are NOT collected here — they're submitted later, in the dashboard.
export const orgSignupSchema = z
  .object({
    organizationName: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
    registrationNumber: z.string().min(1, 'Registration number is required').max(50),
    type: z.enum(['COOPERATIVE', 'NGO', 'MFI', 'INSURANCE_COMPANY', 'GOVERNMENT', 'OTHER'], {
      required_error: 'Please select an organization type',
    }),
    county: z.string().max(100).optional(),
    firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
    lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
    email: z.string().email('Please enter a valid email address'),
    phone: z
      .string()
      .regex(kenyanPhoneRegex, 'Enter a valid Kenyan phone number (+254… or 07… or 01…)')
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
        'Include an uppercase letter, a number, and a special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type OrgSignupFormData = z.infer<typeof orgSignupSchema>;

export const orgTypeLabels: Record<string, string> = {
  COOPERATIVE: 'Cooperative',
  NGO: 'NGO',
  MFI: 'Microfinance Institution',
  INSURANCE_COMPANY: 'Insurance Company',
  GOVERNMENT: 'Government',
  OTHER: 'Other',
};

// KYB verification schema (for admin review)
export const kybVerificationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], {
    required_error: 'Please select a verification status',
  }),
  reviewNotes: z
    .string()
    .max(500, 'Review notes must be less than 500 characters')
    .optional(),
});

export type KYBVerificationFormData = z.infer<typeof kybVerificationSchema>;

// Admin create organization schema
export const adminCreateOrganizationSchema = organizationRegistrationSchema.extend({
  verifyImmediately: z.boolean().default(false),
  // Optional fields for admin creation
  brandName: z.string().optional(),
  county: z.string().optional(),
});

export type AdminCreateOrganizationFormData = z.infer<typeof adminCreateOrganizationSchema>;

// Accept invitation schema
export const acceptInvitationSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type AcceptInvitationFormData = z.infer<typeof acceptInvitationSchema>;

// Document type labels
export const documentTypeLabels: Record<string, string> = {
  BUSINESS_REGISTRATION_CERT: 'Business Registration Certificate',
  TAX_PIN_CERT: 'Tax PIN Certificate',
};

// Organization type labels
export const organizationTypeLabels: Record<string, string> = {
  COOPERATIVE: 'Cooperative',
  NGO: 'NGO',
  MFI: 'Microfinance Institution',
  INSURANCE_COMPANY: 'Insurance Company',
  GOVERNMENT: 'Government',
  OTHER: 'Other',
};
