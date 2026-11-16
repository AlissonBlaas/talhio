import { useMutation } from '@tanstack/react-query';

import { sessao } from '@/shared/lib/sessao';

import { authApi } from '../api/authApi';

export function useCadastrar() {
  const mutacao = useMutation({
    mutationFn: authApi.cadastrar,
    // Conta que já vem liberada entra logada (o layout raiz troca para o app, que leva ao onboarding).
    // Conta que espera aprovação não abre sessão: a tela mostra o aviso de que entraremos em contato.
    onSuccess: (resultado) => ('aguardandoAprovacao' in resultado ? undefined : sessao.definir(resultado)),
  });
  return {
    cadastrar: mutacao.mutate,
    cadastrando: mutacao.isPending,
    /** O cadastro foi recebido e está esperando a nossa aprovação. */
    emAnalise: mutacao.data !== undefined && 'aguardandoAprovacao' in mutacao.data,
    erro: mutacao.error,
    limparErro: mutacao.reset,
  };
}
