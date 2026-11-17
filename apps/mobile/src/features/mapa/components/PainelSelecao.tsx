import type { Operacao } from '@talhio/shared';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusPill } from '@/features/maquinas';
import { Icone } from '@/shared/components/Icone';
import { hectares, horaDoDia, horasMinutos, minusculaInicial, siglaTalhao } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import type { Selecao } from '../hooks/useMapaDaFazenda';

const OPERACAO: Record<Operacao, { rotulo: string; texto: string; fundo: string; cor: string }> = {
  plantio: { rotulo: 'Plantio', texto: cores.plantioTexto, fundo: cores.plantioFundo, cor: cores.plantio },
  pulverizacao: { rotulo: 'Pulverização', texto: cores.pulverizacaoTexto, fundo: cores.pulverizacaoFundo, cor: cores.pulverizacao },
  adubacao: { rotulo: 'Adubação', texto: cores.plantioTexto, fundo: cores.plantioFundo, cor: cores.plantio },
  colheita: { rotulo: 'Colheita', texto: cores.sucesso, fundo: cores.sucessoFundo, cor: cores.sucesso },
};

type Props = {
  selecao: Selecao;
  aoFechar: () => void;
  aoVerMaquina: (maquinaId: string) => void;
  aoPlanejar: (talhaoId: string) => void;
  aoLinhaAb: (talhaoId: string) => void;
  /** Editar ou apagar o talhão: só aparece nos desenhados no app. */
  aoEditarTalhao: (talhaoId: string) => void;
};

/** Painel inferior do mapa: legenda quando nada está selecionado, detalhes quando há seleção. */
export function PainelSelecao({ selecao, aoFechar, aoVerMaquina, aoPlanejar, aoLinhaAb, aoEditarTalhao }: Props) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.painel, { paddingBottom: Math.max(bottom, 22) + 8 }]}>
      <View style={styles.alca} />
      {selecao === null ? (
        <View style={styles.bloco}>
          <Text style={styles.titulo18}>Toque em um talhão ou máquina</Text>
          <View style={styles.legenda}>
            <ItemLegenda cor={cores.plantio} rotulo="Plantio" />
            <ItemLegenda cor={cores.pulverizacao} rotulo="Pulverização" />
            <ItemLegenda rotulo="Sem operação" />
          </View>
        </View>
      ) : selecao.tipo === 'maquina' ? (
        <View style={styles.bloco}>
          <Cabecalho
            titulo={selecao.maquina.nome}
            subtitulo={
              [selecao.maquina.operador, selecao.maquina.implemento ? minusculaInicial(selecao.maquina.implemento) : null].filter(Boolean).join(' · ') ||
              'Sem operador escalado'
            }
            aoFechar={aoFechar}>
            <StatusPill maquina={selecao.maquina} />
          </Cabecalho>
          <View style={styles.dados}>
            <Dado rotulo="Talhão" valor={selecao.maquina.talhaoNome ? siglaTalhao(selecao.maquina.talhaoNome) : '—'} />
            <Dado rotulo="Horas hoje" valor={horasMinutos(selecao.maquina.horasHoje)} />
            <Dado rotulo="Área hoje" valor={hectares(selecao.maquina.areaHojeHa)} />
          </View>
          {/* Só o essencial aqui, para o painel não cobrir o mapa: motor, combustível, paradas e o uso do dia ficam em "Ver máquina". */}
          <Text style={styles.linhaInfo} numberOfLines={1}>
            {selecao.maquina.status === 'sem-sinal'
              ? `Sem sinal desde ${horaDoDia(selecao.maquina.ultimoSinal)}`
              : [
                  selecao.maquina.velocidadeKmH === null ? null : `${selecao.maquina.velocidadeKmH.toFixed(1).replace('.', ',')} km/h`,
                  selecao.maquina.motorLigado ? 'motor ligado' : 'motor desligado',
                  'sinal agora',
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </Text>
          <Botao rotulo="Ver máquina" onPress={() => aoVerMaquina(selecao.maquina.id)} />
        </View>
      ) : (
        <View style={styles.bloco}>
          <Cabecalho
            titulo={selecao.talhao.nome}
            subtitulo={[selecao.talhao.cultura, hectares(selecao.talhao.areaHa)].filter(Boolean).join(' · ')}
            aoFechar={aoFechar}>
            <PillOperacao operacao={selecao.talhao.operacao} />
          </Cabecalho>
          <View style={styles.dados}>
            <Dado rotulo="Máquinas" valor={String(selecao.maquinasNoTalhao)} />
            <Dado
              rotulo="Passadas"
              valor={
                selecao.linhas.total === 0
                  ? '—'
                  : selecao.talhao.operacao
                    ? `${selecao.linhas.feitas} de ${selecao.linhas.total}`
                    : String(selecao.linhas.total)
              }
            />
            <Dado rotulo="Área" valor={hectares(selecao.talhao.areaHa)} />
          </View>
          {selecao.talhao.operacao && selecao.talhao.percentualFeito !== null ? (
            <View style={styles.progresso}>
              <View style={styles.progressoTopo}>
                <Text style={styles.progressoTitulo}>{Math.round(selecao.talhao.percentualFeito)}% feito</Text>
                <Text style={styles.progressoDetalhe}>
                  {hectares((selecao.talhao.areaHa * selecao.talhao.percentualFeito) / 100)} de {hectares(selecao.talhao.areaHa)}
                </Text>
              </View>
              <View style={styles.trilho}>
                <View style={[styles.barra, { width: `${selecao.talhao.percentualFeito}%`, backgroundColor: OPERACAO[selecao.talhao.operacao].cor }]} />
              </View>
            </View>
          ) : null}
          {selecao.linhas.direcaoGraus !== null ? (
            <Text style={styles.linhaInfo} numberOfLines={1}>
              {selecao.linhas.tipo === 'curva'
                ? `Linhas de plantio: ${selecao.linhas.nome} · curva, importada da John Deere`
                : `Linha AB: ${selecao.linhas.nome} · ${Math.round(selecao.linhas.direcaoGraus)}°`}
            </Text>
          ) : null}
          <View style={styles.botoes}>
            <Pressable accessibilityRole="button" onPress={() => aoLinhaAb(selecao.talhao.id)} style={[styles.botao, styles.botaoSecundario]}>
              <Text style={[styles.botaoTexto, { color: cores.texto }]}>{selecao.linhas.propria ? 'Trocar linha' : 'Criar linha AB'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => aoPlanejar(selecao.talhao.id)} style={[styles.botao, styles.botaoLargo]}>
              <Text style={styles.botaoTexto}>Planejar e enviar</Text>
            </Pressable>
          </View>
          {selecao.talhao.doApp ? (
            <Pressable accessibilityRole="button" onPress={() => aoEditarTalhao(selecao.talhao.id)} style={styles.editar}>
              <Text style={styles.editarTexto}>Editar ou apagar este talhão</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Cabecalho({ titulo, subtitulo, aoFechar, children }: { titulo: string; subtitulo: string; aoFechar: () => void; children: ReactNode }) {
  return (
    <View style={styles.cabecalho}>
      <View style={styles.titulos}>
        <Text style={styles.titulo20} numberOfLines={1}>
          {titulo}
        </Text>
        <Text style={styles.subtitulo} numberOfLines={1}>
          {subtitulo}
        </Text>
      </View>
      <View style={styles.acoes}>
        {children}
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={6} onPress={aoFechar} style={styles.fechar}>
          <Icone nome="fechar" cor={cores.texto} tamanho={16} espessura={2} />
        </Pressable>
      </View>
    </View>
  );
}

function PillOperacao({ operacao }: { operacao: Operacao | null }) {
  const visual = operacao ? OPERACAO[operacao] : { rotulo: 'Aguardando', texto: cores.neutro, fundo: cores.neutroFundo };
  return (
    <View style={[styles.pill, { backgroundColor: visual.fundo }]}>
      <Text style={[styles.pillTexto, { color: visual.texto }]}>{visual.rotulo}</Text>
    </View>
  );
}

function Dado({ rotulo, valor, aviso = false }: { rotulo: string; valor: string; aviso?: boolean }) {
  return (
    <View style={styles.dado}>
      <Text style={styles.dadoRotulo}>{rotulo}</Text>
      <Text style={[styles.dadoValor, aviso ? styles.aviso : null]} numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

function Botao({ rotulo, onPress }: { rotulo: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.botao}>
      <Text style={styles.botaoTexto}>{rotulo}</Text>
    </Pressable>
  );
}

function ItemLegenda({ cor, rotulo }: { cor?: string; rotulo: string }) {
  return (
    <View style={styles.itemLegenda}>
      <View style={[styles.amostra, cor ? { backgroundColor: cor } : styles.amostraVazada]} />
      <Text style={styles.legendaTexto}>{rotulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  painel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: cores.cartao,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  alca: { width: 40, height: 5, borderRadius: 3, backgroundColor: cores.alca, alignSelf: 'center' },
  bloco: { gap: 14 },
  titulo18: { fontFamily: fontes.titulo, fontSize: 18, lineHeight: 19, color: cores.texto },
  titulo20: { fontFamily: fontes.titulo, fontSize: 20, lineHeight: 22, color: cores.texto },
  subtitulo: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 16, color: cores.textoSuave },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amostra: { width: 14, height: 10, borderRadius: 3 },
  amostraVazada: { borderWidth: 2, borderColor: cores.talhaoContorno },
  legendaTexto: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoMedio },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  titulos: { flex: 1, gap: 3 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fechar: { width: 36, height: 36, borderRadius: 18, backgroundColor: cores.fundo, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  pillTexto: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 15 },
  dados: { flexDirection: 'row', gap: 8 },
  dado: { flex: 1, backgroundColor: cores.fundo, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  dadoRotulo: { fontFamily: fontes.regular, fontSize: 11, lineHeight: 14, color: cores.textoSuave },
  dadoValor: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 19, color: cores.texto },
  botao: { height: 48, borderRadius: 999, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  progresso: { gap: 6 },
  progressoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressoTitulo: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 18, color: cores.texto },
  progressoDetalhe: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  trilho: { height: 8, borderRadius: 4, backgroundColor: cores.fundo, overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4 },
  aviso: { color: cores.aviso },
  linhaInfo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  botoes: { flexDirection: 'row', gap: 8 },
  editar: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginBottom: -8 },
  editarTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.textoMedio, textDecorationLine: 'underline' },
  botaoSecundario: { flex: 1, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.bordaForte },
  botaoLargo: { flex: 2 },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 16, color: cores.sobreMilho },
});
