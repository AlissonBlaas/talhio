import { useMutation, useQueryClient } from '@tanstack/react-query';

import { planosApi } from '../api/planosApi';
import { planosKeys } from '../planos.keys';

export function useCriarPlano() {
  const queryClient = useQueryClient();
  const mutacao = useMutation({
    mutationFn: planosApi.criar,
    // Um plano que começa hoje entra na escala, e a escala muda o operador das máquinas.
    onSuccess: async (plano) => {
      await queryClient.invalidateQueries();
      // O passo seguinte (a escala do plano) abre sem precisar buscar o plano de novo.
      queryClient.setQueryData(planosKeys.plano(plano.id), plano);
    },
  });
  return {
    criar: mutacao.mutate,
    salvando: mutacao.isPending,
    salvo: mutacao.data ?? null,
    erro: mutacao.error,
    /** Volta ao formulário (para mudar algo e salvar outro plano). */
    recomecar: mutacao.reset,
  };
}
