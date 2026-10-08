import type { Design } from '@syssim/engine';
import { parseDesign } from './schema';

const HASH_KEY = 'design';

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

/** Encodes a design as a URL-safe string (UTF-8 JSON, base64url). */
export function encodeDesign(design: Design): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(design)));
}

export function decodeDesign(encoded: string): Design {
  return parseDesign(JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))));
}

/** Full shareable URL with the design in the hash (never sent to a server). */
export function shareUrl(design: Design, location: Pick<Location, 'origin' | 'pathname'>): string {
  return `${location.origin}${location.pathname}#${HASH_KEY}=${encodeDesign(design)}`;
}

/** Reads a design from a location hash such as "#design=...". Returns null if absent. */
export function designFromHash(hash: string): Design | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const encoded = params.get(HASH_KEY);
  return encoded ? decodeDesign(encoded) : null;
}
