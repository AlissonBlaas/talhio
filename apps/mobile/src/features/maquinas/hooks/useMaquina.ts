import type { Maquina } from '@talhio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { intervaloDeAtualizacao } from '@/shared/lib/canalAoVivo';

import { maquinasApi } from '../api/maquinasApi';
import { maquinasKeys } from '../maquinas.keys';

/** Uma máquina, com tudo que o backend sabe dela. Abre na hora com o que a lista já tinha em cache. */
export function useMaquina(id: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: maquinasKeys.detalhe(id),
    queryFn: () => maquinasApi.buscar(id),
    placeholderData: () => queryClient.getQueryData<Maquina[]>(maquinasKeys.lista())?.find((m) => m.id === id),
    // Mesmo ritmo da lista: atualiza a cada 30 s com a tela aberta.
    refetchInterval: intervaloDeAtualizacao,
    refetchIntervalInBackground: false,
  });
  return {
    maquina: query.data ?? null,
    carregando: query.isPending && !query.data,
    erro: query.error,
    atualizando: query.isRefetching,
    atualizar: () => void query.refetch(),
  };
}
