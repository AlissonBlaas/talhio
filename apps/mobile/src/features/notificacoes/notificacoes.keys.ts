/** Fábrica de chaves de cache: a mesma chave busca e invalida. */
export const notificacoesKeys = {
  todas: ['notificacoes'] as const,
  lista: () => [...notificacoesKeys.todas, 'lista'] as const,
};
