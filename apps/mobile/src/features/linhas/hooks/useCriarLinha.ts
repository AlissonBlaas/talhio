import { useMutation, useQueryClient } from '@tanstack/react-query';

import { linhasApi } from '../api/linhasApi';
import { linhasKeys } from '../linhas.keys';

export function useCriarLinha() {
  const queryClient = useQueryClient();
  const mutacao = useMutation({
    mutationFn: linhasApi.criar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: linhasKeys.todas }),
  });
  return {
    criar: mutacao.mutate,
    salvando: mutacao.isPending,
    salva: mutacao.data ?? null,
    erro: mutacao.error,
    limparErro: mutacao.reset,
  };
}
