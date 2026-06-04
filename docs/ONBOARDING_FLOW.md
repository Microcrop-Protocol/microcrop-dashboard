# MicroCrop Onboarding Flow — Complete Field Reference

Full journey from organization registration to policy purchase.

> **Key concept:** There is no separate "create wallet" step. The org's Privy wallet is
> created automatically when the pool is deployed. All org wallet transactions are
> gas-sponsored (no ETH needed).

```
REGISTER ORG → KYB REVIEW → ACCEPT INVITATION → DEPLOY POOL (creates wallet) → FUND WALLET → DEPOSIT → REGISTER FARMERS → ADD PLOTS → PURCHASE POLICY
```

---

## Step 1: Organization Registration (KYB Application)

> Route: `/apply` — Public form, no login required

### 1a. Organization Details

| Field                | Required | Rules                                                                 | Example                   |
|----------------------|----------|-----------------------------------------------------------------------|---------------------------|
| `name`               | Yes      | 2–100 characters                                                      | `Green Fields Cooperative`|
| `registrationNumber` | Yes      | 1–50 characters                                                       | `CPV-2024-001234`         |
| `type`               | Yes      | `COOPERATIVE` / `NGO` / `MFI` / `INSURANCE_COMPANY` / `GOVERNMENT` / `OTHER` | `COOPERATIVE`     |

### 1b. Contact Person

| Field              | Required | Rules                                              | Example                    |
|--------------------|----------|----------------------------------------------------|----------------------------|
| `contactFirstName` | Yes      | 2–50 characters                                    | `James`                    |
| `contactLastName`  | Yes      | 2–50 characters                                    | `Mwangi`                   |
| `contactEmail`     | Yes      | Valid email                                        | `james@sunrise.co.ke`      |
| `contactPhone`     | Yes      | Kenyan format: `+254...`, `07...`, or `01...`      | `+254711223344`            |

### 1c. KYB Documents (2 required)

| Document                        | Format          | Max Size |
|---------------------------------|-----------------|----------|
| Business Registration Certificate | PDF, JPEG, PNG | 5 MB     |
| Tax PIN Certificate               | PDF, JPEG, PNG | 5 MB     |

### 1d. Review & Submit

Summary screen — user confirms all info, then submits. Status becomes `PENDING_REVIEW`.

---

## Step 2: KYB Verification (Platform Admin)

> Route: `/platform/kyb` — Platform admin reviews the application

| Field         | Required | Rules                          | Example                              |
|---------------|----------|--------------------------------|--------------------------------------|
| `status`      | Yes      | `APPROVED` or `REJECTED`       | `APPROVED`                           |
| `reviewNotes` | No       | Max 500 characters             | `All documents verified and valid.`  |

**On approval:** Organization is created with onboarding step `REGISTERED`.

---

## Step 3: Invitation & Admin Account Setup

> Platform admin sends invitation → contact person receives email → sets password

### 3a. Create & Send Invitation (Platform Admin)

| Field              | Required | Rules        | Example                    |
|--------------------|----------|--------------|----------------------------|
| `organizationId`   | Yes      | Existing org | `org1`                     |
| `email`            | Yes      | Valid email   | `james@sunrise.co.ke`      |
| `firstName`        | Yes      | String        | `James`                    |
| `lastName`         | Yes      | String        | `Mwangi`                   |

Token expires in **7 days**.

### 3b. Accept Invitation (Org Admin)

> Route: `/accept-invitation/:token`

| Field             | Required | Rules                                                                                     |
|-------------------|----------|-------------------------------------------------------------------------------------------|
| `password`        | Yes      | Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character (`!@#$%^&*(),.?":{}` etc.) |
| `confirmPassword` | Yes      | Must match password                                                                        |

**Result:** User account created with role `ORG_ADMIN`, can now log in.

---

## Step 4: Deploy Pool (creates wallet)

> Route: `/org/pool` — "Deploy Pool" dialog (shown when no pool exists)
>
> **This step also creates the org's Privy server wallet.** No separate wallet creation needed.

| Field                | Required       | Rules                                       | Example            |
|----------------------|----------------|---------------------------------------------|--------------------|
| `name`               | No             | 3–50 chars (defaults to org name)           | `Sunrise Pool`     |
| `symbol`             | No             | 2–10 uppercase letters only                 | `SNPOOL`           |
| `poolType`           | Yes            | `PRIVATE` / `PUBLIC` / `MUTUAL`             | `PRIVATE`          |
| `coverageType`       | Yes            | `DROUGHT` / `FLOOD` / `PEST` / `DISEASE` / `COMPREHENSIVE` | `COMPREHENSIVE` |
| `region`             | Yes            | 2–50 characters                             | `Nakuru County`    |
| `targetCapital`      | Yes            | Min 1,000 USDC                              | `500000`           |
| `maxCapital`         | Yes            | Min 1,000 USDC, >= targetCapital            | `1000000`          |
| `minDeposit`         | If PRIVATE     | Min 1 USDC                                  | `100`              |
| `maxDeposit`         | If PRIVATE     | Min 100 USDC, >= minDeposit                 | `100000`           |
| `memberContribution` | If MUTUAL      | Min 1 USDC                                  | `500`              |
| `poolOwner`          | No             | Valid Ethereum address (`0x...40 hex chars`) | `0xABC...`         |

**Pool types explained:**
- **Private** — Only whitelisted addresses deposit. Best for insurance companies.
- **Mutual** — Fixed member contribution. Best for cooperatives.
- **Public** — Open to anyone. Best for open investor pools.

**Response includes:** `poolAddress`, `walletAddress`, `privyWalletId`, `txHash`, `blockNumber`

---

## Step 5: Fund Wallet (M-Pesa)

> Route: `/org/pool` — "Fund via M-Pesa" button on the Wallet Card
>
> **Wallet must exist first** (created in Step 4 when pool was deployed).

| Field         | Required | Rules                                          | Example        |
|---------------|----------|-------------------------------------------------|----------------|
| `phoneNumber` | Yes      | Safaricom number, `07...` or `01...` (10 digits)| `0712345678`   |
| `amountKES`   | Yes      | 10 – 150,000 KES                                | `50000`        |

**Flow:**
1. Enter phone number + amount
2. M-Pesa STK push sent to your phone
3. Enter M-Pesa PIN to confirm
4. Provider converts KES → USDC → sends to org wallet (1–2 min)

**Wallet Card shows:**
- USDC balance
- Wallet address (copyable, with BaseScan link)

---

## Step 6: Deposit into Pool

> Route: `/org/pool` — "Deposit" button (after pool is deployed)

| Field          | Required | Rules                      | Example  |
|----------------|----------|----------------------------|----------|
| `amount`       | Yes      | 100 – 1,000,000 USDC      | `10000`  |
| `minTokensOut` | No       | Slippage protection        | —        |

**Result:** LP tokens minted to your wallet. Pool balance increases.

---

## Step 7: Register Farmers

### 7a. Individual Registration (API)

| Field        | Required | Rules                                         | Example            |
|--------------|----------|-----------------------------------------------|--------------------|
| `firstName`  | Yes      | String                                        | `John`             |
| `lastName`   | Yes      | String                                        | `Kamau`            |
| `phoneNumber`| Yes      | Kenyan format (`+254...`, `07...`, `01...`)   | `+254712345678`    |
| `nationalId` | Yes      | String                                        | `12345678`         |
| `county`     | Yes      | String                                        | `Nakuru`           |
| `subCounty`  | No       | String                                        | `Nakuru East`      |
| `ward`       | No       | String                                        | `Biashara`         |
| `village`    | No       | String                                        | `Kiamunyi`         |

### 7b. Bulk Import (JSON, max 500)

> Route: `/org/farmers/import` — "Import Farmers" tab

**JSON format:**
```json
[
  {
    "firstName": "John",
    "lastName": "Kamau",
    "phone": "+254712345678",
    "nationalId": "12345678",
    "county": "Nakuru"
  },
  {
    "firstName": "Mary",
    "lastName": "Wanjiku",
    "phone": "+254712345679",
    "nationalId": "23456789",
    "county": "Kiambu"
  }
]
```

### 7c. Farmer KYC Approval

Farmers start as `PENDING`. Admin reviews and sets status:

| Field    | Required | Rules                       |
|----------|----------|-----------------------------|
| `status` | Yes      | `APPROVED` or `REJECTED`    |
| `reason` | No       | Rejection reason (if any)   |

**Farmer must be `APPROVED` before purchasing a policy.**

---

## Step 8: Add Plots

> Route: `/org/farmers/import` — "Import Plots" tab

**JSON format (bulk, max 500):**
```json
[
  {
    "farmerPhone": "+254712345678",
    "name": "Kamau Farm Block A",
    "latitude": -0.3031,
    "longitude": 36.08,
    "acreage": 2.5,
    "cropType": "Maize"
  }
]
```

| Field         | Required | Rules                          | Example              |
|---------------|----------|--------------------------------|----------------------|
| `farmerPhone` | Yes      | Links plot to farmer by phone  | `+254712345678`      |
| `name`        | Yes      | Plot name                      | `Kamau Farm Block A` |
| `latitude`    | Yes      | Decimal degrees                | `-0.3031`            |
| `longitude`   | Yes      | Decimal degrees                | `36.08`              |
| `acreage`     | Yes      | Number                         | `2.5`                |
| `cropType`    | Yes      | String                         | `Maize`              |

---

## Step 9: Purchase Policy

> Route: `/org/policies/new` — 2-step form

### Step 9a. Configure Policy

| Field          | Required | Rules                                   | Example    |
|----------------|----------|-----------------------------------------|------------|
| `farmerId`     | Yes      | Must be KYC `APPROVED`                  | (dropdown) |
| `plotId`       | Yes      | Must belong to the selected farmer      | (dropdown) |
| `sumInsured`   | Yes      | Amount in KES                           | `150000`   |
| `coverageType` | Yes      | `DROUGHT` / `FLOOD` / `BOTH`           | `BOTH`     |
| `duration`     | Yes      | 30–365 days (slider, 30-day steps)      | `180`      |

**Cost calculation:**
```
Premium     = sumInsured x 5%
Platform Fee = premium x 5%
Total Cost   = premium + fee
```

**Example for KES 150,000 sum insured:**
```
Premium      = 150,000 x 0.05 = KES  7,500
Platform Fee =   7,500 x 0.05 = KES    375
Total Cost                     = KES  7,875
```

### Step 9b. Confirm & Pay

Payment via M-Pesa:
- Paybill: `123456`
- Account: `POLICY-NEW`

---

## Complete Flow Summary

| #  | Step                   | Who           | Onboarding Step   | Key Action                              |
|----|------------------------|---------------|-------------------|-----------------------------------------|
| 1  | Register Organization  | Applicant     | —                 | Submit KYB application + documents      |
| 2  | KYB Review             | Platform Admin| `REGISTERED`      | Approve/reject application              |
| 3  | Accept Invitation      | Org Admin     | —                 | Set password, gain dashboard access     |
| 4  | Deploy Pool            | Org Admin     | `POOL_DEPLOYED`   | Creates wallet + on-chain pool          |
| 5  | Fund Wallet            | Org Admin     | `FUNDED`          | M-Pesa KES → USDC in org wallet        |
| 6  | Deposit to Pool        | Org Admin     | —                 | Move USDC from wallet into pool         |
| 7  | Invite Staff           | Org Admin     | `STAFF_INVITED`   | Send dashboard access to team members   |
| 8  | Activate Org           | Platform Admin| `ACTIVATED`       | Mark org as fully operational           |
| 9  | Register Farmers       | Org Admin     | —                 | Individual or bulk JSON import          |
| 10 | Approve Farmer KYC     | Org Admin     | —                 | Verify farmer identity                  |
| 11 | Add Plots              | Org Admin     | —                 | Bulk JSON import with GPS coordinates   |
| 12 | Purchase Policy        | Org Admin     | —                 | Select farmer + plot, pay premium       |
