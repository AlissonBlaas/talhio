import { LinhaSchema, ListaLinhasSchema, type Linha, type NovaLinha } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

export const linhasApi = {
  listar: async (): Promise<Linha[]> => ListaLinhasSchema.parse(await apiClient.get('/linhas')),
  criar: async (dados: NovaLinha): Promise<Linha> => LinhaSchema.parse(await apiClient.post('/linhas', dados)),
};
