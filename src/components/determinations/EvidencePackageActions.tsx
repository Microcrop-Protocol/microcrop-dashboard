/**
 * DOWNLOAD THE EVIDENCE PACKAGE.
 *
 * Before this existed the package had exactly one route in the whole system, gated
 * PLATFORM_ADMIN — so the one artifact the Determination plan sells was unreachable by the
 * partner who bought it. `GET /api/determinations/:id/evidence` is the org-scoped route beside
 * it.
 *
 * SAVED BYTE-FOR-BYTE, NOT REBUILT. The package is what a third party re-hashes to check the
 * signature, so the file written to disk is `JSON.stringify` of exactly what the server sent,
 * never a re-assembly from fields this UI happens to render. Pretty-printing is safe (the
 * verification canonicalises the `canonical.body` subtree itself, and the reproducer script
 * parses the file), but dropping or reordering a key would not be.
 *
 * The fetch goes through the api client rather than a bare `<a href>` because the route needs
 * the bearer token; an anchor would send an unauthenticated request and download a 401 body.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Download, Loader2 } from 'lucide-react';

export function EvidencePackageActions({
  determinationId,
  available,
}: {
  determinationId: string;
  available: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      const pkg = await api.getDeterminationEvidence(determinationId);
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `determination-${determinationId}-evidence.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      notifySuccess(
        'Evidence package downloaded',
        'It contains the signed determination, its hash, the signer and the source citation.',
      );
    } catch (error) {
      notifyError(error, "Couldn't download the evidence package. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  if (!available) {
    // Explained, not hidden: a partner that expected a package needs to know it is not there
    // rather than wonder whether the button failed to render.
    return (
      <p className="text-sm text-muted-foreground">
        No evidence package is available for this determination.
      </p>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={download} disabled={downloading}>
      {downloading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      Download evidence package
    </Button>
  );
}
