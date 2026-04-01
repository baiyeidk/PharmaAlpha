import { create } from "zustand";

export type ViewportItemType = "image" | "chart" | "pdf" | "text";

export interface ViewportItem {
  id: string;
  type: ViewportItemType;
  title: string;
  url?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

interface ViewportState {
  items: ViewportItem[];
  activeItemId: string | null;
  isOpen: boolean;
  pushItem: (item: Omit<ViewportItem, "id" | "createdAt">) => void;
  removeItem: (id: string) => void;
  setActiveItem: (id: string) => void;
  togglePanel: () => void;
  setOpen: (open: boolean) => void;
  clear: () => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  items: [],
  activeItemId: null,
  isOpen: false,

  pushItem: (item) =>
    set((state) => {
      const newItem: ViewportItem = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      return {
        items: [...state.items, newItem],
        activeItemId: newItem.id,
        isOpen: true,
      };
    }),

  removeItem: (id) =>
    set((state) => {
      const items = state.items.filter((i) => i.id !== id);
      return {
        items,
        activeItemId:
          state.activeItemId === id
            ? (items[items.length - 1]?.id ?? null)
            : state.activeItemId,
      };
    }),

  setActiveItem: (id) => set({ activeItemId: id }),
  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  clear: () => set({ items: [], activeItemId: null }),
}));
