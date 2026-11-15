import { useMutation, useQueryClient } from '@tanstack/react-query';

import { conexaoApi } from '../api/conexaoApi';
import { conexaoKeys } from '../conexao.keys';

/** Escolher a organização, conferir a liberação e desconectar. Todas refazem o estado da ligação. */
export function useMudarConexao() {
  const queryClient = useQueryClient();
  const atualizar = (estado: Awaited<ReturnType<typeof conexaoApi.escolher>>) => {
    queryClient.setQueryData(conexaoKeys.estado(), estado);
    void queryClient.invalidateQueries({ queryKey: conexaoKeys.organizacoes() });
  };
  // Trocar de fazenda muda tudo o que está na tela (máquinas, talhões, relatórios, escala): refaz todas as consultas.
  const escolher = useMutation({
    mutationFn: conexaoApi.escolher,
    onSuccess: (estado) => {
      atualizar(estado);
      void queryClient.invalidateQueries();
    },
  });
  const conferir = useMutation({ mutationFn: conexaoApi.conferir, onSuccess: atualizar });
  const desconectar = useMutation({
    mutationFn: conexaoApi.desconectar,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: conexaoKeys.todas }),
  });
  return {
    escolher: escolher.mutate,
    escolhendo: escolher.isPending,
    conferir: () => conferir.mutate(),
    conferindo: conferir.isPending,
    desconectar: () => desconectar.mutate(),
    desconectando: desconectar.isPending,
    erro: escolher.error ?? conferir.error ?? desconectar.error,
  };
}
