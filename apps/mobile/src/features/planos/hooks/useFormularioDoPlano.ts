import { NovoPlanoSchema, type Maquina, type NovoPlano, type Operacao } from '@talhio/shared';
import { useState } from 'react';

import { conexaoDe, lerNumero, MAQUINA_DA_OPERACAO, proximosDias } from '../textos';

type Textos = { variedade: string; sementesPorHa: string; espacamentoCm: string; produto: string; doseProduto: string; recado: string };
const VAZIO: Textos = { variedade: '', sementesPorHa: '', espacamentoCm: '', produto: '', doseProduto: '', recado: '' };

/**
 * Tudo que o formulário do plano decide: quais máquinas servem para a operação, quais já vêm
 * marcadas, o que falta preencher e os dados prontos para salvar.
 */
export function useFormularioDoPlano(talhaoId: string, maquinas: Maquina[]) {
  const [operacao, setOperacao] = useState<Operacao>('plantio');
  const [cultura, setCultura] = useState<string | null>(null);
  const [textos, setTextos] = useState<Textos>(VAZIO);
  const [dataInicio, setDataInicio] = useState(() => proximosDias(1)[0]!.valor);
  const [outrosTalhoes, setOutrosTalhoes] = useState<string[]>([]);
  /** Nulo = a pessoa ainda não mexeu: valem as sugeridas. */
  const [escolhidas, setEscolhidas] = useState<string[] | null>(null);
  const [tentou, setTentou] = useState(false);

  const servem = maquinas.filter((m) => m.tipo === MAQUINA_DA_OPERACAO[operacao]);
  // Sugerida: serve para a operação e está online agora. Sem internet não recebe plano.
  const sugeridas = servem.filter((m) => conexaoDe(m) === 'online').map((m) => m.id);
  const marcadas = (escolhidas ?? sugeridas).filter((id) => servem.some((m) => m.id === id && conexaoDe(m) !== 'sem-internet'));

  const dados: NovoPlano = {
    talhaoIds: [talhaoId, ...outrosTalhoes],
    operacao,
    cultura,
    variedade: textos.variedade.trim() || null,
    sementesPorHa: lerNumero(textos.sementesPorHa),
    espacamentoCm: lerNumero(textos.espacamentoCm),
    produto: textos.produto.trim() || null,
    doseProduto: lerNumero(textos.doseProduto),
    dataInicio,
    recado: textos.recado.trim() || null,
    maquinaIds: marcadas,
  };
  const validacao = NovoPlanoSchema.safeParse(dados);
  const faltando = validacao.success ? [] : validacao.error.issues.map((i) => String(i.path[0]));
  const alternar = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  return {
    operacao,
    trocarOperacao: (nova: Operacao) => {
      setOperacao(nova);
      // Outra operação, outras máquinas: voltam as sugeridas.
      setEscolhidas(null);
    },
    cultura,
    setCultura,
    textos,
    escrever: (campo: keyof Textos, valor: string) => setTextos((atual) => ({ ...atual, [campo]: valor })),
    dataInicio,
    setDataInicio,
    outrosTalhoes,
    alternarTalhao: (id: string) => setOutrosTalhoes((atual) => alternar(atual, id)),
    maquinasQueServem: servem,
    maquinasOcultas: maquinas.length - servem.length,
    sugeridas,
    marcadas,
    alternarMaquina: (id: string) => setEscolhidas(alternar(marcadas, id)),
    /** true quando o campo é obrigatório, está vazio e a pessoa já tentou salvar. */
    falta: (campo: string) => tentou && faltando.includes(campo),
    temErro: tentou && faltando.length > 0,
    /** Devolve os dados prontos, ou nulo (e passa a mostrar o que falta). */
    conferir: () => {
      setTentou(true);
      return validacao.success ? dados : null;
    },
  };
}
