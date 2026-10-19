/**
 * ORGANIZATION — the market this organization operates in, and what follows from it.
 *
 * WHY THIS SCREEN EXISTS. The country code is the single most consequential field on an
 * organization: it picks the currency every figure in the product is denominated in, the
 * sum-insured bounds the purchase transaction enforces, the payment provider premiums are
 * collected through, the insurance regulator whose licence is demanded, and the KYB
 * required-document set. Until now it was invisible — never asked at signup (so every
 * self-signup organization was silently Kenyan) and never displayed afterwards. A partner had no
 * way to notice it was wrong, and a wrong one is not a cosmetic problem: it is the wrong currency
 * on real money and the wrong regulator on a compliance gate.
 *
 * IT IS READ-ONLY, AND THAT IS THE CORRECT ANSWER RATHER THAN A SHORTCUT. Changing it after
 * policies exist would re-denominate cover already sold — the premium and sum insured are stored
 * as plain Decimals with no currency column, so re-pointing the market silently reinterprets
 * every historical figure. There is no backend endpoint to change it and there should not be a
 * self-service one; the contact route is the honest control.
 *
 * `useOrgMarket` is three-valued, so an unrecognised or unreadable country renders as exactly
 * that rather than defaulting to Kenya on a screen whose whole purpose is to show the truth.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrgMarket } from '@/hooks/useOrgMarket';
import { formatMoney } from '@/lib/market';
import { AlertTriangle, Globe } from 'lucide-react';

/** What a hidden market shows for premium collection: it has no confirmed rail yet. */
const HIDDEN_MARKET_RAIL = 'Not yet available';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-56 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function OrgMarketPanel() {
  const { state, market, countryCode, organization } = useOrgMarket();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Organization</h2>
        <p className="text-sm text-muted-foreground">
          Your registered details and the market they put you in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered details</CardTitle>
        </CardHeader>
        <CardContent>
          {state === 'loading' ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-5 w-72" />
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-56" />
            </div>
          ) : (
            <dl className="divide-y">
              <Row label="Organization name" value={organization?.name ?? '—'} />
              <Row
                label="Company registration number"
                value={
                  organization?.registrationNumber ?? (
                    // Not an error: it moved to KYB, so a new organization has none yet. Saying
                    // so beats an em dash, which reads as missing data.
                    <span className="font-normal text-muted-foreground">
                      Submitted with your verification
                    </span>
                  )
                }
              />
              <Row
                label="Type"
                value={
                  organization?.type && organization.type !== 'OTHER'
                    ? organization.type.charAt(0) + organization.type.slice(1).toLowerCase()
                    : <span className="font-normal text-muted-foreground">Not stated</span>
                }
              />
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" aria-hidden="true" />
            Market
          </CardTitle>
          <CardDescription>
            Your market sets your currency, your premium limits, how premiums are collected, and
            which regulator's licence your verification requires. It is set by MicroCrop — contact
            us if it is wrong, because changing it affects how existing cover is read.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state === 'loading' ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-56" />
            </div>
          ) : state === 'unknown' || !market ? (
            <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">
                  We couldn't determine your market
                </p>
                <p className="mt-1">
                  {countryCode
                    ? `Your organization is recorded as "${countryCode}", which this version of the dashboard does not recognise. Money figures are shown without a currency rather than guessing at one.`
                    : 'Your organization has no country recorded. Money figures are shown without a currency rather than guessing at one. Contact MicroCrop to have it set.'}
                </p>
              </div>
            </div>
          ) : (
            <dl className="divide-y">
              <Row
                label="Country"
                value={
                  <span className="flex items-center gap-2">
                    {market.countryName}
                    <Badge variant="outline" className="text-xs font-normal">
                      {market.countryCode}
                    </Badge>
                  </span>
                }
              />
              <Row
                label="Currency"
                value={`${market.currency} (${market.currencySymbol})`}
              />
              {/* A hidden market has no confirmed collect-and-pay rail yet (NG's BANK is a placeholder),
                  so its configured networks are not shown as if premiums could be collected. */}
              <Row
                label="Premium collection"
                value={market.signupOpen ? market.mobileMoneyLabel : HIDDEN_MARKET_RAIL}
              />
              <Row
                label="Mobile money networks"
                value={market.signupOpen ? market.mobileMoneyNetworks.join(', ') : HIDDEN_MARKET_RAIL}
              />
              <Row label="Insurance regulator" value={market.regulator} />
              <Row label="Phone number format" value={market.phoneExample} />
              <Row
                label={`${market.adminDivisionLabels.level1} / ${market.adminDivisionLabels.level2}`}
                value={organization?.county ?? <span className="font-normal text-muted-foreground">Not set</span>}
              />
              <Row
                label="Sum insured per policy"
                value={
                  <span>
                    {formatMoney(market.minSumInsuredLocal, market)} –{' '}
                    {formatMoney(market.maxSumInsuredLocal, market)}
                    {/*
                      Named as a guide, not a rule, because it is: policy.service asserts the
                      bounds inside the purchase transaction and its answer is the one that
                      counts. Presenting a mirrored limit as authoritative is how a dashboard
                      ends up disagreeing with a refusal.
                    */}
                    <span className="ml-2 font-normal text-muted-foreground">
                      (guide — the limit is applied when you buy)
                    </span>
                  </span>
                }
              />
              {!market.livestockEnabled && (
                <Row
                  label="Livestock (IBLI)"
                  value={
                    <span className="font-normal text-muted-foreground">
                      Not available in {market.countryName} — crop cover only
                    </span>
                  }
                />
              )}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
