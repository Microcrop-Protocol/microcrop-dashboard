import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, CircleDashed, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { KybChecklistItem } from "@/types";

function ChecklistRow({ item }: { item: KybChecklistItem }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {item.satisfied ? (
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
      ) : (
        <CircleDashed className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      )}
      <span>{item.label}</span>
      <span className="text-xs text-muted-foreground">
        {item.satisfied ? "provided" : "missing"}
      </span>
    </li>
  );
}

/**
 * The organization's per-market required-document checklist, as the server builds it
 * (`GET /platform/organizations/:orgId/kyb`). Fetched only when opened: the review list can be
 * long and the checklist is a second request per card.
 */
export function KybChecklistPanel({
  orgId,
  expectedCountryCode,
}: {
  orgId: string;
  /** The country on the review item, to flag a checklist built for a different market. */
  expectedCountryCode: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["org-kyb", orgId],
    queryFn: () => api.getOrgKyb(orgId),
    enabled: open,
  });

  const checklist = data?.checklist;
  const checklistCountry = checklist?.countryCode?.trim().toUpperCase() || null;
  const expected = expectedCountryCode?.trim().toUpperCase() || null;
  // A checklist built for a market the review card does not name is a disagreement either way:
  // a DIFFERENT market, or a market on the checklist while the card has none on file. The backend
  // falls back to a default market for an org with no country, so the second case is real.
  const mismatch = Boolean(checklist && checklistCountry && checklistCountry !== expected);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2 gap-1">
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
          Required documents for this market
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading checklist" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">We couldn't load this organization's checklist.</p>
        ) : !checklist ? (
          <p className="text-sm text-muted-foreground">The server returned no checklist for this organization.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {checklist.countryCode} · licensed by {checklist.regulator}
              {checklist.regulatorLicenseRequired ? " (licence required)" : ""}
            </p>
            {mismatch && (
              <p role="alert" className="text-sm text-destructive">
                {expected
                  ? `This checklist is for ${checklistCountry}, but the organization is listed under ${expected}.`
                  : `This checklist is for ${checklistCountry}, but the organization has no market on file.`}{" "}
                Resolve the organization's market before approving.
              </p>
            )}
            <ul className="space-y-1">
              {checklist.requiredDocuments.map((item) => (
                <ChecklistRow key={item.documentCode ?? item.documentType} item={item} />
              ))}
            </ul>
            {checklist.optionalDocuments.length > 0 && (
              <>
                <p className="pt-1 text-xs font-medium text-muted-foreground">Optional</p>
                <ul className="space-y-1">
                  {checklist.optionalDocuments.map((item) => (
                    <ChecklistRow key={item.documentCode ?? item.documentType} item={item} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
