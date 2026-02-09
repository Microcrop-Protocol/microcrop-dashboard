import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OrganizationRegistrationForm } from '@/components/kyb/OrganizationRegistrationForm';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { OrganizationRegistrationFormData } from '@/lib/validations/kyb';
import type { KYBDocumentType } from '@/types';

interface UploadedDocument {
  file: File;
  type: KYBDocumentType;
  preview?: string;
}

export default function RegisterOrganizationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (
    data: OrganizationRegistrationFormData,
    documents: UploadedDocument[]
  ) => {
    setIsLoading(true);
    try {
      await api.submitOrgApplication({
        ...data,
        documents: documents.map((doc) => ({
          type: doc.type,
          fileName: doc.file.name,
          fileSize: doc.file.size,
          file: doc.file, // Include actual file for real API upload
        })),
      });

      setIsSubmitted(true);
      toast({
        title: 'Application Submitted',
        description: 'Your organization application has been submitted for review.',
      });
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: 'There was an error submitting your application. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <CardTitle>Application Submitted!</CardTitle>
            <CardDescription>
              Thank you for registering your organization with MicroCrop
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              <p>Your application is now under review. Our team will verify your documents and get back to you within 2-3 business days.</p>
              <p className="mt-2">You will receive an email notification once the review is complete.</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">What happens next?</h4>
              <ul className="text-left text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  Our team reviews your submitted documents
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  Upon approval, your organization account is created
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  You receive an email with login credentials
                </li>
              </ul>
            </div>

            <Button asChild className="w-full">
              <Link to="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img
              src="/microcropsymb.png"
              alt="MicroCrop"
              className="h-10 w-10 object-contain"
            />
            <span className="text-xl font-bold">MicroCrop</span>
          </Link>
          <h1 className="text-2xl font-bold">Register Your Organization</h1>
          <p className="mt-2 text-muted-foreground">
            Join MicroCrop to provide crop insurance to your farmers
          </p>
        </div>

        {/* Registration Form */}
        <OrganizationRegistrationForm onSubmit={handleSubmit} isLoading={isLoading} />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
