import { useState } from "react";
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

const createInsuranceUnitSchema = z.object({
  county: z.string().min(2, "County is required"),
  subCounty: z.string().optional(),
  unitCode: z.string().min(2, "Unit Code is required (e.g., KE-47)"),
  country: z.string().min(2, "Country Code is required (e.g., KE)").max(2, "Must be 2 letters"),
  bbox: z.string().optional(),
  ndviBaselineLRLD: z.number().min(0).max(1),
  ndviBaselineSRSD: z.number().min(0).max(1),
  strikeLevelLRLD: z.number().min(0).max(1),
  strikeLevelSRSD: z.number().min(0).max(1),
  premiumRateLRLD: z.number().min(0),
  premiumRateSRSD: z.number().min(0),
  valuePerTLU: z.number().min(100),
});

type FormData = z.infer<typeof createInsuranceUnitSchema>;

interface Props {
  onSubmit: (data: FormData) => Promise<void>;
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
      country: "KE",
      bbox: "",
      ndviBaselineLRLD: 0.45,
      ndviBaselineSRSD: 0.45,
      strikeLevelLRLD: 0.35,
      strikeLevelSRSD: 0.35,
      premiumRateLRLD: 1500,
      premiumRateSRSD: 1500,
      valuePerTLU: 15000,
    },
  });

  const handleSubmit = async (data: FormData) => {
    try {
      await onSubmit(data);
      setOpen(false);
      form.reset();
    } catch (error) {
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
                    <FormLabel>Country Code (ISO 2)</FormLabel>
                    <FormControl>
                      <Input placeholder="KE" {...field} />
                    </FormControl>
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
                    <FormLabel>County / Region</FormLabel>
                    <FormControl>
                      <Input placeholder="Turkana" {...field} />
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
                    <FormLabel>Sub-County (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Turkana Central" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="bbox"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bounding Box [minLon, minLat, maxLon, maxLat]</FormLabel>
                  <FormControl>
                    <Input placeholder="[34.0, 1.5, 36.5, 5.5]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      <FormLabel>Premium Rate (KES/TLU)</FormLabel>
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
                      <FormLabel>Premium Rate (KES/TLU)</FormLabel>
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
                  <FormLabel>Value Per TLU (KES)</FormLabel>
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
