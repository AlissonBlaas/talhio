export const linhasKeys = {
  todas: ['linhas'] as const,
  lista: () => [...linhasKeys.todas, 'lista'] as const,
};
