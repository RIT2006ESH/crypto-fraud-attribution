import { reportUrl } from '../api';
import type { TraceResult } from '../types';

/**
 * Report export.
 *
 * The backend owns report generation. This only hands the browser the service's own
 * URL under a sensible filename — the alternative, rendering a document in the client,
 * would produce something that looks authoritative but is not what the service emits.
 */

export function downloadReport(result: TraceResult): void {
  if (!result.id) return;

  const ref = (result.caseId || result.id).replace(/[^a-zA-Z0-9._-]/g, '-');
  const link = document.createElement('a');
  link.href = reportUrl(result.id);
  link.download = `casetrace-${ref}.pdf`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
