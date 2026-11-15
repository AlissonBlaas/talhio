import { RelatorioSchema, type Periodo, type Relatorio } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

/** `?data=...&maquinas=id1,id2`: só o que foi escolhido entra no endereço. */
export function consulta(data: string | null, maquinaIds: string[] = []): string {
  const partes = [data ? `data=${data}` : null, maquinaIds.length ? `maquinas=${maquinaIds.map(encodeURIComponent).join(',')}` : null].filter(Boolean);
  return partes.length ? `?${partes.join('&')}` : '';
}

export const relatoriosApi = {
  /** `data` (AAAA-MM-DD) escolhe o dia, o último dos 7 dias ou o mês; sem ela vale hoje. `maquinaIds` vazio = a fazenda inteira. */
  buscar: async (periodo: Periodo, data: string | null, maquinaIds: string[] = []): Promise<Relatorio> => RelatorioSchema.parse(await apiClient.get(`/relatorios/${periodo}${consulta(data, maquinaIds)}`)),
  pdf: (periodo: Periodo, data: string | null, maquinaIds: string[] = []): Promise<Uint8Array> => apiClient.baixar(`/relatorios/${periodo}/pdf${consulta(data, maquinaIds)}`),
};
