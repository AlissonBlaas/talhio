import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { limitesDosTalhoes } from '@/features/talhoes';
import { BotoesDeZoom, CamadaMaquinas, CamadaPassadas, CamadaRastros, CamadaTalhoes, MapaBase, type MapaControle } from '@/mapa-motor';
import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

import { PainelSelecao } from '../components/PainelSelecao';
import { useMapaDaFazenda } from '../hooks/useMapaDaFazenda';

/** Zoom ao tocar numa máquina: perto o bastante para ver as passadas ao redor dela. */
const ZOOM_NA_MAQUINA = 16;


export function MapaScreen() {
  const mapa = useMapaDaFazenda();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const controle = useRef<MapaControle>(null);
  // Com muitas máquinas guardadas, as sem sinal atrapalham achar quem está no campo: dá para tirar do mapa.
  const [esconderSemSinal, setEsconderSemSinal] = useState(false);
  const doEstado = (status: 'trabalhando' | 'parada' | 'sem-sinal') => mapa.maquinas.filter((m) => m.status === status);
  const trabalhando = doEstado('trabalhando');
  const paradas = doEstado('parada');
  const semSinal = doEstado('sem-sinal');

  /** Enquadra as máquinas de um estado, para achar de uma vez quem está trabalhando (ou parada com sinal). */
  const mostrar = (maquinas: typeof trabalhando) => {
    const pontos = maquinas.flatMap((m) => (m.posicao ? [m.posicao] : []));
    if (pontos.length === 0) return;
    mapa.limparSelecao();
    if (pontos.length === 1) return controle.current?.irPara([pontos[0]!.lng, pontos[0]!.lat], { zoomMinimo: ZOOM_NA_MAQUINA - 1, margem: { top: top + 120, right: 0, bottom: 230, left: 0 } });
    const lngs = pontos.map((p) => p.lng);
    const lats = pontos.map((p) => p.lat);
    controle.current?.enquadrar([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], { margem: { top: top + 140, right: 60, bottom: 260, left: 60 } });
  };

  /** Seleciona a máquina e aproxima o mapa até ela (sem afastar, se já estiver mais perto). */
  const irParaMaquina = (id: string) => {
    mapa.selecionarMaquina(id);
    const posicao = mapa.maquinas.find((m) => m.id === id)?.posicao;
    // O painel de detalhes cobre a parte de baixo: a máquina fica centrada na área visível.
    if (posicao) controle.current?.irPara([posicao.lng, posicao.lat], { zoomMinimo: ZOOM_NA_MAQUINA, margem: { top: top + 60, right: 0, bottom: 260, left: 0 } });
  };

  /** Seleciona o talhão e enquadra o contorno dele, com folga para o painel de baixo. */
  const irParaTalhao = (id: string) => {
    mapa.selecionarTalhao(id);
    const talhao = mapa.talhoes.find((t) => t.id === id);
    const limites = talhao ? limitesDosTalhoes([talhao]) : null;
    if (limites) controle.current?.enquadrar(limites, { margem: { top: top + 80, right: 40, bottom: 330, left: 40 } });
  };

  if (mapa.carregando) return <View style={styles.espera}><Carregando /></View>;
  // Ainda sem nada para enquadrar, mas o resto está vindo: segue esperando em vez de dizer que está vazio.
  if (!mapa.erro && !mapa.limites && mapa.carregandoResto) return <View style={styles.espera}><Carregando /></View>;
  if (mapa.erro || !mapa.limites) {
    return (
      <View style={styles.espera}>
        <ErroComTentarDeNovo mensagem={mapa.erro?.message ?? 'Nenhum talhão para mostrar.'} aoTentar={mapa.atualizar} />
      </View>
    );
  }

  return (
    <View style={styles.tela}>
      <MapaBase ref={controle} limites={mapa.limites} margem={{ top: top + 90, right: 40, bottom: 230, left: 40 }} permitirGirar aoTocar={mapa.limparSelecao}>
        <CamadaTalhoes geo={mapa.talhoesGeo} selecionadoId={mapa.talhaoSelecionadoId} rotulos={mapa.rotulos} aoTocar={irParaTalhao} />
        <CamadaPassadas geo={mapa.linhaGeo} />
        <CamadaRastros geo={mapa.rastrosGeo} paradas={mapa.paradasGeo} selecionadaId={mapa.maquinaSelecionadaId} />
        <CamadaMaquinas geo={mapa.maquinasGeo} selecionadaId={mapa.maquinaSelecionadaId} esconderSemSinal={esconderSemSinal} aoTocar={irParaMaquina} />
      </MapaBase>

      <View style={[styles.topo, { top: top + 5 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.redondo}>
          <Icone nome="voltar" cor={cores.texto} tamanho={20} espessura={2} />
        </Pressable>
        <View style={styles.tituloPill}>
          <Text style={styles.titulo}>Mapa da fazenda</Text>
        </View>
      </View>

      {/* Quantas máquinas em cada estado, com a mesma cor e o mesmo tamanho do mapa. Tocar leva até elas. */}
      {mapa.maquinas.length > 0 ? (
        <View style={[styles.estados, { top: top + 57 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${trabalhando.length} trabalhando. Mostrar no mapa`} disabled={trabalhando.length === 0} onPress={() => mostrar(trabalhando)} style={[styles.estado, trabalhando.length > 0 && styles.estadoTrabalhando]}>
            <View style={[styles.bolinha, styles.bolinhaTrabalhando]} />
            <Text style={[styles.estadoTexto, trabalhando.length > 0 && styles.estadoTextoForte]}>{trabalhando.length} trabalhando</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${paradas.length} paradas com sinal. Mostrar no mapa`} disabled={paradas.length === 0} onPress={() => mostrar(paradas)} style={styles.estado}>
            <View style={[styles.bolinha, styles.bolinhaParada]} />
            <Text style={styles.estadoTexto}>{paradas.length} {paradas.length === 1 ? 'parada' : 'paradas'}</Text>
          </Pressable>
          {semSinal.length > 0 ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={`${semSinal.length} sem sinal`}
              accessibilityState={{ checked: !esconderSemSinal }}
              onPress={() => setEsconderSemSinal((atual) => !atual)}
              style={[styles.estado, esconderSemSinal && styles.estadoDesligado]}>
              <View style={[styles.bolinha, styles.bolinhaSemSinal]} />
              <Text style={[styles.estadoTexto, esconderSemSinal && styles.estadoTextoRiscado]}>{semSinal.length} sem sinal</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.lateral, { top: top + 113 }]}>
        <BotoesDeZoom controle={controle} />
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/novo-plano')} style={styles.novoTalhao}>
          <Icone nome="mais" cor={cores.sobreEscuro} tamanho={16} espessura={2.4} />
          <Text style={styles.novoTalhaoTexto}>Novo plano</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/importar')} style={[styles.novoTalhao, styles.importar]}>
          <Text style={styles.novoTalhaoTexto}>Importar</Text>
        </Pressable>
      </View>

      <PainelSelecao selecao={mapa.selecao} aoFechar={mapa.limparSelecao} aoVerMaquina={(id) => router.navigate({ pathname: '/maquina/[id]', params: { id } })} aoPlanejar={(talhaoId) => router.navigate({ pathname: '/planejar', params: { talhaoId } })}
        aoLinhaAb={(talhaoId) => router.navigate({ pathname: '/linha-ab', params: { talhaoId } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.mapaFundo },
  espera: { flex: 1, backgroundColor: cores.fundo },
  topo: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, alignItems: 'center', justifyContent: 'center' },
  tituloPill: { height: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: cores.controleMapa },
  titulo: { fontFamily: fontes.semi, fontSize: 14, color: cores.sobreEscuro },
  estados: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  estado: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 22, backgroundColor: cores.controleMapa },
  estadoTrabalhando: { backgroundColor: cores.cartao },
  estadoDesligado: { opacity: 0.55 },
  estadoTexto: { fontFamily: fontes.semi, fontSize: 13, color: cores.sobreEscuro },
  estadoTextoForte: { color: cores.texto },
  estadoTextoRiscado: { textDecorationLine: 'line-through' },
  bolinha: { borderRadius: 999, borderColor: '#FFFFFF' },
  bolinhaTrabalhando: { width: 16, height: 16, backgroundColor: cores.folha, borderWidth: 2.5 },
  bolinhaParada: { width: 14, height: 14, backgroundColor: cores.parada, borderWidth: 2 },
  bolinhaSemSinal: { width: 9, height: 9, backgroundColor: cores.semSinalNoMapa, borderWidth: 1.5 },
  lateral: { position: 'absolute', right: 16, alignItems: 'flex-end', gap: 14 },
  novoTalhao: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: cores.primario,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  importar: { backgroundColor: cores.controleMapa },
  novoTalhaoTexto: { fontFamily: fontes.semi, fontSize: 13, color: cores.sobreEscuro },
});
