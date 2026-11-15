import { PainelSchema, type Painel } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

export const painelApi = {
  buscar: async (): Promise<Painel> => PainelSchema.parse(await apiClient.get('/painel')),
};
