import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { conexaoApi } from '../api/conexaoApi';
import { conexaoKeys } from '../conexao.keys';

const RETORNO = 'talhio://deere';

const MOTIVOS: Record<string, string> = {
  negado: 'Você não autorizou o Talhio na John Deere. Para conectar, toque em Permitir.',
  'sessao-invalida': 'O tempo para entrar na John Deere acabou. Tente de novo.',
  falhou: 'A John Deere não confirmou o acesso. Tente de novo em instantes.',
};

/** Abre o login da John Deere no navegador do aparelho e volta para o app quando a fazenda autoriza. */
export function useConectarDeere() {
  const queryClient = useQueryClient();
  const mutacao = useMutation({
    mutationFn: async () => {
      const { url } = await conexaoApi.iniciar();
      const resultado = await WebBrowser.openAuthSessionAsync(url, RETORNO);
      // Fechou o navegador sem terminar: não é erro, só segue sem conectar.
      if (resultado.type !== 'success') return;
      const { queryParams } = Linking.parse(resultado.url);
      const erro = queryParams?.erro;
      if (typeof erro === 'string') throw new Error(MOTIVOS[erro] ?? MOTIVOS.falhou);
      // O navegador só traz o código de volta. Quem conclui é o app, com o login de quem está usando: o servidor
      // confere que o pedido de conexão saiu desta mesma fazenda antes de guardar qualquer coisa.
      const codigo = queryParams?.codigo;
      const estado = queryParams?.estado;
      if (typeof codigo === 'string' && typeof estado === 'string') await conexaoApi.concluir(codigo, estado);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: conexaoKeys.todas }),
  });
  return { conectar: () => mutacao.mutate(), conectando: mutacao.isPending, erro: mutacao.error };
}
