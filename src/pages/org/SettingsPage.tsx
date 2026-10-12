/**
 * SETTINGS — the organization's own administrative surface, with Verification (KYB) inside it.
 *
 * WHY KYB MOVED HERE. It was a top-level "Verification" nav item, which framed it as a one-time
 * step on the way in. It is not: a partner returns to it after a rejection, when a reviewer asks
 * for a clearer scan, and every time its regulator licence approaches expiry — and a lapsed
 * licence stops underwriting, so the surface has to be somewhere a partner looks at an
 * organization rather than somewhere they remember from signup. Settings is that place, and it
 * also gives the market and the plan — the two other things that are properties of the
 * organization rather than of any record in it — somewhere to live.
 *
 * TABS ARE ROUTES, not component state. `/org/settings/verification` is linkable, survives a
 * reload, and is what a support reply can paste. A `useState` tab index would make every one of
 * those a wrong answer, and MicroCrop's own support flow is "go to Settings → Verification".
 *
 * `/org/kyb` STILL WORKS. It is the destination the signup flow navigates to, it is in partners'
 * bookmarks, and it is in emails the backend has already sent. It redirects here rather than
 * 404ing — see App.tsx.
 *
 * ORG_ADMIN ONLY, enforced on the route. Verification submits company identity documents and
 * Plan shows commercial terms; neither is a Viewer's business, and the backend's POST
 * /organizations/me/kyb is itself `authorize('ORG_ADMIN')`, so a lesser role would be offered a
 * form the server refuses.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrgVerificationPanel } from '@/components/settings/OrgVerificationPanel';
import { OrgMarketPanel } from '@/components/settings/OrgMarketPanel';
import { OrgPlanPanel } from '@/components/settings/OrgPlanPanel';

const TABS = ['verification', 'organization', 'plan'] as const;
type SettingsTab = (typeof TABS)[number];

const DEFAULT_TAB: SettingsTab = 'verification';

function isSettingsTab(value: string | undefined): value is SettingsTab {
  return typeof value === 'string' && (TABS as readonly string[]).includes(value);
}

export default function SettingsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();

  // An unrecognised tab segment resolves to the default rather than rendering nothing. A typo'd
  // or stale URL should land somewhere useful, and Verification is the one a partner is most
  // likely to have been sent to.
  const active: SettingsTab = isSettingsTab(tab) ? tab : DEFAULT_TAB;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Verification, your market, and what your plan includes.
        </p>
      </div>

      <Tabs
        value={active}
        // `replace` so switching tabs does not stack history entries — otherwise Back from
        // Settings walks through every tab the partner looked at before leaving the page.
        onValueChange={(value) => navigate(`/org/settings/${value}`, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="plan">Plan &amp; features</TabsTrigger>
        </TabsList>

        {/*
          Each panel owns its own queries, and Radix unmounts an inactive TabsContent — so only
          the active tab's requests are in flight. That is deliberate: mounting all three would
          fire the capability, organization and KYB reads on every visit to any tab.
        */}
        <TabsContent value="verification" className="mt-6">
          <OrgVerificationPanel />
        </TabsContent>
        <TabsContent value="organization" className="mt-6">
          <OrgMarketPanel />
        </TabsContent>
        <TabsContent value="plan" className="mt-6">
          <OrgPlanPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
