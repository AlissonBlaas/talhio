export const escalaKeys = {
  todas: ['escala'] as const,
  /** A escala de um dia (AAAA-MM-DD), ou `hoje`. */
  doDia: (dia?: string) => [...escalaKeys.todas, dia ?? 'hoje'] as const,
};
