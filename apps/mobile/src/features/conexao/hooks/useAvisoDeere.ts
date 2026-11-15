import { useMutation } from '@tanstack/react-query';

import { conexaoApi } from '../api/conexaoApi';

/** Liga o aviso (webhook) de export pronto na John Deere. Só quando o administrador toca no botão. */
export function useAvisoDeere() {
  const m = useMutation({ mutationFn: conexaoApi.ativarAviso });
  return { ativar: () => m.mutate(), ativando: m.isPending, resultado: m.data ?? null, erro: m.error };
}
