export const assistenteKeys = {
  todas: ['assistente'] as const,
  conversas: () => [...assistenteKeys.todas, 'conversas'] as const,
  conversa: (id: string) => [...assistenteKeys.todas, 'conversa', id] as const,
};
