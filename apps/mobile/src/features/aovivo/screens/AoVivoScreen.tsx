import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePontosDasMaquinas } from '@/features/maquinas';
import { limitesDosTalhoes } from '@/features/talhoes';
import { CamadaContornos, CamadaMaquinas, CamadaPassadas, MapaBase } from '@/mapa-motor';
import { AnelPulsante, BarraAnimada } from '@/shared/components/animacoes';
import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { Icone } from '@/shared/components/Icone';
import { hectares, minusculaInicial, siglaTalhao } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { useAoVivo } from '../hooks/useAoVivo';

const COR_DA_BARRA = cores.plantio;

/** Passo 4: o talhão no mapa com o que já foi feito, a máquina e o andamento, atualizando sozinho. */
export function AoVivoScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { talhaoId } = useLocalSearchParams<{ talhaoId: string }>();
  const vivo = useAoVivo(talhaoId);
  const pontos = usePontosDasMaquinas();
  const talhao = vivo.talhao;
  const contorno = useMemo<GeoJSON.Feature<GeoJSON.Polygon> | null>(() => (talhao ? { type: 'Feature', properties: {}, geometry: talhao.contorno } : null), [talhao]);
  const limites = useMemo(() => (talhao ? limitesDosTalhoes([talhao]) : null), [talhao]);

  if (vivo.carregando) return <View style={styles.espera}><Carregando /></View>;
  if (vivo.erro || !talhao || !contorno || !limites) {
    return (
      <View style={styles.espera}>
        <ErroComTentarDeNovo mensagem={vivo.erro?.message ?? 'Talhão não encontrado.'} aoTentar={vivo.erro ? vivo.atualizar : () => router.back()} />
      </View>
    );
  }

  const maquina = vivo.maquina;
  const quem = maquina ? [maquina.nome, maquina.operador, maquina.implemento ? minusculaInicial(maquina.implemento) : null].filter(Boolean).join(' · ') : 'Nenhuma máquina neste talhão agora';

  return (
    <View style={styles.tela}>
      <MapaBase limites={limites} margem={{ top: top + 110, right: 36, bottom: 380, left: 36 }} mostrarAtribuicao={false}>
        <CamadaContornos geo={contorno} estilo="foco" />
        <CamadaPassadas geo={vivo.linhasGeo} />
        <CamadaMaquinas geo={pontos} selecionadaId={maquina?.id ?? null} />
      </MapaBase>

      <View style={[styles.topo, { top: top + 6 }]} pointerEvents="box-none">
        <View style={styles.linhaDoTopo}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.voltar}>
            <Icone nome="voltar" cor={cores.texto} tamanho={20} espessura={2} />
          </Pressable>
          <View style={styles.faixa}>
            <Text style={styles.faixaTexto} numberOfLines={1}>
              {siglaTalhao(talhao.nome)} · {vivo.titulo}
            </Text>
            <View style={styles.aoVivo}>
              <View style={styles.ponto}>
                <AnelPulsante cor={cores.aoVivo} tamanho={8} />
              </View>
              <Text style={styles.aoVivoTexto}>AO VIVO</Text>
            </View>
          </View>
        </View>
        <View style={styles.passos} accessibilityRole="progressbar" accessibilityLabel="Passo 4 de 4">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.passo} />
          ))}
        </View>
      </View>

      <View style={[styles.painel, { paddingBottom: Math.max(bottom, 16) + 12 }]}>
        <View style={styles.alca} />
        <View style={styles.cabecalho}>
          <View style={styles.titulos}>
            <Text style={styles.quem} numberOfLines={2}>
              Passo 4 de 4 · {quem}
            </Text>
            <Text style={styles.percentual}>{vivo.percentual === null ? 'Ainda não começou' : `${Math.round(vivo.percentual)}% ${vivo.feito}`}</Text>
          </View>
          <View style={styles.direita}>
            {vivo.feitoHa !== null ? <Text style={styles.area}>{Math.round(vivo.feitoHa).toLocaleString('pt-BR')} de {hectares(talhao.areaHa)}</Text> : null}
            <Pressable accessibilityRole="link" onPress={() => router.navigate('/relatorios')} hitSlop={8} style={styles.relatorio}>
              <Text style={styles.relatorioTexto}>Ver relatório do dia →</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.trilho}>
          <BarraAnimada percentual={vivo.percentual ?? 0} cor={COR_DA_BARRA} altura={8} />
        </View>

        <View style={styles.dados}>
          <Dado rotulo="Velocidade" valor={vivo.velocidade ?? '—'} />
          <Dado rotulo={vivo.sementesPorHa ? 'Sementes/ha (plano)' : 'Passadas'} valor={vivo.sementesPorHa ? vivo.sementesPorHa.toLocaleString('pt-BR') : (vivo.passadas ?? '—')} />
          <Dado rotulo="Termina" valor={vivo.termina ?? '—'} />
        </View>

        <View style={styles.eventos}>
          {vivo.eventos.map((evento) => (
            <View key={`${evento.quando}-${evento.texto}`} style={styles.evento}>
              <Text style={styles.eventoQuando}>{evento.quando}</Text>
              <View style={[styles.eventoPonto, evento.agora && styles.eventoPontoAgora]} />
              <Text style={[styles.eventoTexto, evento.agora && styles.eventoTextoAgora]} numberOfLines={2}>
                {evento.texto}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.dado}>
      <Text style={styles.dadoRotulo} numberOfLines={1}>
        {rotulo}
      </Text>
      <Text style={styles.dadoValor} numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.mapaFundo },
  espera: { flex: 1, backgroundColor: cores.fundo, justifyContent: 'center' },
  topo: { position: 'absolute', left: 16, right: 16, gap: 10 },
  linhaDoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voltar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, alignItems: 'center', justifyContent: 'center' },
  faixa: { flex: 1, height: 44, borderRadius: 22, backgroundColor: cores.controleMapa, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16 },
  faixaTexto: { flex: 1, fontFamily: fontes.semi, fontSize: 14, color: cores.sobreEscuro },
  aoVivo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.aoVivo },
  aoVivoTexto: { fontFamily: fontes.semi, fontSize: 11, letterSpacing: 0.4, color: cores.aoVivoTexto },
  passos: { flexDirection: 'row', gap: 6, backgroundColor: cores.controleMapa, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8 },
  passo: { flex: 1, height: 4, borderRadius: 2, backgroundColor: cores.desenho },
  painel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: cores.cartao, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 20, gap: 14 },
  alca: { width: 40, height: 5, borderRadius: 3, backgroundColor: cores.alca, alignSelf: 'center' },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  titulos: { flex: 1, gap: 2 },
  quem: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 16, color: cores.textoSuave },
  percentual: { fontFamily: fontes.titulo, fontSize: 28, lineHeight: 31, color: cores.texto },
  direita: { alignItems: 'flex-end' },
  area: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoSuave },
  relatorio: { paddingTop: 8, paddingBottom: 4 },
  relatorioTexto: { fontFamily: fontes.semi, fontSize: 13, color: cores.primario },
  trilho: { height: 8, borderRadius: 4, backgroundColor: cores.divisor, overflow: 'hidden' },
  dados: { flexDirection: 'row', gap: 8 },
  dado: { flex: 1, backgroundColor: cores.fundo, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  dadoRotulo: { fontFamily: fontes.regular, fontSize: 11, lineHeight: 14, color: cores.textoSuave },
  dadoValor: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 19, color: cores.texto },
  eventos: { gap: 8 },
  evento: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventoQuando: { width: 44, fontFamily: fontes.regular, fontSize: 13, color: cores.textoSuave, fontVariant: ['tabular-nums'] },
  eventoPonto: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.semSinal },
  eventoPontoAgora: { backgroundColor: cores.online },
  eventoTexto: { flex: 1, fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoMedio },
  eventoTextoAgora: { fontFamily: fontes.semi, color: cores.texto },
});
