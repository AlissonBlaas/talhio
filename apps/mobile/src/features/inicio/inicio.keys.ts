export const inicioKeys = {
  todas: ['inicio'] as const,
  painel: () => [...inicioKeys.todas, 'painel'] as const,
};
