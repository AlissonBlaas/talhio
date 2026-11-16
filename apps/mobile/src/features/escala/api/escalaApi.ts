import { EscalaSchema, type DefinirEscala, type Escala, type Turno } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

/** Sem `dia`, o servidor usa hoje. */
const doDia = (dia?: string) => (dia ? `?dia=${dia}` : '');
const maquina = (maquinaId: string, dia?: string) => `/escala/maquinas/${encodeURIComponent(maquinaId)}${doDia(dia)}`;

export const escalaApi = {
  buscar: async (dia?: string): Promise<Escala> => EscalaSchema.parse(await apiClient.get(`/escala${doDia(dia)}`)),
  definir: async ({ maquinaId, dados, dia }: { maquinaId: string; dados: DefinirEscala; dia?: string }): Promise<Escala> => EscalaSchema.parse(await apiClient.post(maquina(maquinaId, dia), dados)),
  /** Com `turno`, tira só a linha desse turno; sem ele, a máquina inteira sai da escala do dia. */
  tirar: async ({ maquinaId, turno, dia }: { maquinaId: string; turno?: Turno; dia?: string }): Promise<Escala> =>
    EscalaSchema.parse(await apiClient.apagar(`${maquina(maquinaId, dia)}${turno ? `${dia ? '&' : '?'}turno=${turno}` : ''}`)),
  /** Grava de uma vez todas as linhas sugeridas (a repetida de ontem ou o operador que a máquina informa). */
  confirmar: async (dia?: string): Promise<Escala> => EscalaSchema.parse(await apiClient.post(`/escala/confirmar${doDia(dia)}`, {})),
  /** Com `maquinaIds`, só essas máquinas constam como enviadas. */
  marcarEnviada: async ({ dia, maquinaIds }: { dia?: string; maquinaIds?: string[] }): Promise<Escala> => EscalaSchema.parse(await apiClient.post(`/escala/envio${doDia(dia)}`, { maquinaIds })),
};
