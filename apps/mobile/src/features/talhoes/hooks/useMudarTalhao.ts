import { useMutation, useQueryClient } from '@tanstack/react-query';

import { talhoesApi } from '../api/talhoesApi';

/** Editar e apagar um talhão desenhado no app. Como criar, mexe em quase tudo que está na tela: todas as consultas vencem. */
export function useMudarTalhao() {
  const queryClient = useQueryClient();
  const aoMudar = () => queryClient.invalidateQueries();
  const edicao = useMutation({ mutationFn: talhoesApi.editar, onSuccess: aoMudar });
  const remocao = useMutation({ mutationFn: talhoesApi.apagar, onSuccess: aoMudar });
  return {
    editar: edicao.mutate,
    salvando: edicao.isPending,
    salvo: edicao.data ?? null,
    erro: edicao.error ?? remocao.error,
    limparErro: () => {
      edicao.reset();
      remocao.reset();
    },
    apagar: remocao.mutate,
    apagando: remocao.isPending,
  };
}
