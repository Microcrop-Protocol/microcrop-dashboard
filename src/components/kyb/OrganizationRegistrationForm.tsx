import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ChevronRight, Loader2, Building2, User, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KYBDocumentUpload } from './KYBDocumentUpload';
import {
  organizationRegistrationSchema,
  type OrganizationRegistrationFormData,
  organizationTypeLabels,
} from '@/lib/validations/kyb';
import type { KYBDocumentType } from '@/types';
import { cn } from '@/lib/utils';

interface UploadedDocument {
  file: File;
  type: KYBDocumentType;
  preview?: string;
}

interface OrganizationRegistrationFormProps {
  onSubmit: (
    data: OrganizationRegistrationFormData,
    documents: UploadedDocument[]
  ) => Promise<void>;
  isLoading?: boolean;
}

const STEPS = [
  { id: 'organization', title: 'Organization', icon: Building2 },
  { id: 'contact', title: 'Contact Person', icon: User },
  { id: 'documents', title: 'Documents', icon: FileText },
  { id: 'review', title: 'Review', icon: Check },
];

export function OrganizationRegistrationForm({
  onSubmit,
  isLoading = false,
}: OrganizationRegistrationFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

  const form = useForm<OrganizationRegistrationFormData>({
    resolver: zodResolver(organizationRegistrationSchema),
    defaultValues: {
      name: '',
      registrationNumber: '',
      type: undefined,
      contactFirstName: '',
      contactLastName: '',
      contactEmail: '',
      contactPhone: '',
    },
    mode: 'onChange',
  });

  const validateCurrentStep = async () => {
    switch (currentStep) {
      case 0:
        return form.trigger(['name', 'registrationNumber', 'type']);
      case 1:
        return form.trigger(['contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone']);
      case 2:
        return documents.length >= 2;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    const isValid = await form.trigger();
    if (isValid && documents.length >= 2) {
      await onSubmit(form.getValues(), documents);
    }
  };

  const values = form.watch();

  return (
    <div className="space-y-8">
      {/* Progress Steps */}
      <div className="flex justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <div
              key={step.id}
              className={cn(
                'flex flex-1 items-center',
                index < STEPS.length - 1 && 'after:mx-4 after:h-0.5 after:flex-1 after:bg-border',
                isCompleted && 'after:bg-primary'
              )}
            >
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && 'bg-primary/10 text-primary',
                  !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Form {...form}>
        <form className="space-y-6">
          {/* Step 1: Organization Details */}
          {currentStep === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>
                  Tell us about your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Sunrise Farmers Cooperative" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Registration Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., PVT-2024-12345" {...field} />
                      </FormControl>
                      <FormDescription>
                        Your official business registration number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select organization type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(organizationTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the type that best describes your organization
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Contact Person */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Contact Person</CardTitle>
                <CardDescription>
                  This person will be the primary admin for your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contactFirstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactLastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john.doe@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Login credentials will be sent to this email
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+254712345678" {...field} />
                      </FormControl>
                      <FormDescription>
                        Kenyan phone number format (+254... or 07...)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 3: Documents */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>KYB Documents</CardTitle>
                <CardDescription>
                  Upload the required business documents for verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <KYBDocumentUpload
                  documents={documents}
                  onDocumentsChange={setDocuments}
                  requiredTypes={['BUSINESS_REGISTRATION_CERT', 'TAX_PIN_CERT']}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 4: Review */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Review Your Application</CardTitle>
                <CardDescription>
                  Please review all information before submitting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Organization Summary */}
                <div>
                  <h4 className="mb-2 font-medium">Organization</h4>
                  <div className="rounded-lg bg-muted p-4 text-sm">
                    <p>
                      <span className="text-muted-foreground">Name:</span> {values.name}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Registration Number:</span> {values.registrationNumber}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Type:</span>{' '}
                      {values.type ? organizationTypeLabels[values.type] : '-'}
                    </p>
                  </div>
                </div>

                {/* Contact Summary */}
                <div>
                  <h4 className="mb-2 font-medium">Contact Person</h4>
                  <div className="rounded-lg bg-muted p-4 text-sm">
                    <p>
                      <span className="text-muted-foreground">Name:</span>{' '}
                      {values.contactFirstName} {values.contactLastName}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Email:</span> {values.contactEmail}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Phone:</span> {values.contactPhone}
                    </p>
                  </div>
                </div>

                {/* Documents Summary */}
                <div>
                  <h4 className="mb-2 font-medium">Documents ({documents.length}/2)</h4>
                  <div className="rounded-lg bg-muted p-4 text-sm">
                    {documents.map((doc) => (
                      <p key={doc.type}>
                        <span className="text-muted-foreground">
                          {doc.type === 'BUSINESS_REGISTRATION_CERT'
                            ? 'Business Registration:'
                            : 'Tax PIN:'}
                        </span>{' '}
                        {doc.file.name}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
                  <p className="font-medium text-warning-foreground">Please note:</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                    <li>Your application will be reviewed by our team</li>
                    <li>You will receive an email notification once the review is complete</li>
                    <li>Upon approval, login credentials will be sent to the contact email</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0 || isLoading}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {currentStep < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={currentStep === 2 && documents.length < 2}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || documents.length < 2}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Application
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
