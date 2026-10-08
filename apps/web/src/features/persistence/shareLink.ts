import type { Design } from '@syssim/engine';
import { parseDesign } from './schema';

/** Compressed links use `#z=`; `#design=` (uncompressed) links from v1 still open. */
const COMPRESSED_KEY = 'z';
const LEGACY_KEY = 'design';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Encodes a design as URL-safe text: JSON → raw deflate → base64url. */
export async function encodeDesign(design: Design): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(design));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeDesign(encoded: string): Promise<Design> {
  const json = await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw'));
  return parseDesign(JSON.parse(new TextDecoder().decode(json)));
}

function decodeLegacy(encoded: string): Design {
  return parseDesign(JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))));
}

/** Full shareable URL with the design in the hash (never sent to a server). */
export async function shareUrl(
  design: Design,
  location: Pick<Location, 'origin' | 'pathname'>,
): Promise<string> {
  return `${location.origin}${location.pathname}#${COMPRESSED_KEY}=${await encodeDesign(design)}`;
}

/** Reads a design from a location hash ("#z=..." or legacy "#design=..."). Null if absent. */
export async function designFromHash(hash: string): Promise<Design | null> {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const compressed = params.get(COMPRESSED_KEY);
  if (compressed) return decodeDesign(compressed);
  const legacy = params.get(LEGACY_KEY);
  return legacy ? decodeLegacy(legacy) : null;
}
