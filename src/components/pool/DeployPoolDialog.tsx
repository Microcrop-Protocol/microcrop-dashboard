import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
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
import {
  deployPoolSchema,
  type DeployPoolFormData,
  poolTypeLabels,
  coverageTypeLabels,
} from '@/lib/validations/pool';
import type { Organization } from '@/types';

interface DeployPoolDialogProps {
  organization?: Organization;
  onSubmit: (data: DeployPoolFormData) => Promise<void>;
  isLoading?: boolean;
  trigger?: React.ReactNode;
}

export function DeployPoolDialog({
  organization,
  onSubmit,
  isLoading = false,
  trigger,
}: DeployPoolDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<DeployPoolFormData>({
    resolver: zodResolver(deployPoolSchema),
    defaultValues: {
      name: organization ? `${organization.name} Pool` : '',
      symbol: '',
      poolType: organization ? 'PRIVATE' : 'PUBLIC',
      coverageType: 'COMPREHENSIVE',
      region: 'Kenya',
      minDeposit: 100,
      maxDeposit: 1000000,
      targetCapital: 100000,
      maxCapital: 500000,
      poolOwner: undefined,
    },
  });

  const handleSubmit = async (data: DeployPoolFormData) => {
    await onSubmit(data);
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Deploy Pool
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {organization ? `Deploy Pool for ${organization.name}` : 'Create Public Pool'}
          </DialogTitle>
          <DialogDescription>
            {organization
              ? 'Deploy a new risk pool for this organization on the blockchain.'
              : 'Create a new public risk pool that anyone can invest in.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Pool Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Pool Details</h4>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pool Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Kenya Crop Insurance Pool" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Symbol</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., KPOOL"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription>
                      Uppercase letters only (e.g., KPOOL, AFPOOL)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      <Input placeholder="e.g., Kenya, East Africa" {...field} />
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
                  name="minDeposit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Deposit</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="100"
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
                  name="maxDeposit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Deposit</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1000000"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="targetCapital"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Capital</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="100000"
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
                          placeholder="500000"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Pool Owner (Optional) */}
            {organization && (
              <FormField
                control={form.control}
                name="poolOwner"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pool Owner Address (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="0x..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Leave empty to use the organization's admin wallet
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
