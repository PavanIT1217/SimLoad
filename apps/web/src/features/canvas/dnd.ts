import { COMPONENT_KINDS } from '@syssim/engine';
import type { ComponentKind } from '@syssim/engine';

/** MIME type used when dragging a component from the palette onto the canvas. */
export const KIND_MIME = 'application/x-syssim-kind';

export function readDraggedKind(transfer: DataTransfer): ComponentKind | null {
  const kind = transfer.getData(KIND_MIME) as ComponentKind;
  return COMPONENT_KINDS.includes(kind) ? kind : null;
}
