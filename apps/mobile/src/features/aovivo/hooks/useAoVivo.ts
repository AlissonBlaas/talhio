import type { Maquina } from '@talhio/shared';

import { useLinhasDoTalhao } from '@/features/linhas';
import { useMaquinas } from '@/features/maquinas';
import { tarefaDoPlano, usePlanoDoTalhao } from '@/features/planos';
import { useTalhoes } from '@/features/talhoes';
import { duracaoDesde, horaDoDia } from '@/shared/lib/format';

export type Evento = { quando: string; texto: string; agora: boolean };

const VERBO = { plantio: 'plantado', pulverizacao: 'pulverizado', adubacao: 'adubado', colheita: 'colhido' } as const;
const FAZENDO = { plantio: 'Plantando', pulverizacao: 'Pulverizando', adubacao: 'Adubando', colheita: 'Colhendo' } as const;
const NOME = { plantio: 'Plantio', pulverizacao: 'Pulverização', adubacao: 'Adubação', colheita: 'Colheita' } as const;

const velocidade = (maquina: Maquina) => (maquina.velocidadeKmH === null ? null : `${maquina.velocidadeKmH.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km/h`);

/**
 * O andamento de um talhão, atualizado a cada 30 s: quanto já foi feito, a máquina que está lá,
 * a previsão de término e o que aconteceu até agora.
 */
export function useAoVivo(talhaoId: string) {
  const { talhoes, carregando: carregandoTalhoes, erro: erroTalhoes, atualizar: atualizarTalhoes } = useTalhoes({ aoVivo: true });
  const { maquinas, carregando: carregandoMaquinas, erro: erroMaquinas, atualizar: atualizarMaquinas } = useMaquinas();
  const talhao = talhoes.find((t) => t.id === talhaoId) ?? null;
  const linhas = useLinhasDoTalhao(talhao);
  const plano = usePlanoDoTalhao(talhaoId);

  const noTalhao = maquinas.filter((m) => m.talhaoId === talhaoId);
  // A máquina em destaque: a que está trabalhando; na falta, a primeira que está no talhão.
  const maquina = noTalhao.find((m) => m.status === 'trabalhando') ?? noTalhao[0] ?? null;
  const operacao = talhao?.operacao ?? plano?.operacao ?? null;
  const percentual = talhao?.percentualFeito ?? null;
  const feitoHa = talhao && percentual !== null ? (talhao.areaHa * percentual) / 100 : null;

  // Ritmo de hoje das máquinas que estão trabalhando aqui (ha por hora). Sem ritmo, sem previsão.
  const ritmo = noTalhao.filter((m) => m.status === 'trabalhando' && m.horasHoje > 0).reduce((soma, m) => soma + m.areaHojeHa / m.horasHoje, 0);
  const faltaHa = talhao && feitoHa !== null ? talhao.areaHa - feitoHa : null;
  const terminaEm = ritmo > 0 && faltaHa !== null && faltaHa > 0 ? new Date(Date.now() + (faltaHa / ritmo) * 3_600_000) : null;
  const hoje = new Date();
  const terminaHoje = terminaEm !== null && terminaEm.toDateString() === hoje.toDateString();

  const eventos: Evento[] = [];
  if (plano) eventos.push({ quando: horaDoDia(plano.criadoEm), texto: 'Plano salvo no Talhio', agora: false });
  if (maquina?.status === 'parada' && maquina.paradaDesde) eventos.push({ quando: horaDoDia(maquina.paradaDesde), texto: `${maquina.nome} parou`, agora: false });
  if (maquina) {
    const texto =
      maquina.status === 'trabalhando'
        ? [operacao ? FAZENDO[operacao] : 'Trabalhando', velocidade(maquina)].filter(Boolean).join(' · ')
        : maquina.status === 'parada'
          ? `Parada${maquina.paradaDesde ? ` há ${duracaoDesde(maquina.paradaDesde)}` : ''}`
          : 'Sem sinal: os dados entram quando a máquina reconectar';
    eventos.push({ quando: 'agora', texto, agora: true });
  }

  return {
    talhao,
    carregando: carregandoTalhoes || carregandoMaquinas,
    erro: erroTalhoes ?? erroMaquinas,
    atualizar: () => {
      atualizarTalhoes();
      atualizarMaquinas();
    },
    linhasGeo: linhas.geo,
    maquina,
    /** "Plantio de milho" (do plano) ou só "Plantio" (da operação em andamento). */
    titulo: plano ? tarefaDoPlano(plano) : operacao ? NOME[operacao] : 'Sem operação',
    percentual,
    feito: operacao ? VERBO[operacao] : 'feito',
    feitoHa,
    velocidade: maquina ? velocidade(maquina) : null,
    sementesPorHa: plano?.sementesPorHa ?? null,
    /** "34 de 52", quando o talhão tem linhas. */
    passadas: linhas.total > 0 ? `${linhas.feitas} de ${linhas.total}` : null,
    termina: terminaEm ? (terminaHoje ? horaDoDia(terminaEm.toISOString()) : terminaEm.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })) : null,
    eventos,
  };
}
