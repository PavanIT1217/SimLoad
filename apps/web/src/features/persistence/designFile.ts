import type { Design } from '@syssim/engine';
import { importDesignFile } from './fileImport';

export function designFileName(design: Design): string {
  const slug = design.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'design'}.syssim.json`;
}

/** Triggers a browser download of the design as pretty-printed JSON. */
export function exportDesign(design: Design): void {
  const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = designFileName(design);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importDesign(file: File): Promise<Design> {
  return (await importDesignFile(await file.text(), file.name)).design;
}
