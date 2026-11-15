export const conexaoKeys = {
  todas: ['conexao-deere'] as const,
  estado: () => [...conexaoKeys.todas, 'estado'] as const,
  organizacoes: () => [...conexaoKeys.todas, 'organizacoes'] as const,
};
