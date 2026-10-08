import { COMPONENT_KINDS } from '@simload/engine';
import type { ComponentKind } from '@simload/engine';

/** MIME type used when dragging a component from the palette onto the canvas. */
export const KIND_MIME = 'application/x-simload-kind';

export function readDraggedKind(transfer: DataTransfer): ComponentKind | null {
  const kind = transfer.getData(KIND_MIME) as ComponentKind;
  return COMPONENT_KINDS.includes(kind) ? kind : null;
}
