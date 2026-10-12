import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
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
} from "@/lib/market";

// Optional numeric coordinate — empty input becomes undefined so the whole
// bounding box stays optional.
const optionalCoord = z
  .union([z.number(), z.nan()])
  .optional()
  .transform((v) => (v === undefined || Number.isNaN(v) ? undefined : v));

const createInsuranceUnitSchema = z
  .object({
    // The COLUMN names stay `county` / `subCounty` in every market — renaming live columns is
    // destructive and buys nothing. Only the LABELS are per-market (Kenya: County/Sub-County,
    // Ghana: Region/District), so the validation messages are built from the market too.
    county: z.string().min(2),
    subCounty: z.string().optional(),
    unitCode: z.string().min(2, "Unit Code is required (e.g., TURKANA or GH-AS-01)"),
    /**
     * A SELECT, not free text. It was `z.string().min(2).max(2)`, which accepted "XX" — and
     * since the backend now validates it against the market registry, a typo'd code is a 400
     * the operator has no way to anticipate from a bare text box.
     */
    country: z.enum(SUPPORTED_COUNTRY_CODES as unknown as [string, ...string[]]),
    bboxMinLon: optionalCoord,
    bboxMinLat: optionalCoord,
    bboxMaxLon: optionalCoord,
    bboxMaxLat: optionalCoord,
    ndviBaselineLRLD: z.number().min(0).max(1),
    ndviBaselineSRSD: z.number().min(0).max(1),
    strikeLevelLRLD: z.number().min(0).max(1),
    strikeLevelSRSD: z.number().min(0).max(1),
    premiumRateLRLD: z.number().min(0),
    premiumRateSRSD: z.number().min(0),
    valuePerTLU: z.number().min(100),
  })
  .superRefine((data, ctx) => {
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

type FormData = z.infer<typeof createInsuranceUnitSchema>;

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

export function CreateInsuranceUnitDialog({ onSubmit, isLoading }: Props) {
  const [open, setOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(createInsuranceUnitSchema),
    defaultValues: {
      county: "",
      subCounty: "",
      unitCode: "",
      country: DEFAULT_COUNTRY_CODE,
      bboxMinLon: undefined,
      bboxMinLat: undefined,
      bboxMaxLon: undefined,
      bboxMaxLat: undefined,
      ndviBaselineLRLD: 0.45,
      ndviBaselineSRSD: 0.45,
      strikeLevelLRLD: 0.35,
      strikeLevelSRSD: 0.35,
      premiumRateLRLD: 1500,
      premiumRateSRSD: 1500,
      /**
       * 15000 IS A KES FIGURE, and it is only defaulted for the Kenyan market.
       *
       * The backend made the same change for the same reason: defaulting it into a GHS unit
       * would price a herd roughly 11x wrong, silently, with a number nobody typed. Switching
       * the country away from Kenya clears it (see the effect below) so the operator has to
       * state it — which is also what the backend now requires outside the default market.
       */
      valuePerTLU: 15000,
    },
  });

  const selectedCountry = form.watch("country");
  const market = marketOrNull(selectedCountry);
  // Null market cannot happen here — the field is a select over the registry — but the helper
  // is written to tolerate it, and falling back to the code keeps the label honest either way.
  const currencyCode = market?.currency ?? "local currency";

  useEffect(() => {
    // Clear the Kenya-specific TLU default when the operator picks another market, rather than
    // carrying a KES figure into a GHS unit. Only the DEFAULT value is cleared: a figure the
    // operator typed themselves is theirs to keep.
    if (selectedCountry !== DEFAULT_COUNTRY_CODE && form.getValues("valuePerTLU") === 15000) {
      form.resetField("valuePerTLU", { defaultValue: undefined as unknown as number });
    }
  }, [selectedCountry, form]);

  const handleSubmit = async (data: FormData) => {
    const { bboxMinLon, bboxMinLat, bboxMaxLon, bboxMaxLat, ...rest } = data;
    const bbox =
      bboxMinLon !== undefined && bboxMinLat !== undefined && bboxMaxLon !== undefined && bboxMaxLat !== undefined
        ? [bboxMinLon, bboxMinLat, bboxMaxLon, bboxMaxLat]
        : undefined;

    try {
      await onSubmit({ ...rest, bbox });
      setOpen(false);
      form.reset();
    } catch {
      // Error is handled by parent
    }
  };

  // Parse a coordinate input, mapping empty -> undefined (keeps bbox optional).
  const parseCoord = (value: string) => (value === "" ? undefined : parseFloat(value));

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
            Create a new county-level coverage unit for livestock insurance (IBLI).
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {countryOptions().map((option) => (
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
                      <Input placeholder="KE-47" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                  Geographic extent for the NDVI oracle. Leave blank or provide all four corners.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bboxMinLon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="34.0"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseCoord(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bboxMinLat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="1.5"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseCoord(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bboxMaxLon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Longitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="36.5"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseCoord(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bboxMaxLat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Latitude</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="5.5"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseCoord(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4 rounded-md border p-4 bg-muted/20">
                <h4 className="font-medium text-sm">LRLD Season</h4>
                <FormField
                  control={form.control}
                  name="ndviBaselineLRLD"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NDVI Baseline</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="strikeLevelLRLD"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strike Level</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="premiumRateLRLD"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Premium rate ({currencyCode}/TLU)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 rounded-md border p-4 bg-muted/20">
                <h4 className="font-medium text-sm">SRSD Season</h4>
                <FormField
                  control={form.control}
                  name="ndviBaselineSRSD"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NDVI Baseline</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="strikeLevelSRSD"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strike Level</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="premiumRateSRSD"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Premium rate ({currencyCode}/TLU)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="valuePerTLU"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value per TLU ({currencyCode})</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
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
