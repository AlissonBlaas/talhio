import type { Periodo } from '@talhio/shared';

export const relatoriosKeys = {
  todos: ['relatorios'] as const,
  periodo: (periodo: Periodo, data: string | null, maquinaIds: string[] = []) => [...relatoriosKeys.todos, periodo, data ?? 'hoje', [...maquinaIds].sort().join(',')] as const,
};
