import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EstadoWhatsapp } from '@talhio/shared';

import { whatsappApi } from '../api/whatsappApi';
import { whatsappKeys } from '../whatsapp.keys';

/** Gerar código, escolher o grupo, testar e desconectar. Cada uma refaz o estado que a tela mostra. */
export function useMudarWhatsapp() {
  const queryClient = useQueryClient();
  const guardar = (estado: EstadoWhatsapp) => queryClient.setQueryData(whatsappKeys.estado(), estado);

  const codigo = useMutation({
    mutationFn: whatsappApi.pedirCodigo,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: whatsappKeys.estado() }),
  });
  const escolherGrupo = useMutation({ mutationFn: whatsappApi.escolherGrupo, onSuccess: guardar });
  const tirarGrupo = useMutation({ mutationFn: whatsappApi.tirarGrupo, onSuccess: guardar });
  const teste = useMutation({ mutationFn: whatsappApi.teste });
  const desconectar = useMutation({
    mutationFn: whatsappApi.desconectar,
    onSuccess: (estado) => {
      guardar(estado);
      codigo.reset();
      queryClient.removeQueries({ queryKey: whatsappKeys.grupos() });
    },
  });

  return {
    pedirCodigo: codigo.mutate,
    pedindoCodigo: codigo.isPending,
    /** Último código gerado nesta tela (some ao desconectar). */
    codigo: codigo.data?.codigo ?? null,
    escolherGrupo: escolherGrupo.mutate,
    escolhendoGrupo: escolherGrupo.isPending,
    tirarGrupo: tirarGrupo.mutate,
    testar: () => teste.mutate(),
    testando: teste.isPending,
    testeEnviado: teste.isSuccess,
    desconectar: () => desconectar.mutate(),
    desconectando: desconectar.isPending,
    erro: codigo.error ?? escolherGrupo.error ?? tirarGrupo.error ?? teste.error ?? desconectar.error,
  };
}
