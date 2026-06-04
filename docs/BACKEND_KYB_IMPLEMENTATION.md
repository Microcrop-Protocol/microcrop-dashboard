# Backend Implementation Guide: Organization KYB & Onboarding

This document details the backend API requirements for the Organization Account Creation with KYB (Know Your Business) compliance feature.

---

## IMPORTANT: Missing Endpoints

The following endpoints are **NOT in the current API spec** and need to be implemented:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/applications/organization` | POST | Public org self-registration with file upload |
| `/api/applications/organization` | GET | List KYB applications (platform admin) |
| `/api/applications/organization/:id` | GET | Get single application details |
| `/api/applications/organization/:id/verify` | POST | Approve/reject KYB application |
| `/api/invitations` | POST | Create admin invitation |
| `/api/invitations/:id/send` | POST | Send invitation email |
| `/api/invitations` | GET | List invitations |
| `/api/invitations/validate/:token` | GET | Validate invitation token (public) |
| `/api/invitations/accept` | POST | Accept invitation & create user (public) |
| `/api/kyb/pending-count` | GET | Get pending KYB count for badge |

The frontend is ready and will use these endpoints. See `src/lib/api/client.ts` for expected request/response formats.

---

## Table of Contents
1. [Overview](#overview)
2. [Database Models](#database-models)
3. [API Endpoints](#api-endpoints)
4. [Business Logic](#business-logic)
5. [Email Templates](#email-templates)
6. [Security Considerations](#security-considerations)
7. [File Storage](#file-storage)

---

## Overview

### Feature Summary
- Organizations can self-register via a public form with KYB document upload
- Platform admins can review KYB applications and approve/reject
- Platform admins can also create organizations directly (bypassing self-registration)
- Upon approval, an invitation email is sent to the organization admin
- The invited admin sets their password and gains access to the platform

### User Flows
1. **Self-Registration Flow**: Public form → KYB Review → Approval → Invitation → Password Setup → Login
2. **Admin Creation Flow**: Admin creates org → (Optional) Mark verified → Send Invitation → Password Setup → Login

---

## Database Models

### 1. Organization (Update Existing)

Add these fields to the existing `organizations` table:

```sql
ALTER TABLE organizations ADD COLUMN kyb_status VARCHAR(20) DEFAULT 'PENDING_REVIEW';
-- Values: 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'

ALTER TABLE organizations ADD COLUMN kyb_verification_id UUID REFERENCES kyb_verifications(id);
ALTER TABLE organizations ADD COLUMN contact_email VARCHAR(255);
ALTER TABLE organizations ADD COLUMN contact_phone VARCHAR(20);
ALTER TABLE organizations ADD COLUMN contact_person_name VARCHAR(100);
```

### 2. Organization Applications (New Table)

For self-registration applications before they become organizations:

```sql
CREATE TABLE organization_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization details
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'COOPERATIVE', 'AGGREGATOR', 'INSURER', 'GOVERNMENT'

    -- Contact person (will become org admin)
    contact_first_name VARCHAR(50) NOT NULL,
    contact_last_name VARCHAR(50) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
    -- Values: 'PENDING_REVIEW', 'APPROVED', 'REJECTED'

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_org_applications_status ON organization_applications(status);
CREATE INDEX idx_org_applications_email ON organization_applications(contact_email);
```

### 3. KYB Verifications (New Table)

```sql
CREATE TABLE kyb_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Can belong to either an application or directly to an organization
    application_id UUID REFERENCES organization_applications(id),
    organization_id UUID REFERENCES organizations(id),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
    -- Values: 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'

    -- Review details
    review_notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_kyb_parent CHECK (
        (application_id IS NOT NULL AND organization_id IS NULL) OR
        (application_id IS NULL AND organization_id IS NOT NULL)
    )
);
```

### 4. KYB Documents (New Table)

```sql
CREATE TABLE kyb_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyb_verification_id UUID NOT NULL REFERENCES kyb_verifications(id) ON DELETE CASCADE,

    -- Document details
    type VARCHAR(30) NOT NULL, -- 'BUSINESS_REGISTRATION_CERT', 'TAX_PIN_CERT'
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL, -- S3/cloud storage URL
    file_size INTEGER NOT NULL, -- bytes
    mime_type VARCHAR(50) NOT NULL,

    -- Verification
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),

    -- Timestamps
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kyb_documents_verification ON kyb_documents(kyb_verification_id);
```

### 5. Organization Admin Invitations (New Table)

```sql
CREATE TABLE org_admin_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Invitee details
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,

    -- Token for secure link
    token VARCHAR(64) NOT NULL UNIQUE, -- Cryptographically secure random string
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- Values: 'PENDING', 'SENT', 'ACCEPTED', 'EXPIRED'

    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate active invitations
    CONSTRAINT unique_active_invitation UNIQUE (organization_id, email, status)
);

CREATE INDEX idx_invitations_token ON org_admin_invitations(token);
CREATE INDEX idx_invitations_org ON org_admin_invitations(organization_id);
CREATE INDEX idx_invitations_status ON org_admin_invitations(status);
```

---

## API Endpoints

### Authentication Requirements
- `[PUBLIC]` - No authentication required
- `[PLATFORM_ADMIN]` - Requires platform admin role
- `[AUTHENTICATED]` - Requires any authenticated user

---

### 1. Organization Application Endpoints

#### POST /api/applications/organization `[PUBLIC]`

Submit a new organization registration application.

**Request (multipart/form-data):**
```
name: string (required, 2-100 chars)
type: enum (required) - 'COOPERATIVE' | 'AGGREGATOR' | 'INSURER' | 'GOVERNMENT'
contactFirstName: string (required, 2-50 chars)
contactLastName: string (required, 2-50 chars)
contactEmail: string (required, valid email)
contactPhone: string (required, Kenyan format: +254XXXXXXXXX or 07XXXXXXXX)
businessRegistrationCert: File (required, PDF/JPEG/PNG, max 5MB)
taxPinCert: File (required, PDF/JPEG/PNG, max 5MB)
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "Sunrise Farmers Cooperative",
  "type": "COOPERATIVE",
  "contactEmail": "james@sunrise.co.ke",
  "status": "PENDING_REVIEW",
  "createdAt": "2025-01-28T10:00:00Z",
  "message": "Application submitted successfully. You will receive an email once reviewed."
}
```

**Backend Logic:**
1. Validate all fields (see validation rules below)
2. Check if email already has a pending application
3. Upload documents to cloud storage (S3/GCS)
4. Create `organization_applications` record
5. Create `kyb_verifications` record linked to application
6. Create `kyb_documents` records for each file
7. (Optional) Send confirmation email to applicant
8. (Optional) Notify platform admins of new application

**Validation Rules:**
- `contactPhone`: Must match regex `/^(\+254|0)[17]\d{8}$/`
- Files: Max 5MB, allowed types: `application/pdf`, `image/jpeg`, `image/png`
- `contactEmail`: Must not have existing pending application

---

#### GET /api/applications/organization `[PLATFORM_ADMIN]`

List all organization applications.

**Query Parameters:**
```
status: string (optional) - Filter by status
page: number (default: 1)
limit: number (default: 20, max: 100)
search: string (optional) - Search by name or email
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Sunrise Farmers Cooperative",
      "type": "COOPERATIVE",
      "contactFirstName": "James",
      "contactLastName": "Mwangi",
      "contactEmail": "james@sunrise.co.ke",
      "contactPhone": "+254711223344",
      "status": "PENDING_REVIEW",
      "kybVerification": {
        "id": "uuid",
        "status": "PENDING_REVIEW",
        "documentsCount": 2,
        "submittedAt": "2025-01-28T10:00:00Z"
      },
      "createdAt": "2025-01-28T10:00:00Z",
      "updatedAt": "2025-01-28T10:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

---

#### GET /api/applications/organization/:id `[PLATFORM_ADMIN]`

Get single application with full details including documents.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "Sunrise Farmers Cooperative",
  "type": "COOPERATIVE",
  "contactFirstName": "James",
  "contactLastName": "Mwangi",
  "contactEmail": "james@sunrise.co.ke",
  "contactPhone": "+254711223344",
  "status": "PENDING_REVIEW",
  "kybVerification": {
    "id": "uuid",
    "status": "PENDING_REVIEW",
    "documents": [
      {
        "id": "uuid",
        "type": "BUSINESS_REGISTRATION_CERT",
        "fileName": "business_reg.pdf",
        "fileUrl": "https://storage.example.com/...", // Signed URL, expires in 1 hour
        "fileSize": 1024000,
        "uploadedAt": "2025-01-28T10:00:00Z",
        "verifiedAt": null,
        "verifiedBy": null
      },
      {
        "id": "uuid",
        "type": "TAX_PIN_CERT",
        "fileName": "tax_pin.pdf",
        "fileUrl": "https://storage.example.com/...",
        "fileSize": 512000,
        "uploadedAt": "2025-01-28T10:00:00Z",
        "verifiedAt": null,
        "verifiedBy": null
      }
    ],
    "reviewNotes": null,
    "reviewedBy": null,
    "reviewedAt": null,
    "submittedAt": "2025-01-28T10:00:00Z"
  },
  "createdAt": "2025-01-28T10:00:00Z",
  "updatedAt": "2025-01-28T10:00:00Z"
}
```

**Note:** Document `fileUrl` should be a signed/presigned URL that expires (e.g., 1 hour).

---

#### POST /api/applications/organization/:id/verify `[PLATFORM_ADMIN]`

Approve or reject a KYB application.

**Request:**
```json
{
  "status": "VERIFIED", // or "REJECTED"
  "reviewNotes": "All documents verified. Business is registered and in good standing."
}
```

**Response (200 OK) - On Approval:**
```json
{
  "application": {
    "id": "uuid",
    "status": "APPROVED",
    "updatedAt": "2025-01-28T12:00:00Z"
  },
  "organization": {
    "id": "uuid",
    "name": "Sunrise Farmers Cooperative",
    "type": "COOPERATIVE",
    "kybStatus": "VERIFIED",
    "isActive": false,
    "createdAt": "2025-01-28T12:00:00Z"
  },
  "message": "Application approved. Organization created."
}
```

**Response (200 OK) - On Rejection:**
```json
{
  "application": {
    "id": "uuid",
    "status": "REJECTED",
    "updatedAt": "2025-01-28T12:00:00Z"
  },
  "message": "Application rejected."
}
```

**Backend Logic (Approval):**
1. Update `kyb_verifications` record with status, notes, reviewer, timestamp
2. Update all `kyb_documents` with verified_at and verified_by
3. Update `organization_applications` status to 'APPROVED'
4. Create new `organizations` record with:
   - Data from application
   - `kyb_status` = 'VERIFIED'
   - `is_active` = false (until admin sets up)
   - `onboarding_step` = 'REGISTERED'
5. Send approval email to applicant (see Email Templates)

**Backend Logic (Rejection):**
1. Update `kyb_verifications` record with status, notes, reviewer, timestamp
2. Update `organization_applications` status to 'REJECTED'
3. Send rejection email to applicant with reason (see Email Templates)

---

### 2. Organization Endpoints (Admin Creation)

#### POST /api/organizations `[PLATFORM_ADMIN]`

Create organization directly (admin bypass).

**Request:**
```json
{
  "name": "Sunrise Farmers Cooperative",
  "type": "COOPERATIVE",
  "contactFirstName": "James",
  "contactLastName": "Mwangi",
  "contactEmail": "james@sunrise.co.ke",
  "contactPhone": "+254711223344",
  "verifyImmediately": true
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "Sunrise Farmers Cooperative",
  "type": "COOPERATIVE",
  "kybStatus": "VERIFIED", // or "PENDING_REVIEW" if verifyImmediately=false
  "isActive": false,
  "onboardingStep": "REGISTERED",
  "contactEmail": "james@sunrise.co.ke",
  "contactPhone": "+254711223344",
  "contactPersonName": "James Mwangi",
  "createdAt": "2025-01-28T10:00:00Z"
}
```

---

### 3. Invitation Endpoints

#### POST /api/invitations `[PLATFORM_ADMIN]`

Create an invitation for an organization admin.

**Request:**
```json
{
  "organizationId": "uuid",
  "email": "james@sunrise.co.ke",
  "firstName": "James",
  "lastName": "Mwangi"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "organizationName": "Sunrise Farmers Cooperative",
  "email": "james@sunrise.co.ke",
  "firstName": "James",
  "lastName": "Mwangi",
  "status": "PENDING",
  "tokenExpiresAt": "2025-02-04T10:00:00Z",
  "createdAt": "2025-01-28T10:00:00Z"
}
```

**Backend Logic:**
1. Verify organization exists and has `kyb_status` = 'VERIFIED'
2. Check for existing active invitation for this org+email
3. Generate cryptographically secure token (32+ bytes, hex encoded)
4. Set expiration to 7 days from now
5. Create `org_admin_invitations` record

---

#### POST /api/invitations/:id/send `[PLATFORM_ADMIN]`

Send (or resend) an invitation email.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "SENT",
  "sentAt": "2025-01-28T10:00:00Z",
  "message": "Invitation email sent successfully."
}
```

**Backend Logic:**
1. Verify invitation exists and is not expired/accepted
2. Send email with invitation link (see Email Templates)
3. Update status to 'SENT' and set `sent_at`

---

#### GET /api/invitations `[PLATFORM_ADMIN]`

List all invitations.

**Query Parameters:**
```
organizationId: uuid (optional) - Filter by organization
status: string (optional) - Filter by status
page: number (default: 1)
limit: number (default: 20)
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "organizationId": "uuid",
      "organizationName": "Sunrise Farmers Cooperative",
      "email": "james@sunrise.co.ke",
      "firstName": "James",
      "lastName": "Mwangi",
      "status": "SENT",
      "tokenExpiresAt": "2025-02-04T10:00:00Z",
      "sentAt": "2025-01-28T10:00:00Z",
      "acceptedAt": null,
      "createdAt": "2025-01-28T10:00:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "hasMore": false
}
```

---

#### GET /api/invitations/validate/:token `[PUBLIC]`

Validate an invitation token (used when user clicks link).

**Response (200 OK) - Valid:**
```json
{
  "valid": true,
  "invitation": {
    "id": "uuid",
    "organizationName": "Sunrise Farmers Cooperative",
    "email": "james@sunrise.co.ke",
    "firstName": "James",
    "lastName": "Mwangi"
  }
}
```

**Response (200 OK) - Invalid:**
```json
{
  "valid": false,
  "error": "Invitation has expired" // or "Invitation not found" or "Invitation already accepted"
}
```

---

#### POST /api/invitations/accept `[PUBLIC]`

Accept invitation and create user account.

**Request:**
```json
{
  "token": "abc123...",
  "password": "SecurePass123"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "email": "james@sunrise.co.ke",
    "firstName": "James",
    "lastName": "Mwangi",
    "role": "ORG_ADMIN",
    "organizationId": "uuid"
  },
  "message": "Account created successfully. You can now log in."
}
```

**Backend Logic:**
1. Validate token exists, not expired, not accepted
2. Validate password meets requirements:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
3. Hash password with bcrypt (cost factor 12+)
4. Create `users` record with:
   - `role` = 'ORG_ADMIN'
   - `organization_id` = invitation's organization
   - `is_active` = true
5. Update invitation status to 'ACCEPTED', set `accepted_at`
6. Increment organization's `users_count`
7. (Optional) Send welcome email

---

### 4. Utility Endpoints

#### GET /api/kyb/pending-count `[PLATFORM_ADMIN]`

Get count of pending KYB applications (for navigation badge).

**Response (200 OK):**
```json
{
  "count": 5
}
```

---

## Business Logic

### Token Generation
```javascript
// Use crypto for secure token generation
const crypto = require('crypto');
const token = crypto.randomBytes(32).toString('hex'); // 64 char hex string
```

### Password Hashing
```javascript
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

// Hash password
const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

// Verify password
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

### Invitation Expiration
- Default expiration: 7 days from creation
- Check expiration on every validation
- Background job to mark expired invitations (optional)

### File Validation
```javascript
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function validateFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error('Invalid file type. Allowed: PDF, JPEG, PNG');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size: 5MB');
  }
}
```

### Kenyan Phone Validation
```javascript
const KENYAN_PHONE_REGEX = /^(\+254|0)[17]\d{8}$/;

function validateKenyanPhone(phone) {
  if (!KENYAN_PHONE_REGEX.test(phone)) {
    throw new Error('Invalid phone number. Use format: +254XXXXXXXXX or 07XXXXXXXX');
  }
}
```

---

## Email Templates

### 1. Application Received (Optional)

**To:** Applicant
**Subject:** MicroCrop - Application Received

```
Hello {firstName},

Thank you for applying to register {organizationName} with MicroCrop.

We have received your application and KYB documents. Our team will review them within 2-3 business days.

You will receive another email once the review is complete.

Application Details:
- Organization: {organizationName}
- Type: {organizationType}
- Submitted: {submittedDate}

If you have any questions, please contact support@microcrop.io.

Best regards,
The MicroCrop Team
```

### 2. Application Approved

**To:** Applicant
**Subject:** MicroCrop - Your Organization Has Been Approved!

```
Hello {firstName},

Great news! Your application to register {organizationName} with MicroCrop has been approved.

You will receive a separate email shortly with instructions to set up your administrator account.

What's next:
1. Set up your password using the link in the invitation email
2. Log in to your organization dashboard
3. Configure your organization settings
4. Start onboarding farmers

If you don't receive the invitation email within 24 hours, please contact support@microcrop.io.

Welcome to MicroCrop!

Best regards,
The MicroCrop Team
```

### 3. Application Rejected

**To:** Applicant
**Subject:** MicroCrop - Application Status Update

```
Hello {firstName},

Thank you for your interest in MicroCrop. After reviewing your application for {organizationName}, we were unable to approve it at this time.

Reason: {reviewNotes}

If you believe this was in error or would like to resubmit with updated documents, please submit a new application at: {registrationUrl}

If you have questions about this decision, please contact support@microcrop.io.

Best regards,
The MicroCrop Team
```

### 4. Admin Invitation

**To:** Invited Admin
**Subject:** You've been invited to join {organizationName} on MicroCrop

```
Hello {firstName},

You have been invited to become an administrator for {organizationName} on the MicroCrop platform.

Click the link below to set up your password and access your organization dashboard:

{acceptInvitationUrl}

This invitation will expire on {expirationDate}.

If you did not expect this invitation, please ignore this email or contact support@microcrop.io.

Best regards,
The MicroCrop Team
```

**Variables:**
- `{acceptInvitationUrl}` = `https://app.microcrop.io/accept-invitation/{token}`

### 5. Welcome Email (After Accepting Invitation)

**To:** New Admin
**Subject:** Welcome to MicroCrop!

```
Hello {firstName},

Your MicroCrop account has been created successfully!

You can now log in at: https://app.microcrop.io/login

Your Organization: {organizationName}
Your Role: Organization Administrator

Getting Started:
1. Configure your organization profile
2. Set up your liquidity pool
3. Invite staff members
4. Start registering farmers

Need help? Check our documentation at https://docs.microcrop.io or contact support@microcrop.io.

Best regards,
The MicroCrop Team
```

---

## Security Considerations

### 1. Token Security
- Use cryptographically secure random generation (crypto.randomBytes)
- Tokens should be at least 32 bytes (64 hex characters)
- Store tokens hashed in database (optional extra security)
- Implement rate limiting on token validation endpoints

### 2. File Upload Security
- Validate MIME types server-side (don't trust client)
- Scan uploaded files for malware (recommended)
- Store files in private bucket, serve via signed URLs
- Set Content-Disposition header to prevent XSS

### 3. Password Security
- Use bcrypt with cost factor 12+
- Enforce password complexity requirements
- Implement rate limiting on password attempts
- Consider implementing account lockout

### 4. API Security
- All endpoints should use HTTPS
- Implement CORS properly
- Rate limit public endpoints (registration, invitation acceptance)
- Log all admin actions for audit trail

### 5. Email Security
- Use SPF, DKIM, DMARC for email authentication
- Don't include sensitive data in emails
- Use secure email provider (SendGrid, SES, etc.)

---

## File Storage

### Recommended: AWS S3 or Google Cloud Storage

**Bucket Structure:**
```
microcrop-kyb-documents/
├── applications/
│   └── {applicationId}/
│       ├── business_registration_cert_{timestamp}.pdf
│       └── tax_pin_cert_{timestamp}.pdf
└── organizations/
    └── {organizationId}/
        └── ... (if directly uploaded)
```

**Access Pattern:**
1. Upload: Direct to S3 via presigned upload URL (recommended) or via backend
2. Download: Generate presigned URL with 1-hour expiration
3. Never expose bucket directly

**Presigned URL Example (AWS SDK):**
```javascript
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Generate download URL
async function getDocumentUrl(key) {
  const command = new GetObjectCommand({
    Bucket: 'microcrop-kyb-documents',
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
}

// Generate upload URL
async function getUploadUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: 'microcrop-kyb-documents',
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
}
```

---

## Cron Jobs / Background Tasks

### 1. Expire Invitations
Run daily to mark expired invitations:
```sql
UPDATE org_admin_invitations
SET status = 'EXPIRED'
WHERE status IN ('PENDING', 'SENT')
  AND token_expires_at < NOW();
```

### 2. Cleanup Old Documents (Optional)
Remove documents from rejected applications after retention period:
```sql
-- Find documents to delete (applications rejected > 30 days ago)
SELECT d.file_url
FROM kyb_documents d
JOIN kyb_verifications v ON d.kyb_verification_id = v.id
JOIN organization_applications a ON v.application_id = a.id
WHERE a.status = 'REJECTED'
  AND a.updated_at < NOW() - INTERVAL '30 days';
```

---

## Testing Checklist

### Unit Tests
- [ ] Token generation is cryptographically secure
- [ ] Password hashing and verification works
- [ ] Phone number validation regex
- [ ] File type/size validation
- [ ] Email template rendering

### Integration Tests
- [ ] Full registration flow (submit → review → approve → invite → accept)
- [ ] Rejection flow with proper emails
- [ ] Token expiration handling
- [ ] Duplicate application prevention
- [ ] File upload and retrieval

### Security Tests
- [ ] Rate limiting on public endpoints
- [ ] Token cannot be reused
- [ ] Expired tokens are rejected
- [ ] SQL injection prevention
- [ ] XSS prevention in file downloads

---

## Frontend Integration Notes

The frontend currently uses mock API in `/src/lib/mockData.ts`. Replace mock calls with actual API calls:

```typescript
// Current (mock):
const result = await mockApi.submitOrgApplication(data);

// Replace with:
const formData = new FormData();
formData.append('name', data.name);
formData.append('type', data.type);
// ... other fields
formData.append('businessRegistrationCert', files[0]);
formData.append('taxPinCert', files[1]);

const result = await fetch('/api/applications/organization', {
  method: 'POST',
  body: formData,
});
```

**API Base URL:** Configure via environment variable `VITE_API_URL`

---

## Questions for Backend Team

1. Which email service will be used? (SendGrid, AWS SES, etc.)
2. Which cloud storage for documents? (S3, GCS, Azure Blob)
3. Any existing audit logging system to integrate with?
4. Authentication system details (JWT? Session? OAuth?)
5. Existing user creation flow to integrate with?

---

*Document Version: 1.0*
*Last Updated: 2025-01-28*
*Frontend Implementation Reference: `/src/lib/mockData.ts`*
