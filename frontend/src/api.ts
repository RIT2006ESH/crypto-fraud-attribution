import type { TraceInput, TraceResult } from './types';

async function unwrap(res: Response): Promise<TraceResult> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      res.status === 400
        ? 'That address was rejected. Check it is a full 0x wallet address.'
        : `The trace service returned ${res.status}. ${body.slice(0, 180)}`.trim()
    );
  }
  return res.json() as Promise<TraceResult>;
}

export async function submitTrace(input: TraceInput): Promise<TraceResult> {
  return unwrap(
    await fetch('/api/traces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  );
}

export async function getTrace(id: string): Promise<TraceResult> {
  return unwrap(await fetch(`/api/traces/${id}`));
}
