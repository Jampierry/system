import { useEffect } from 'react';

type Cb = () => void;
const subs = new Map<string, Set<Cb>>();

/** Barramento mínimo para avisar telas de que dados mudaram (ex.: 'items', 'notes'). */
export function emit(topic: string): void {
  subs.get(topic)?.forEach(cb => cb());
}

export function useBus(topic: string, cb: Cb): void {
  useEffect(() => {
    const set = subs.get(topic) ?? new Set<Cb>();
    set.add(cb);
    subs.set(topic, set);
    return () => { set.delete(cb); };
  }, [topic, cb]);
}
