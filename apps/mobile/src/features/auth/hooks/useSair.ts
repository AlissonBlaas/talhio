import { useQueryClient } from '@tanstack/react-query';

import { removerPush } from '@/features/notificacoes';
import { sessao } from '@/shared/lib/sessao';

import { authApi } from '../api/authApi';

/** Sai da conta: invalida a sessão no servidor, apaga os tokens do aparelho e os dados em memória. */
export function useSair() {
  const queryClient = useQueryClient();
  return () => {
    // Antes de limpar a sessão (a chamada precisa do login): este aparelho deixa de receber os avisos desta conta.
    void removerPush();
    const tokenRenovacao = sessao.tokenRenovacao();
    // Avisar o servidor é o ideal, mas sair não pode depender de ter internet.
    if (tokenRenovacao) void authApi.sair(tokenRenovacao).catch(() => undefined);
    void sessao.limpar();
    queryClient.clear();
  };
}
