/** Fuso das fazendas atendidas. Vira configuração por organização quando houver fazenda em outro fuso. */
export const FUSO = 'America/Sao_Paulo';

/** O dia (AAAA-MM-DD) em que a fazenda está neste instante. */
export const diaLocal = (data: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(data);
