import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';

const deployOrgPoolSchema = z.object({
  name: z.string().optional(),
  symbol: z
    .string()
    .min(2, 'Symbol must be at least 2 characters')
    .max(10, 'Symbol must be less than 10 characters')
    .regex(/^[A-Z]+$/, 'Symbol must be uppercase letters only')
    .optional()
    .or(z.literal('')),
  poolType: z.enum(['PRIVATE', 'PUBLIC', 'MUTUAL'], {
    required_error: 'Please select a pool type',
  }),
  coverageType: z.enum(['DROUGHT', 'FLOOD', 'PEST', 'DISEASE', 'COMPREHENSIVE'], {
    required_error: 'Please select a coverage type',
  }),
  region: z
    .string()
    .min(2, 'Region must be at least 2 characters'),
  targetCapital: z
    .number({ required_error: 'Target capital is required' })
    .min(1000, 'Target capital must be at least 1,000 USDC'),
  maxCapital: z
    .number()
    .min(1000, 'Maximum capital must be at least 1,000 USDC')
    .optional(),
  minDeposit: z
    .number()
    .min(1, 'Minimum deposit must be at least 1 USDC')
    .optional(),
  maxDeposit: z
    .number()
    .min(100, 'Maximum deposit must be at least 100 USDC')
    .optional(),
  memberContribution: z
    .number()
    .min(1, 'Member contribution must be at least 1 USDC')
    .optional(),
});

type DeployOrgPoolFormData = z.infer<typeof deployOrgPoolSchema>;

const poolTypeLabels: Record<string, string> = {
  PRIVATE: 'Private (Whitelisted depositors)',
  PUBLIC: 'Public (Open to anyone)',
  MUTUAL: 'Mutual (Fixed member contributions)',
};

const coverageTypeLabels: Record<string, string> = {
  DROUGHT: 'Drought',
  FLOOD: 'Flood',
  PEST: 'Pest',
  DISEASE: 'Disease',
  COMPREHENSIVE: 'Comprehensive (All types)',
};

interface DeployOrgPoolDialogProps {
  onSubmit: (data: DeployOrgPoolFormData) => Promise<void>;
  isLoading?: boolean;
  trigger?: React.ReactNode;
}

export function DeployOrgPoolDialog({
  onSubmit,
  isLoading = false,
  trigger,
}: DeployOrgPoolDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<DeployOrgPoolFormData>({
    resolver: zodResolver(deployOrgPoolSchema),
    defaultValues: {
      name: '',
      symbol: '',
      poolType: 'PRIVATE',
      coverageType: 'COMPREHENSIVE',
      region: 'Kenya',
      targetCapital: 50000,
      maxCapital: undefined,
      minDeposit: 100,
      maxDeposit: 10000,
      memberContribution: undefined,
    },
  });

  const watchPoolType = form.watch('poolType');

  const handleSubmit = async (data: DeployOrgPoolFormData) => {
    await onSubmit(data);
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="lg">
            <Rocket className="mr-2 h-5 w-5" />
            Deploy Pool
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Deploy Your Risk Pool</DialogTitle>
          <DialogDescription>
            Create a new risk pool for your organization on the blockchain. This will deploy a smart contract to manage insurance liquidity.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Pool Configuration */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Pool Configuration</h4>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pool Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="My Risk Pool" {...field} />
                      </FormControl>
                      <FormDescription>
                        Defaults to your org name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token Symbol (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="MYPOOL"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormDescription>
                        Defaults to MCPOOL
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="poolType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pool Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(poolTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
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
                  name="coverageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coverage Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select coverage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(coverageTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <FormControl>
                      <Input placeholder="Kenya" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Capital Limits */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Capital Limits (USDC)</h4>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="targetCapital"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Capital *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="50000"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxCapital"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Capital</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="100000"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Defaults to 2x target
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Private pool specific fields */}
              {watchPoolType === 'PRIVATE' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="minDeposit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Deposit</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="100"
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxDeposit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Deposit</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="10000"
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Mutual pool specific field */}
              {watchPoolType === 'MUTUAL' && (
                <FormField
                  control={form.control}
                  name="memberContribution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Member Contribution *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="500"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Fixed amount each member must contribute
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                Deploying a pool will create a smart contract on Base. This operation requires gas fees and cannot be undone.
              </p>
            </div>

            <DialogFooter>
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
                Deploy Pool
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
