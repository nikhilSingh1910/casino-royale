import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Selection } from './types';

interface SelectionState {
  selection: Selection | null;
  select: (s: Selection | null) => void;
}
const SelectionContext = createContext<SelectionState | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const value = useMemo(() => ({ selection, select: setSelection }), [selection]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionState {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}
