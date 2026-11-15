import type { Mensagem } from '@talhio/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { assistenteApi } from '../api/assistenteApi';
import { assistenteKeys } from '../assistente.keys';

/**
 * A conversa aberta na tela. O servidor guarda o histórico: o app manda só a pergunta nova e o
 * id da conversa, e mostra na hora o que a pessoa escreveu enquanto a resposta não chega.
 */
export function useConversa() {
  const queryClient = useQueryClient();
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  /** Número (dentro da conversa) da mensagem mais antiga que está na tela. Maior que 0 = há mais antigas no servidor. */
  const [primeiraOrdem, setPrimeiraOrdem] = useState(0);
  /** Quantas mensagens do fim chegaram agora, nesta tela (só essas entram animadas). */
  const [novas, setNovas] = useState(0);

  /** A resposta está chegando aos poucos (a fala do assistente já está na tela, ainda incompleta). */
  const [transmitindo, setTransmitindo] = useState(false);
  /** Mesma informação, para ler dentro dos callbacks sem esperar a tela redesenhar. */
  const transmitindoRef = useRef(false);

  /** Soma o trecho recebido à fala do assistente que está sendo escrita (a cria no primeiro trecho). */
  const acrescentar = (trecho: string) => {
    const continua = transmitindoRef.current;
    transmitindoRef.current = true;
    setTransmitindo(true);
    if (!continua) setNovas((n) => n + 1);
    setMensagens((atuais) => {
      const ultima = atuais.at(-1);
      return continua && ultima?.papel === 'assistente' ? [...atuais.slice(0, -1), { papel: 'assistente', texto: ultima.texto + trecho }] : [...atuais, { papel: 'assistente', texto: trecho }];
    });
  };

  const terminarFluxo = () => {
    transmitindoRef.current = false;
    setTransmitindo(false);
  };

  const pergunta = useMutation({
    mutationFn: (p: { conversaId: string | null; texto: string }) => {
      transmitindoRef.current = false;
      return assistenteApi.perguntarEmFluxo(p, acrescentar);
    },
    onError: () => {
      // Falhou no meio: o servidor não guardou nada. Tira a fala incompleta para "tentar de novo" reenviar a pergunta.
      const incompleta = transmitindoRef.current;
      if (incompleta) setMensagens((atuais) => (atuais.at(-1)?.papel === 'assistente' ? atuais.slice(0, -1) : atuais));
      terminarFluxo();
    },
    onSuccess: (resposta) => {
      setConversaId(resposta.conversaId);
      // Com a resposta em fluxo a fala já está na tela; o texto final do servidor a substitui.
      const jaNaTela = transmitindoRef.current;
      if (!jaNaTela) setNovas((n) => n + 1);
      setMensagens((atuais) => {
        const ultima = atuais.at(-1);
        return jaNaTela && ultima?.papel === 'assistente' ? [...atuais.slice(0, -1), { papel: 'assistente', texto: resposta.texto }] : [...atuais, { papel: 'assistente', texto: resposta.texto }];
      });
      terminarFluxo();
      setSugestoes(resposta.sugestoes);
      // A lista do histórico mudou (conversa nova ou movida para o topo).
      void queryClient.invalidateQueries({ queryKey: assistenteKeys.conversas() });
    },
  });

  const abertura = useMutation({
    mutationFn: (id: string) => queryClient.fetchQuery({ queryKey: assistenteKeys.conversa(id), queryFn: () => assistenteApi.abrirConversa({ id }), staleTime: 0 }),
    onSuccess: (conversa) => {
      setConversaId(conversa.id);
      // Só o fim da conversa; o resto vem aos poucos, quando a pessoa sobe.
      setMensagens(conversa.mensagens);
      setPrimeiraOrdem(conversa.primeiraOrdem);
      setNovas(0);
      setSugestoes([]);
      pergunta.reset();
    },
  });

  const anteriores = useMutation({
    mutationFn: assistenteApi.abrirConversa,
    onSuccess: (trecho, pedido) => {
      // A pessoa pode ter trocado de conversa enquanto o trecho vinha.
      if (pedido.id !== conversaId || pedido.antes !== primeiraOrdem) return;
      setMensagens((atuais) => [...trecho.mensagens, ...atuais]);
      setPrimeiraOrdem(trecho.primeiraOrdem);
    },
  });

  const limpar = () => {
    setConversaId(null);
    setMensagens([]);
    setPrimeiraOrdem(0);
    setNovas(0);
    anteriores.reset();
    setSugestoes([]);
    pergunta.reset();
    abertura.reset();
  };

  return {
    conversaId,
    mensagens,
    primeiraOrdem,
    novas,
    sugestoes,
    carregandoAnteriores: anteriores.isPending,
    /** Busca o trecho anterior ao que está na tela, se houver. */
    carregarAnteriores: () => {
      if (conversaId && primeiraOrdem > 0 && !anteriores.isPending) anteriores.mutate({ id: conversaId, antes: primeiraOrdem });
    },
    /** Esperando o assistente: some assim que o primeiro trecho aparece. */
    pensando: pergunta.isPending && !transmitindo,
    /** Resposta em andamento (para bloquear novo envio). */
    ocupado: pergunta.isPending,
    abrindo: abertura.isPending,
    erro: pergunta.error ?? abertura.error,
    perguntar: (texto: string) => {
      const limpo = texto.trim().slice(0, 4000);
      if (!limpo || pergunta.isPending) return;
      setMensagens((atuais) => [...atuais, { papel: 'usuario', texto: limpo }]);
      setNovas((n) => n + 1);
      setSugestoes([]);
      pergunta.mutate({ conversaId, texto: limpo });
    },
    /** Reenvia a última pergunta depois de uma falha (ela ainda não foi gravada no servidor). */
    tentarDeNovo: () => {
      const ultima = mensagens.at(-1);
      if (ultima?.papel === 'usuario') pergunta.mutate({ conversaId, texto: ultima.texto });
    },
    /** Abre uma conversa do histórico para ler e continuar. */
    abrir: (id: string) => abertura.mutate(id),
    novaConversa: limpar,
    /** A conversa aberta foi apagada no histórico: a tela volta ao início. */
    aoApagar: (id: string) => {
      if (id === conversaId) limpar();
    },
  };
}
