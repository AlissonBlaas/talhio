import { ListaPlanosSchema, PlanoSchema, type NovoPlano, type Plano } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

export const planosApi = {
  listar: async (): Promise<Plano[]> => ListaPlanosSchema.parse(await apiClient.get('/planos')),
  buscar: async (id: string): Promise<Plano> => PlanoSchema.parse(await apiClient.get(`/planos/${encodeURIComponent(id)}`)),
  criar: async (dados: NovoPlano): Promise<Plano> => PlanoSchema.parse(await apiClient.post('/planos', dados)),
};
