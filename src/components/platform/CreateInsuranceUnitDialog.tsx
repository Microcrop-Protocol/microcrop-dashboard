import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_COUNTRY_CODE,
  SUPPORTED_COUNTRY_CODES,
  countryOptions,
  level1Label,
  level2Label,
  marketOrNull,
  type CountryCode,
} from "@/lib/market";
import {
  CROP_SEASONS,
  UNIT_ACTUARIAL_FIELDS,
  blankUnitForm,
  livestockUnitsOffered,
  seasonHeading,
  swapUnitDefaults,
  unitCodeHint,
  unitCodePlaceholder,
  unitCodePrefixError,
} from "@/lib/insurance-unit-market";

// Optional numeric input — an empty box becomes undefined rather than NaN, so "required" is
// reported as such instead of "Expected number, received nan".
const optionalNumber = z
  .union([z.number(), z.nan()])
  .optional()
  .transform((v) => (v === undefined || Number.isNaN(v) ? undefined : v));

const createInsuranceUnitSchema = z
  .object({
    // The COLUMN names stay `county` / `subCounty` in every market — renaming live columns is
    // destructive and buys nothing. Only the LABELS are per-market (Kenya: County/Sub-County,
    // Ghana: Region/District).
    county: z.string().min(2),
    subCounty: z.string().optional(),
    unitCode: z.string().trim().min(2, "Unit code is required"),
    /**
     * A SELECT, not free text. It was `z.string().min(2).max(2)`, which accepted "XX" — and
     * since the backend now validates it against the market registry, a typo'd code is a 400
     * the operator has no way to anticipate from a bare text box.
     */
    country: z.enum(SUPPORTED_COUNTRY_CODES as unknown as [CountryCode, ...CountryCode[]]),
    bboxMinLon: optionalNumber,
    bboxMinLat: optionalNumber,
    bboxMaxLon: optionalNumber,
    bboxMaxLat: optionalNumber,
    // Livestock terms. Optional in the shape because a market with no livestock product has no
    // terms to give; required below for every market that does.
    ndviBaselineLRLD: optionalNumber,
    ndviBaselineSRSD: optionalNumber,
    strikeLevelLRLD: optionalNumber,
    strikeLevelSRSD: optionalNumber,
    premiumRateLRLD: optionalNumber,
    premiumRateSRSD: optionalNumber,
    valuePerTLU: optionalNumber,
  })
  .superRefine((data, ctx) => {
    const prefixError = unitCodePrefixError(data.country, data.unitCode);
    if (prefixError) ctx.addIssue({ code: z.ZodIssueCode.custom, message: prefixError, path: ["unitCode"] });

    if (!livestockUnitsOffered(data.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "This market has no livestock product, so no insurance unit can be created for it.",
        path: ["country"],
      });
    } else {
      const ratio = (v: number | undefined) => v !== undefined && v >= 0 && v <= 1;
      for (const field of UNIT_ACTUARIAL_FIELDS) {
        const value = data[field];
        if (value === undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: [field] });
        } else if (field.startsWith("ndvi") || field.startsWith("strike")) {
          if (!ratio(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be between 0 and 1", path: [field] });
        } else if (field === "valuePerTLU" ? value < 100 : value <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: field === "valuePerTLU" ? "Must be at least 100" : "Must be greater than 0",
            path: [field],
          });
        }
      }
    }

    const coords = [data.bboxMinLon, data.bboxMinLat, data.bboxMaxLon, data.bboxMaxLat];
    const provided = coords.filter((c) => c !== undefined);
    if (provided.length === 0) return; // bbox is optional

    if (provided.length < 4) {
      // Flag every empty box so the user knows all four are required together.
      const fields = ["bboxMinLon", "bboxMinLat", "bboxMaxLon", "bboxMaxLat"] as const;
      fields.forEach((f, i) => {
        if (coords[i] === undefined) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required", path: [f] });
        }
      });
      return;
    }

    const [minLon, minLat, maxLon, maxLat] = coords as number[];
    const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

    if (!inRange(minLon, -180, 180))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Lon must be -180…180", path: ["bboxMinLon"] });
    if (!inRange(maxLon, -180, 180))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Lon must be -180…180", path: ["bboxMaxLon"] });
    if (!inRange(minLat, -90, 90))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Lat must be -90…90", path: ["bboxMinLat"] });
    if (!inRange(maxLat, -90, 90))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Lat must be -90…90", path: ["bboxMaxLat"] });
    if (minLon >= maxLon)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Min lon must be < max lon", path: ["bboxMaxLon"] });
    if (minLat >= maxLat)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Min lat must be < max lat", path: ["bboxMaxLat"] });
  });

type FormInput = z.input<typeof createInsuranceUnitSchema>;
type FormData = z.output<typeof createInsuranceUnitSchema>;
type NumericField = Exclude<keyof FormInput, "county" | "subCounty" | "unitCode" | "country">;

// The payload handed to the parent — bbox assembled into the [minLon, minLat,
// maxLon, maxLat] array the API expects (omitted entirely when not provided).
export interface CreateInsuranceUnitPayload {
  county: string;
  subCounty?: string;
  unitCode: string;
  country: string;
  bbox?: number[];
  ndviBaselineLRLD: number;
  ndviBaselineSRSD: number;
  strikeLevelLRLD: number;
  strikeLevelSRSD: number;
  premiumRateLRLD: number;
  premiumRateSRSD: number;
  valuePerTLU: number;
}

interface Props {
  onSubmit: (data: CreateInsuranceUnitPayload) => Promise<void>;
  isLoading?: boolean;
}

/** Blank form for a market — see blankUnitForm. */
const blankForm = (country: CountryCode): FormInput => blankUnitForm(country);

// Parse a numeric input, mapping empty -> undefined.
const parseNumber = (value: string) => (value === "" ? undefined : parseFloat(value));

function NumberField({
  control,
  name,
  label,
  step = "any",
}: {
  control: Control<FormInput>;
  name: NumericField;
  label: string;
  step?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              step={step}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value === undefined || Number.isNaN(field.value) ? "" : field.value}
              onChange={(e) => field.onChange(parseNumber(e.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CreateInsuranceUnitDialog({ onSubmit, isLoading }: Props) {
  const [open, setOpen] = useState(false);

  const form = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(createInsuranceUnitSchema),
    defaultValues: blankForm(DEFAULT_COUNTRY_CODE),
  });

  const selectedCountry = form.watch("country") as CountryCode;
  const market = marketOrNull(selectedCountry);
  const livestockOffered = livestockUnitsOffered(selectedCountry);
  // Null market cannot happen here — the field is a select over the registry — but the label
  // stays honest either way rather than naming a currency.
  const currencyCode = market?.currency ?? "local currency";

  // Market-specific defaults follow the market. The 0.45/0.35/1,500/15,000 pre-fill is Kenyan
  // (the last two in KES): switching away clears each field still holding a default, switching
  // back restores it, and a figure the operator typed is kept either way.
  const previousCountry = useRef<CountryCode>(selectedCountry);
  useEffect(() => {
    const from = previousCountry.current;
    if (from === selectedCountry) return;
    previousCountry.current = selectedCountry;
    const changes = swapUnitDefaults(form.getValues(), from, selectedCountry);
    for (const [field, value] of Object.entries(changes)) {
      form.setValue(field as NumericField, value as number | undefined, { shouldDirty: true });
    }
  }, [selectedCountry, form]);

  const handleSubmit = async (data: FormData) => {
    const { bboxMinLon, bboxMinLat, bboxMaxLon, bboxMaxLat, subCounty, ...rest } = data;
    const bbox =
      bboxMinLon !== undefined && bboxMinLat !== undefined && bboxMaxLon !== undefined && bboxMaxLat !== undefined
        ? [bboxMinLon, bboxMinLat, bboxMaxLon, bboxMaxLat]
        : undefined;
    const trimmedSubCounty = subCounty?.trim();

    try {
      // The superRefine above guarantees every livestock term is present for a market that
      // sells livestock, and refuses every other market — so these are numbers here.
      //
      // Empty OPTIONAL fields are omitted, not sent blank: the backend's validator refuses
      // `subCounty: ''` (it is optional, not allowed-empty), so a unit with no sub-county failed
      // to save. Same for bbox, which is either all four corners or absent.
      await onSubmit({
        ...(rest as Omit<CreateInsuranceUnitPayload, "bbox" | "subCounty">),
        ...(trimmedSubCounty ? { subCounty: trimmedSubCounty } : {}),
        ...(bbox ? { bbox } : {}),
      });
      setOpen(false);
      // The next unit is most likely in the same market: keep the country, reset the rest to
      // that market's defaults.
      form.reset(blankForm(data.country));
    } catch {
      // Error is handled by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Insurance Unit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Insurance Unit</DialogTitle>
          <DialogDescription>
            A geographic unit the livestock forage index is computed over, with its seasonal
            NDVI baseline, strike level and premium rate per TLU.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger aria-label="Country">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {countryOptions({ includeHidden: true }).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Code</FormLabel>
                    <FormControl>
                      <Input placeholder={unitCodePlaceholder(selectedCountry)} {...field} />
                    </FormControl>
                    <FormDescription>{unitCodeHint(selectedCountry)}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!livestockOffered && market && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-md border border-info/30 bg-info/10 p-3 text-sm"
              >
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                <div className="space-y-1">
                  <p>
                    Livestock cover is not offered in {market.countryName}, so an insurance unit
                    cannot be created there. Units carry livestock (forage-NDVI, per-TLU) terms only.
                  </p>
                  {(CROP_SEASONS[selectedCountry]?.length ?? 0) > 0 && (
                    <p className="text-muted-foreground">
                      {market.countryName} crop seasons:{" "}
                      {CROP_SEASONS[selectedCountry]?.map((s) => s.name).join("; ")}.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="county"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{level1Label(market)}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subCounty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{level2Label(market)} (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 rounded-md border p-4 bg-muted/20">
              <div>
                <h4 className="font-medium text-sm">Bounding Box (Optional)</h4>
                <p className="text-xs text-muted-foreground">
                  Geographic extent for the NDVI oracle, in decimal degrees. Leave blank or provide
                  all four corners.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <NumberField control={form.control} name="bboxMinLon" label="Min Longitude" />
                <NumberField control={form.control} name="bboxMinLat" label="Min Latitude" />
                <NumberField control={form.control} name="bboxMaxLon" label="Max Longitude" />
                <NumberField control={form.control} name="bboxMaxLat" label="Max Latitude" />
              </div>
            </div>

            {livestockOffered && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {(["LRLD", "SRSD"] as const).map((season) => (
                    <div key={season} className="space-y-4 rounded-md border p-4 bg-muted/20">
                      <h4 className="font-medium text-sm">{seasonHeading(selectedCountry, season)}</h4>
                      <NumberField control={form.control} name={`ndviBaseline${season}`} label="NDVI Baseline" step="0.01" />
                      <NumberField control={form.control} name={`strikeLevel${season}`} label="Strike Level" step="0.01" />
                      <NumberField
                        control={form.control}
                        name={`premiumRate${season}`}
                        label={`Premium rate (${currencyCode}/TLU)`}
                      />
                    </div>
                  ))}
                </div>

                <NumberField control={form.control} name="valuePerTLU" label={`Value per TLU (${currencyCode})`} />
              </>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !livestockOffered}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Unit
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
