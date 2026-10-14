import { sameValue, type RecoveryItem } from './cloudSync';
import type { AppState } from './types';

export function recoveryValue(state: AppState, item: RecoveryItem): any {
  let value: any = state;
  for (const part of item.path) value = typeof part === 'string' ? value?.[part] : Array.isArray(value) ? value.find(row => row.id === part.id) : undefined;
  return value;
}

/** Explicit user choice, checked against exactly what the review displayed. */
export function applyRecoveryChoice(state: AppState, item: RecoveryItem, expected: any): AppState {
  if (!sameValue(recoveryValue(state, item), expected)) throw new Error('Запись уже обновилась. Проверьте новое значение и повторите выбор.');
  const next = structuredClone(state);
  let parent: any = next;
  for (const part of item.path.slice(0, -1)) {
    parent = typeof part === 'string' ? parent?.[part] : parent?.find((row: any) => row.id === part.id);
    if (!parent) throw new Error('Раздел изменился. Проверьте запись в таблице.');
  }
  const last = item.path.at(-1)!;
  if (typeof last === 'string') {
    if (item.local === undefined) delete parent[last]; else parent[last] = structuredClone(item.local);
  } else {
    const index = parent.findIndex((row: any) => row.id === last.id);
    if (index >= 0) parent.splice(index, 1);
    next.deletedIds = next.deletedIds.filter(id => id !== last.id);
    if (item.local === undefined) next.deletedIds.push(last.id);
    else parent.splice(index < 0 ? parent.length : index, 0, structuredClone(item.local));
  }
  return next;
}
