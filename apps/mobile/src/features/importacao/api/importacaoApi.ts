import { ResultadoImportacaoSchema, type Importacao, type ResultadoImportacao } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

export const importacaoApi = {
  gen4: async (dados: Importacao): Promise<ResultadoImportacao> => ResultadoImportacaoSchema.parse(await apiClient.post('/importacoes/gen4', dados)),
};
