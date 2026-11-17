export const whatsappKeys = {
  todas: ['whatsapp'] as const,
  estado: () => [...whatsappKeys.todas, 'estado'] as const,
  grupos: () => [...whatsappKeys.todas, 'grupos'] as const,
  codigo: () => [...whatsappKeys.todas, 'codigo'] as const,
};
