import type { Plano, Turno } from '@talhio/shared';
import { useState } from 'react';

import { useEscala, useMudarEscala, type ItemParaGravar } from '@/features/escala';
import { useEnviarAoGrupo } from '@/features/whatsapp';

import { mensagemDaEscala, tarefaDoPlano } from '../textos';

type Escolha = { operador: string; turno: Turno };
export type LinhaDaEscalaDoPlano = Escolha & { maquinaId: string; maquinaNome: string; implemento: string | null; repetido: boolean; faltando: boolean; enviada: boolean; turnoGravado?: Turno };

const igual = (a: string, b: string) => a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0;

/**
 * Quem opera cada máquina do plano, no dia em que ele começa. Parte da escala que já existe para
 * esse dia; o que a pessoa muda fica aqui até ela enviar.
 */
export function useEscalaDoPlano(plano: Plano) {
  const dia = plano.dataInicio;
  const { escala, carregando, erro: erroEscala, atualizar } = useEscala(dia);
  const mudar = useMudarEscala(dia);
  const [mudancas, setMudancas] = useState<Record<string, Partial<Escolha>>>({});
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const envio = useEnviarAoGrupo();

  const base = plano.maquinas.map((maquina) => {
    const item = escala?.itens.find((i) => i.maquinaId === maquina.id);
    const mudanca = mudancas[maquina.id] ?? {};
    return {
      maquinaId: maquina.id,
      maquinaNome: maquina.nome,
      implemento: item?.implemento ?? null,
      operador: mudanca.operador ?? item?.operador ?? '',
      turno: mudanca.turno ?? item?.turno ?? ('dia-todo' as Turno),
      // A linha que já estava gravada para esta máquina: se o turno mudar aqui, ela sai (a escala é por turno).
      turnoGravado: item?.definida ? item.turno : undefined,
      // Mexeu depois de enviar: deixa de constar como enviada.
      enviada: !!item?.enviadaEm && !mudancas[maquina.id],
    };
  });
  const linhas: LinhaDaEscalaDoPlano[] = base.map((linha) => ({
    ...linha,
    repetido: linha.operador.trim() !== '' && base.some((outra) => outra.maquinaId !== linha.maquinaId && igual(outra.operador, linha.operador)),
    faltando: tentou && linha.operador.trim() === '',
  }));
  const invalida = linhas.some((l) => l.operador.trim() === '' || l.repetido);
  const mudar1 = (maquinaId: string, mudanca: Partial<Escolha>) => {
    mudar.limparErro();
    setMudancas((atuais) => ({ ...atuais, [maquinaId]: { ...atuais[maquinaId], ...mudanca } }));
  };

  return {
    linhas,
    /** Nomes já usados na escala desse dia, como atalho. */
    operadores: [...new Set((escala?.itens ?? []).flatMap((i) => (i.operador ? [i.operador] : [])))],
    carregando,
    erroAoCarregar: erroEscala,
    atualizar,
    escolherOperador: (maquinaId: string, operador: string) => mudar1(maquinaId, { operador }),
    escolherTurno: (maquinaId: string, turno: Turno) => mudar1(maquinaId, { turno }),
    /** A mensagem que vai para o WhatsApp, com o que está escolhido agora. */
    mensagem: mensagemDaEscala(plano, linhas),
    precisaAjustar: tentou && invalida,
    erro: mudar.erro,
    enviando,
    /** true quando o envio dispara direto no grupo do WhatsApp da fazenda. */
    paraOGrupo: envio.paraOGrupo,
    /** Por que não dá para enviar ("Conecte o WhatsApp"...). Nulo = dá. Sem envio, o botão só grava a escala. */
    falta: envio.falta,
    enviada: linhas.length > 0 && linhas.every((l) => l.enviada),
    /** Grava a escala das máquinas do plano e, com o WhatsApp da fazenda conectado, manda a mensagem ao grupo e registra o envio. */
    enviar: async () => {
      setTentou(true);
      if (invalida || enviando) return;
      setEnviando(true);
      try {
        const itens: ItemParaGravar[] = linhas.map((l) => ({
          maquinaId: l.maquinaId,
          dados: { operador: l.operador.trim(), turno: l.turno, tarefa: tarefaDoPlano(plano), talhaoId: plano.talhoes[0]?.id ?? null, substitui: l.turnoGravado },
        }));
        await mudar.definirVarias(itens);
        // Só registra o envio se a mensagem saiu no grupo da fazenda. Sem WhatsApp conectado, a escala fica só gravada.
        if (await envio.enviar({ texto: mensagemDaEscala(plano, linhas) })) mudar.marcarEnviada(linhas.map((l) => l.maquinaId));
        setMudancas({});
      } catch {
        // O erro aparece na tela por `erro` (por exemplo: operador já escalado em outra máquina).
      } finally {
        setEnviando(false);
      }
    },
  };
}
