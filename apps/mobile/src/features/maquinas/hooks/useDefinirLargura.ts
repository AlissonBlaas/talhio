import { useMutation, useQueryClient } from '@tanstack/react-query';

import { maquinasApi } from '../api/maquinasApi';
import { maquinasKeys } from '../maquinas.keys';

/** Grava a largura do implemento da máquina (nula apaga). Os hectares são refeitos no servidor: tudo de máquinas é buscado de novo. */
export function useDefinirLargura(maquinaId: string) {
  const queryClient = useQueryClient();
  const mutacao = useMutation({
    mutationFn: (larguraM: number | null) => maquinasApi.definirLargura(maquinaId, larguraM),
    onSuccess: (maquina) => {
      queryClient.setQueryData(maquinasKeys.detalhe(maquinaId), maquina);
      void queryClient.invalidateQueries({ queryKey: maquinasKeys.todas });
    },
  });
  return { definir: mutacao.mutate, salvando: mutacao.isPending, erro: mutacao.error };
}
