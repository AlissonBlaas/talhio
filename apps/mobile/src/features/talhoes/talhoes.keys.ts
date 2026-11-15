export const talhoesKeys = {
  todas: ['talhoes'] as const,
  lista: () => [...talhoesKeys.todas, 'lista'] as const,
};
