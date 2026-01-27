
# MicroCrop Dashboard - Implementation Plan

A comprehensive multi-tenant B2B platform for parametric crop insurance in Africa, featuring two distinct portal experiences: Platform Admin and Organization Admin/Staff.

---

## 🎨 Design System

**Theme**: Professional agriculture-inspired green palette
- **Primary**: Green (#16a34a) for CTAs, active states, success indicators
- **Accent**: Blue (#2563eb) for links and secondary actions
- **Status Colors**: Green (approved/active), Yellow (pending), Red (failed/rejected), Gray (expired/inactive)
- **Dark Mode**: Full support with theme toggle in header
- **Layout**: Responsive sidebar navigation that collapses on mobile

---

## 🔐 Authentication System

### Login Page
- Email & password form with validation
- Error handling for invalid credentials
- Redirect based on user role after login

### Auth Flow
- JWT token management with refresh token support
- Protected route wrapper for authenticated pages
- Role-based routing (Platform Admin → Platform views, Org Admin/Staff → Org views)
- Auto-logout on token expiration

---

## 📊 Platform Admin Portal

### Platform Dashboard (`/platform/dashboard`)
- **KPI Cards** (6 cards in responsive grid):
  - Total Organizations (with active count)
  - Total Farmers
  - Active Policies (with new this period)
  - Total Revenue
  - Premiums Collected
  - Payouts Sent
- **Date Range Picker**: Presets (Today, 7D, 30D, 90D, 1Y) + custom range
- **Mini Activity Feed**: Recent 5 platform events
- **Alert Banners**: Failed payouts, expiring policies warnings

### Organizations Management (`/platform/organizations`)
- **Searchable Data Table**: Name, Type, Status badge, Farmers, Policies, Payouts, Users, Created
- **Filters**: Type dropdown, Active/Inactive toggle, Search input
- **Pagination**: Page controls with configurable limit
- **Row Click**: Navigate to org deep-dive

### Organization Deep-Dive (`/platform/organizations/[orgId]`)
- **Header**: Org name, type badge, active status
- **KPI Row**: Farmers, Policies, Premiums, Payouts, Fees, Loss Ratio
- **Charts Grid**:
  - Farmers by KYC Status (pie chart)
  - Policies by Status (pie chart)
  - Policies by Coverage Type (bar chart)
  - Payouts by Status (bar chart)
- **Tables**: Recent Policies (5 rows), Recent Payouts (5 rows)
- **Onboarding Stepper**: 6-step checklist (Registered → Configured → Pool Deployed → Funded → Staff Invited → Activated)

### Platform Analytics Suite
All analytics pages share: Date Range Picker + Granularity Selector (Daily/Weekly/Monthly)

**Revenue Analytics** (`/platform/analytics/revenue`)
- Summary KPIs
- Stacked area chart: Fees, Premiums, Payouts over time
- Horizontal bar: Revenue by Organization

**Policies Analytics** (`/platform/analytics/policies`)
- Policies created over time (line chart)
- Status breakdown (donut chart)
- Coverage type breakdown (bar chart)
- Claims ratio display

**Farmers Analytics** (`/platform/analytics/farmers`)
- Farmer registrations over time
- KYC status breakdown (donut)
- Distribution by county (horizontal bar)

**Payouts Analytics** (`/platform/analytics/payouts`)
- Payouts over time (dual axis: count + amount)
- Status breakdown (donut)
- Success rate indicator

**Damage Analytics** (`/platform/analytics/damage`)
- Summary stats (avg weather/satellite/combined scores)
- Trigger rate display
- Paginated assessments table

### Platform Activity Log (`/platform/activity`)
- Full activity feed with filtering
- Icon per activity type
- Relative timestamps

---

## 🏢 Organization Portal

### Org Dashboard (`/org/dashboard`)
- **KPI Cards**: Total Farmers, Active Policies, New Policies, Premiums, Payouts, Fees
- **Pool Address**: Truncated link to Base block explorer
- **Mini Activity Feed**: Recent org events

### Farmers Management (`/org/farmers`)
- **Data Table**: Name, Phone, National ID, County, KYC Status badge, Plots, Policies, Created
- **Filters**: KYC Status, County, Search
- **Row Actions**: View, Edit KYC
- **Bulk Export**: CSV download button
- **KYC Status Badges**: Pending (yellow), Approved (green), Rejected (red)

### Farmer Detail (`/org/farmers/[farmerId]`)
- Farmer profile information
- Associated plots list
- Policy history
- KYC status management

### Farmer Import (`/org/farmers/import`)
- **Two-Tab Interface**:
  - Import Farmers: JSON textarea or CSV upload, validation preview, results summary
  - Import Plots: Same pattern, links by farmer phone
- **Validation**: Client-side validation before submit
- **Results Display**: Imported (green), Skipped (yellow), Errors table (red)
- **Limit**: Max 500 items per import

### Policies Dashboard (`/org/policies`)
- **Status Breakdown**: Horizontal bar/stat cards (Active, Expired, Cancelled, Claimed)
- **Coverage Type Distribution**: Pie chart
- **Crop Type Distribution**: Bar chart
- **Expiring Soon Table**: Policies expiring within 14 days
- **Recently Activated Table**

### New Policy Flow (`/org/policies/new`)
- **Step 1 - Quote**:
  - Farmer selection
  - Plot selection
  - Sum insured input
  - Coverage type select (Drought, Flood, Both)
  - Duration slider (30-365 days)
  - Premium breakdown display
- **Step 2 - Purchase**:
  - Confirm button
  - Payment instructions with M-Pesa details

### Policy Detail (`/org/policies/[policyId]`)
- Policy information
- Farmer & plot details
- Damage assessments
- Payout history
- Cancel policy action (with reason dialog)

### Payouts Dashboard (`/org/payouts`)
- **Summary KPIs**: Total Amount, Avg Amount, Count, Success Rate
- **Status Breakdown**: Bar chart
- **Time-Series Chart**: Payouts over time
- **Pending Payouts Table**: With individual retry buttons
- **Failed Payouts Table**: Individual retry + "Retry All Failed" bulk action

### Payout Reconciliation (`/org/payouts/reconciliation`)
- Status breakdown summary
- Date range filtering
- Totals display

### Plots Dashboard (`/org/plots`)
- **Two-Panel Layout**:
  - **Left**: Interactive Mapbox map with plot markers, popups showing: plot name, farmer, crop, acreage, latest NDVI, weather
  - **Right**: Data table with columns: Plot Name, Farmer, Crop, Acreage, Policies, Latest NDVI, Latest Temp
- **Filter**: Crop type dropdown
- **Crop Distribution Chart**: Count + total acreage per crop

### Damage Assessments (`/org/damage`)
- **Split View**:
  - **Left**: Paginated table (policy number, combined damage %, triggered status, date)
  - **Right**: Damage heatmap on Mapbox
- **Color Coding**: 0-30% green (healthy), 30-60% yellow (moderate), 60-100% red (severe)
- **Map Interaction**: Click point for popup with details

### Financials (`/org/financials`)
- **Period KPIs**: Premiums, Payouts, Fees, Loss Ratio, Avg Premium, Policy Count
- **Stacked Area Chart**: Premiums vs Payouts over time
- **All-Time Totals**: Summary row
- **Loss Ratio Visualization**: Color-coded (<0.5 green, 0.5-0.8 yellow, >0.8 red)

### Liquidity Pool (`/org/pool`)
- Pool address (linked to Base block explorer)
- Balance (large number display)
- Utilization rate (progress bar/gauge)
- Breakdown cards: Capital Deposited, Premiums Received, Payouts Sent, Fees Paid
- Available for Withdrawal calculation

### Staff Management (`/org/staff`)
- **Staff Table**: Name, Email, Role badge, Active Status, Last Login
- **Invite Staff Dialog**: Email, First/Last Name, Phone, Role select
- **Row Actions**: Change Role, Deactivate/Reactivate
- **Role Badges**: ORG_ADMIN (purple), ORG_STAFF (blue)

### Data Export (`/org/export`)
- **4 Export Cards**: Farmers, Policies, Payouts, Transactions
- Each card: Description, Date range picker, Download CSV button
- Direct browser download

### Org Activity Log (`/org/activity`)
- Full activity feed for organization

---

## 🧩 Reusable Components

- **StatCard**: Title, value, subtitle, trend arrow, icon
- **StatusBadge**: Color-coded status labels
- **DateRangePicker**: Presets + custom range selector
- **GranularitySelect**: Daily/Weekly/Monthly toggle
- **DataTable**: TanStack Table wrapper with pagination, sorting, filtering, loading/empty states
- **ActivityFeed**: Icon per type, relative timestamps
- **PlotMap**: Mapbox integration with markers and popups
- **DamageHeatmap**: Color-coded map visualization
- **TimeSeriesChart**: Recharts area/line charts
- **PieChart**: Donut/pie visualizations
- **BarChart**: Horizontal and vertical bar charts

---

## 🛠 Technical Architecture

### State Management
- Zustand for auth state (user, tokens)
- Zustand for org context (current organization)
- React Query for server state and caching

### API Layer
- Mock data service matching API response schemas
- Easy swap to real API when backend is ready
- Axios-style interceptor pattern for auth headers

### Routing
- React Router with nested layouts
- Protected route guards
- Role-based route access

### Forms
- React Hook Form for all forms
- Zod schemas for validation
- Error display and success toasts

---

## 📱 Responsive Design

- Sidebar collapses to hamburger menu on mobile
- KPI cards: 4 columns → 2 columns → 1 column
- Charts stack vertically on small screens
- Tables switch to card view on mobile
- Touch-friendly interactions

---

## ⚡ UX Polish

- **Loading States**: Skeleton loaders for cards/tables, spinners for submissions
- **Empty States**: Friendly illustrations with action prompts
- **Toast Notifications**: Success/error for all mutations
- **Dark Mode**: Full theme support with system preference detection
- **Animations**: Subtle transitions for better feel
