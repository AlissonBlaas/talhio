import { useMutation, useQueryClient } from '@tanstack/react-query';

import { talhoesApi } from '../api/talhoesApi';

export function useCriarTalhao() {
  const queryClient = useQueryClient();
  const mutacao = useMutation({
    mutationFn: talhoesApi.criar,
    // Um talhão novo muda a lista, o mapa, o painel e o talhão de cada máquina:
    // todas as queries ficam vencidas e as telas abertas buscam de novo.
    onSuccess: () => queryClient.invalidateQueries(),
  });
  return {
    criar: mutacao.mutate,
    salvando: mutacao.isPending,
    salvo: mutacao.data ?? null,
    erro: mutacao.error,
    limparErro: mutacao.reset,
  };
}
