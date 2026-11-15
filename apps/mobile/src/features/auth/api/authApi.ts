import { SessaoSchema, type Cadastrar, type Entrar, type Sessao } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

export const authApi = {
  entrar: async (dados: Entrar): Promise<Sessao> => SessaoSchema.parse(await apiClient.post('/auth/entrar', dados, { semLogin: true })),
  cadastrar: async (dados: Cadastrar): Promise<Sessao> => SessaoSchema.parse(await apiClient.post('/auth/cadastrar', dados, { semLogin: true })),
  sair: (tokenRenovacao: string) => apiClient.post('/auth/sair', { tokenRenovacao }, { semLogin: true }),
};
