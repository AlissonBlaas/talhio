import { ListaTalhoesSchema, TalhaoSchema, type NovoTalhao, type Talhao } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

export const talhoesApi = {
  // Um talhão com dado estranho (área zero, contorno incompleto) fica de fora sozinho: antes, um só inválido
  // derrubava a lista inteira e o mapa abria sem nenhum talhão.
  listar: async (): Promise<Talhao[]> => {
    const bruto = await apiClient.get('/talhoes');
    if (!Array.isArray(bruto)) return ListaTalhoesSchema.parse(bruto);
    return bruto.flatMap((item) => {
      const lido = TalhaoSchema.safeParse(item);
      return lido.success ? [lido.data] : [];
    });
  },
  criar: async (dados: NovoTalhao): Promise<Talhao> => TalhaoSchema.parse(await apiClient.post('/talhoes', dados)),
};
