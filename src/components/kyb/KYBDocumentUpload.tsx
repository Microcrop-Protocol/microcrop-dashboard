import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { KYBDocumentType } from '@/types';
import { documentTypeLabels } from '@/lib/validations/kyb';

interface UploadedDocument {
  file: File;
  type: KYBDocumentType;
  preview?: string;
}

interface KYBDocumentUploadProps {
  documents: UploadedDocument[];
  onDocumentsChange: (documents: UploadedDocument[]) => void;
  requiredTypes?: KYBDocumentType[];
  maxFileSize?: number;
  disabled?: boolean;
}

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function KYBDocumentUpload({
  documents,
  onDocumentsChange,
  requiredTypes = ['BUSINESS_REGISTRATION_CERT', 'TAX_PIN_CERT'],
  maxFileSize = 5 * 1024 * 1024,
  disabled = false,
}: KYBDocumentUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<KYBDocumentType | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles.map(f => f.errors[0]?.message).join(', ');
        setError(errors || 'Invalid file');
        return;
      }

      if (acceptedFiles.length > 0 && activeType) {
        const file = acceptedFiles[0];

        if (file.size > maxFileSize) {
          setError(`File size must be less than ${formatFileSize(maxFileSize)}`);
          return;
        }

        // Remove existing document of the same type
        const filtered = documents.filter(d => d.type !== activeType);

        // Create preview for images
        let preview: string | undefined;
        if (file.type.startsWith('image/')) {
          preview = URL.createObjectURL(file);
        }

        onDocumentsChange([...filtered, { file, type: activeType, preview }]);
        setActiveType(null);
      }
    },
    [activeType, documents, maxFileSize, onDocumentsChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 1,
    disabled: disabled || !activeType,
  });

  const removeDocument = (type: KYBDocumentType) => {
    const doc = documents.find(d => d.type === type);
    if (doc?.preview) {
      URL.revokeObjectURL(doc.preview);
    }
    onDocumentsChange(documents.filter(d => d.type !== type));
  };

  const getDocumentForType = (type: KYBDocumentType) => {
    return documents.find(d => d.type === type);
  };

  return (
    <div className="space-y-4">
      {requiredTypes.map(type => {
        const doc = getDocumentForType(type);
        const isUploading = activeType === type;

        return (
          <Card
            key={type}
            className={cn(
              'transition-colors',
              isUploading && 'ring-2 ring-primary',
              doc && 'border-success/50 bg-success/5'
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-medium">{documentTypeLabels[type]}</h4>
                  <p className="text-sm text-muted-foreground">
                    PDF, JPEG, or PNG up to {formatFileSize(maxFileSize)}
                  </p>
                </div>

                {doc ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{doc.file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({formatFileSize(doc.file.size)})
                      </span>
                      <Check className="h-4 w-4 text-success" />
                    </div>
                    {!disabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDocument(type)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveType(type)}
                    disabled={disabled}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                )}
              </div>

              {isUploading && (
                <div
                  {...getRootProps()}
                  className={cn(
                    'mt-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                    isDragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isDragActive
                      ? 'Drop the file here...'
                      : 'Drag & drop a file here, or click to select'}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveType(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {documents.length} of {requiredTypes.length} required documents uploaded
      </div>
    </div>
  );
}
