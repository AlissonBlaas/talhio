import { ResultadoDoCadastroSchema, SessaoSchema, type Cadastrar, type Entrar, type ResultadoDoCadastro, type Sessao } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

export const authApi = {
  entrar: async (dados: Entrar): Promise<Sessao> => SessaoSchema.parse(await apiClient.post('/auth/entrar', dados, { semLogin: true })),
  /** Devolve a sessão (já entra) ou `{ aguardandoAprovacao: true }` quando a conta precisa ser liberada por nós. */
  cadastrar: async (dados: Cadastrar): Promise<ResultadoDoCadastro> => ResultadoDoCadastroSchema.parse(await apiClient.post('/auth/cadastrar', dados, { semLogin: true })),
  sair: (tokenRenovacao: string) => apiClient.post('/auth/sair', { tokenRenovacao }, { semLogin: true }),
};
