import { ListaNotificacoesSchema, type ListaNotificacoes, type RegistrarDispositivo } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

/** Camada de dados: só fala com o backend e devolve dados validados pelo contrato. */
export const notificacoesApi = {
  listar: async (): Promise<ListaNotificacoes> => ListaNotificacoesSchema.parse(await apiClient.get('/notificacoes')),
  marcarLidas: async (): Promise<void> => {
    await apiClient.post('/notificacoes/lidas', {});
  },
  limpar: async (): Promise<void> => {
    await apiClient.post('/notificacoes/limpar', {});
  },
  registrarAparelho: async (dados: RegistrarDispositivo): Promise<void> => {
    await apiClient.post('/dispositivos', dados);
  },
  removerAparelho: async (token: string): Promise<void> => {
    await apiClient.post('/dispositivos/remover', { token });
  },
};
