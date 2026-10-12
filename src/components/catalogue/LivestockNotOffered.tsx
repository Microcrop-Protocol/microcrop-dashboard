/**
 * The panel every livestock screen shows in a market that does not list livestock (Ghana).
 *
 * A PRODUCT BOUNDARY, not a plan boundary and not a fault, so it does not borrow either of those
 * panels' copy: "contact MicroCrop to enable it" would be a false promise, because there is no
 * livestock product in the market to enable. It states the fact, says it is not an account
 * setting, and says nothing about the future — a teaser is a commitment nobody has made.
 */
import { Ban } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LivestockNotOffered({ countryName }: { countryName: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ban className="h-4 w-4" aria-hidden="true" />
          Livestock cover is not offered in {countryName}
        </CardTitle>
        <CardDescription>
          MicroCrop offers crop cover only in {countryName}. There is no livestock product in this
          market, so there is nothing to enable — this is not a setting on your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Your crop underwriting, farmers and policies are unaffected.
      </CardContent>
    </Card>
  );
}
