export const planosKeys = {
  todos: ['planos'] as const,
  lista: () => [...planosKeys.todos, 'lista'] as const,
  plano: (id: string) => [...planosKeys.todos, 'plano', id] as const,
};
