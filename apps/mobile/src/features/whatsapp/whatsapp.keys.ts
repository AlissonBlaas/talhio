export const whatsappKeys = {
  todas: ['whatsapp'] as const,
  estado: () => [...whatsappKeys.todas, 'estado'] as const,
  grupos: () => [...whatsappKeys.todas, 'grupos'] as const,
};
