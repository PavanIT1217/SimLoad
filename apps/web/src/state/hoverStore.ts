import { create } from 'zustand';

/** Which connection the pointer is over (drives the edge tooltip). */
export const useHoverStore = create<{ edgeId: string | null; setEdge(id: string | null): void }>()(
  (set) => ({
    edgeId: null,
    setEdge: (edgeId) => set({ edgeId }),
  }),
);
