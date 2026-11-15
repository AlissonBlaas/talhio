/** Fábrica de chaves de cache: a mesma chave busca e invalida. */
export const maquinasKeys = {
  todas: ['maquinas'] as const,
  lista: () => [...maquinasKeys.todas, 'lista'] as const,
  rastros: () => [...maquinasKeys.todas, 'rastros'] as const,
  analise: (id: string, de: string, ate: string) => [...maquinasKeys.todas, 'analise', id, de, ate] as const,
  detalhe: (id: string) => [...maquinasKeys.todas, 'detalhe', id] as const,
};
