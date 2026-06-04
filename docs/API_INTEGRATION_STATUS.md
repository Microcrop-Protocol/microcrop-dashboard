# API Integration Status

**Generated:** 2026-01-28
**Frontend Config:** `VITE_USE_MOCK_API=false` (using real backend)
**All pages now use the unified API service** - No direct mock data imports in pages.

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| Auth | ✅ Ready | Login, register, refresh token |
| Platform Dashboard | ✅ Ready | Overview, organizations, analytics |
| Organizations | ✅ Ready | CRUD, configure, deploy pool |
| Farmers | ✅ Ready | CRUD, KYC, bulk import |
| Policies | ✅ Ready | Quote, purchase, manage |
| Payouts | ✅ Ready | List, retry, reconciliation |
| Staff | ✅ Ready | Invite, manage roles |
| Exports | ✅ Ready | CSV exports |
| **KYB Applications** | ⚠️ Needs Verification | Backend recently updated |
| **Invitations** | ⚠️ Needs Verification | Backend recently updated |

---

## ✅ Fully Integrated Endpoints

These endpoints are connected to real backend APIs:

### Auth
| Method | Endpoint | Frontend Method |
|--------|----------|-----------------|
| POST | `/api/auth/login` | `api.login()` |
| POST | `/api/auth/register` | `apiClient.register()` |
| POST | `/api/auth/refresh` | `api.refreshToken()` |
| GET | `/api/auth/me` | `api.getMe()` |

### Platform Admin - Organizations
| Method | Endpoint | Frontend Method |
|--------|----------|-----------------|
| POST | `/api/platform/organizations/register` | `api.adminCreateOrganization()` |
| GET | `/api/platform/organizations` | `apiClient.platformGetOrganizations()` |
| GET | `/api/platform/organizations/:id` | `api.getOrganization()` |
| PUT | `/api/platform/organizations/:id/configure` | `apiClient.platformConfigureOrganization()` |
| POST | `/api/platform/organizations/:id/deploy-pool` | `apiClient.platformDeployPool()` |
| POST | `/api/platform/organizations/:id/activate` | `apiClient.platformActivateOrganization()` |
| POST | `/api/platform/organizations/:id/deactivate` | `apiClient.platformDeactivateOrganization()` |
| GET | `/api/platform/organizations/:id/onboarding-status` | `apiClient.platformGetOnboardingStatus()` |

### Platform Dashboard
| Method | Endpoint | Frontend Method |
|--------|----------|-----------------|
| GET | `/api/dashboard/platform/overview` | `api.getPlatformStats()` |
| GET | `/api/dashboard/platform/organizations` | `api.getOrganizations()` |
| GET | `/api/dashboard/platform/organizations/:id/metrics` | `api.getOrganizationStats()` |
| GET | `/api/dashboard/platform/analytics/revenue` | `api.getRevenueAnalytics()` |
| GET | `/api/dashboard/platform/analytics/policies` | `api.getPoliciesAnalytics()` |
| GET | `/api/dashboard/platform/analytics/farmers` | `api.getFarmersAnalytics()` |
| GET | `/api/dashboard/platform/analytics/payouts` | `api.getPayoutsAnalytics()` |
| GET | `/api/dashboard/platform/analytics/damage-assessments` | `api.getDamageAnalytics()` |
| GET | `/api/dashboard/platform/activity` | `api.getActivities()` |

### Organization Dashboard
| Method | Endpoint | Frontend Method |
|--------|----------|-----------------|
| GET | `/api/organizations/me` | `apiClient.getMyOrganization()` |
| GET | `/api/organizations/me/stats` | `apiClient.getMyOrganizationStats()` |
| PUT | `/api/organizations/me/settings` | `apiClient.updateOrganizationSettings()` |
| GET | `/api/organizations/me/pool` | `api.getLiquidityPool()` |
| GET | `/api/dashboard/org/overview` | `apiClient.orgDashboardOverview()` |
| GET | `/api/dashboard/org/farmers` | `apiClient.orgDashboardFarmers()` |
| GET | `/api/dashboard/org/policies` | `apiClient.orgDashboardPolicies()` |
| GET | `/api/dashboard/org/payouts` | `apiClient.orgDashboardPayouts()` |
| GET | `/api/dashboard/org/damage-assessments` | `api.getDamageAssessments()` |
| GET | `/api/dashboard/org/financials` | `api.getFinancialSummary()` |
| GET | `/api/dashboard/org/plots` | `api.getPlots()` |
| GET | `/api/dashboard/org/activity` | `api.getActivities()` |

### Farmers
| Method | Endpoint | Frontend Method |
|--------|----------|-----------------|
| POST | `/api/farmers/register` | `apiClient.registerFarmer()` |
| GET | `/api/farmers` | `api.getFarmers()` |
| GET | `/api/farmers/:id` | `api.getFarmer()` |
| PUT | `/api/farmers/:id` | `apiClient.updateFarmer()` |
| PUT | `/api/farmers/:id/kyc` | `apiClient.updateFarmerKyc()` |
| POST | `/api/farmers/bulk-import` | `apiClient.bulkImportFarmers()` |
| POST | `/api/farmers/bulk-import/plots` | `apiClient.bulkImportPlots()` |

### Policies
| Method | Endpoint | Frontend Method |
|--------|----------|-----------------|
| POST | `/api/policies/quote` | `apiClient.getPolicyQuote()` |
| POST | `/api/policies/purchase` | `apiClient.purchasePolicy()` |
| GET | `/api/policies` | `api.getPolicies()` |
| GET | `/api/policies/:id` | `api.getPolicy()` |
| GET | `/api/policies/:id/status` | `apiClient.getPolicyStatus()` |
| PUT | `/api/policies/:id/activate` | `apiClient.activatePolicy()` |
| POST | `/api/policies/:id/cancel` | `apiClient.cancelPolicy()` |

### Payouts
| Method | Endpoint | Frontend Method |
|--------|----------|-----------------|
| GET | `/api/payouts` | `api.getPayouts()` |
| GET | `/api/payouts/:id` | `apiClient.getPayout()` |
| POST | `/api/payouts/:id/retry` | `apiClient.retryPayout()` |
| POST | `/api/payouts/batch-retry` | `apiClient.batchRetryPayouts()` |
| GET | `/api/payouts/reconciliation` | `apiClient.getPayoutReconciliation()` |

### Staff Management
| Method | Endpoint | Frontend Method |
|--------|----------|-----------------|
| GET | `/api/staff` | `api.getStaff()` |
| POST | `/api/staff/invite` | `api.inviteStaff()` |
| PUT | `/api/staff/:id/role` | `apiClient.updateStaffRole()` |
| PUT | `/api/staff/:id/deactivate` | `apiClient.deactivateStaff()` |
| PUT | `/api/staff/:id/reactivate` | `apiClient.reactivateStaff()` |

### Exports
| Method | Endpoint | Frontend Method |
|--------|----------|-----------------|
| GET | `/api/export/farmers` | `apiClient.exportFarmers()` |
| GET | `/api/export/policies` | `apiClient.exportPolicies()` |
| GET | `/api/export/payouts` | `apiClient.exportPayouts()` |
| GET | `/api/export/transactions` | `apiClient.exportTransactions()` |
| GET | `/api/export/platform/organizations` | `apiClient.exportPlatformOrganizations()` |
| GET | `/api/export/platform/revenue` | `apiClient.exportPlatformRevenue()` |

---

## ⚠️ KYB & Invitation Endpoints (Needs Backend Confirmation)

These endpoints were recently discussed as being implemented. Please confirm they're working:

### Organization Applications (KYB)

| Method | Endpoint | Purpose | Frontend Ready |
|--------|----------|---------|----------------|
| POST | `/api/applications/organization` | Submit new organization application with documents (multipart/form-data) | ✅ |
| GET | `/api/applications/organization` | List all applications (optional `?status=PENDING_REVIEW`) | ✅ |
| GET | `/api/applications/organization/:id` | Get single application details | ✅ |
| POST | `/api/applications/organization/:id/verify` | Approve or reject application | ✅ |

**Expected Request for POST /api/applications/organization (multipart/form-data):**
```
Fields:
- name (required)
- registrationNumber (required)
- type (required): COOPERATIVE|NGO|MFI|INSURANCE_COMPANY|GOVERNMENT|OTHER
- contactFirstName (required)
- contactLastName (required)
- contactEmail (required)
- contactPhone (required)
- county (optional)
- estimatedFarmers (optional)
- website (optional)
- description (optional)

Files:
- businessRegistrationCert (optional, max 10MB, PDF/JPEG/PNG)
- taxPinCert (optional, max 10MB, PDF/JPEG/PNG)
```

**Expected Response:**
```json
{
  "id": "app_123",
  "name": "Organization Name",
  "registrationNumber": "REG-123",
  "type": "COOPERATIVE",
  "contactFirstName": "John",
  "contactLastName": "Doe",
  "contactEmail": "john@example.com",
  "contactPhone": "+254712345678",
  "status": "PENDING_REVIEW",
  "businessRegistrationCertUrl": "/uploads/cert-123.pdf",
  "businessRegistrationCertName": "original-filename.pdf",
  "taxPinCertUrl": "/uploads/tax-123.pdf",
  "taxPinCertName": "original-filename.pdf",
  "createdAt": "2025-01-28T10:00:00Z",
  "updatedAt": "2025-01-28T10:00:00Z"
}
```

**Expected Request for POST /api/applications/organization/:id/verify:**
```json
{
  "status": "APPROVED",  // or "REJECTED"
  "reviewNotes": "Optional notes"
}
```

### Invitations

| Method | Endpoint | Purpose | Frontend Ready |
|--------|----------|---------|----------------|
| POST | `/api/invitations` | Create new invitation | ✅ |
| POST | `/api/invitations/:id/send` | Send invitation email | ✅ |
| GET | `/api/invitations` | List all invitations (optional `?organizationId=...&status=...`) | ✅ |
| GET | `/api/invitations/validate/:token` | Validate invitation token (public) | ✅ |
| POST | `/api/invitations/accept` | Accept invitation and set password (public) | ✅ |

**Expected Request for POST /api/invitations:**
```json
{
  "organizationId": "org_123",
  "email": "admin@org.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Expected Response for GET /api/invitations:**
```json
{
  "data": [
    {
      "id": "inv_123",
      "organizationId": "org_123",
      "organizationName": "My Organization",
      "email": "admin@org.com",
      "firstName": "John",
      "lastName": "Doe",
      "status": "PENDING|SENT|ACCEPTED|EXPIRED",
      "token": "abc123",
      "tokenExpiresAt": "2025-02-28T10:00:00Z",
      "sentAt": "2025-01-28T10:00:00Z",
      "acceptedAt": null,
      "createdAt": "2025-01-28T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

**Expected Request for POST /api/invitations/accept:**
```json
{
  "token": "invitation-token-here",
  "password": "SecurePassword123!"
}
```

### Pending KYB Count

| Method | Endpoint | Purpose | Frontend Ready |
|--------|----------|---------|----------------|
| GET | `/api/kyb/pending-count` | Get count of pending applications (for sidebar badge) | ✅ |

**Expected Response:**
```json
{
  "count": 5
}
```

---

## 🔧 Frontend Pages Using These APIs

| Page | Route | APIs Used |
|------|-------|-----------|
| Login | `/login` | `api.login()` |
| Register Organization | `/register-organization` | `api.submitOrgApplication()` |
| Accept Invitation | `/accept-invitation/:token` | `api.validateInvitationToken()`, `api.acceptInvitation()` |
| Platform Dashboard | `/platform/dashboard` | `api.getPlatformStats()`, `api.getActivities()` |
| Organizations List | `/platform/organizations` | `api.getOrganizations()`, `api.adminCreateOrganization()` |
| KYB Review | `/platform/kyb-review` | `api.getOrgApplications()` |
| KYB Detail | `/platform/kyb-review/:id` | `api.getOrgApplication()`, `api.verifyKYB()` |
| Invitations | `/platform/invitations` | `api.getOrgInvitations()`, `api.sendOrgAdminInvitation()` |
| Org Dashboard | `/org/dashboard` | `api.getFinancialSummary()`, `api.getActivities()` |
| Farmers | `/org/farmers` | `api.getFarmers()`, `api.getFarmer()` |
| Policies | `/org/policies` | `api.getPolicies()`, `api.getPolicy()` |
| Payouts | `/org/payouts` | `api.getPayouts()` |

---

## 📋 Action Items for Backend Team

1. **Confirm these KYB endpoints are working:**
   - `POST /api/applications/organization` (multipart/form-data)
   - `GET /api/applications/organization`
   - `GET /api/applications/organization/:id`
   - `POST /api/applications/organization/:id/verify`

2. **Confirm these Invitation endpoints are working:**
   - `POST /api/invitations`
   - `POST /api/invitations/:id/send`
   - `GET /api/invitations` (should work without organizationId filter for platform admin)
   - `GET /api/invitations/validate/:token`
   - `POST /api/invitations/accept`

3. **Add pending count endpoint:**
   - `GET /api/kyb/pending-count` or similar for sidebar badge

4. **Verify response formats match the expected structures above**

---

## Testing Credentials

| Role | Email | Password |
|------|-------|----------|
| Platform Admin | admin@microcrop.com | Password123! |
| Org Admin (Kiambu) | admin@kiambucooperative.org | Password123! |
| Org Admin (Nakuru) | admin@nakurungo.org | Password123! |
