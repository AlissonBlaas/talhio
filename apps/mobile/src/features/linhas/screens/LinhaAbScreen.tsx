import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { limitesDosTalhoes, useTalhoes } from '@/features/talhoes';
import { BotoesDeZoom, CamadaContornos, CamadaLinhaAB, MapaBase, type LngLat, type MapaControle } from '@/mapa-motor';
import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { Icone } from '@/shared/components/Icone';
import { siglaTalhao } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { PainelLinha } from '../components/PainelLinha';
import { useCriarLinha } from '../hooks/useCriarLinha';
import { LARGURA_IMPLEMENTO_M, useDesenhoLinha } from '../hooks/useDesenhoLinha';
import { useLinhasPadrao } from '../hooks/useLinhasPadrao';

export function LinhaAbScreen() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { talhaoId, origem } = useLocalSearchParams<{ talhaoId: string; origem?: string }>();
  const { talhoes, carregando, erro: erroTalhoes, atualizar } = useTalhoes();
  const talhao = talhoes.find((t) => t.id === talhaoId);
  const desenho = useDesenhoLinha(talhao);
  const controle = useRef<MapaControle>(null);
  const contorno = useMemo<GeoJSON.Feature<GeoJSON.Polygon> | null>(() => (talhao ? { type: 'Feature', properties: {}, geometry: talhao.contorno } : null), [talhao]);
  const pontoA = useMemo<LngLat | null>(() => (desenho.a ? [desenho.a.lng, desenho.a.lat] : null), [desenho.a]);
  const pontoB = useMemo<LngLat | null>(() => (desenho.b ? [desenho.b.lng, desenho.b.lat] : null), [desenho.b]);
  const { linhasPadrao } = useLinhasPadrao();
  const { criar, salvando, salva, erro: erroSalvar, limparErro } = useCriarLinha();
  const [nome, setNome] = useState<string | null>(null);
  const [comoPadrao, setComoPadrao] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);

  if (carregando) return <View style={styles.espera}><Carregando /></View>;
  if (erroTalhoes || !talhao || !contorno) {
    return (
      <View style={styles.espera}>
        <ErroComTentarDeNovo mensagem={erroTalhoes?.message ?? 'Talhão não encontrado.'} aoTentar={erroTalhoes ? atualizar : () => router.back()} />
      </View>
    );
  }

  const limites = limitesDosTalhoes([talhao]);
  const nomeAtual = nome ?? `${siglaTalhao(talhao.nome)} · Plantio`;
  const nomeVazio = nomeAtual.trim() === '';
  const erro = tentouSalvar && nomeVazio ? 'Dê um nome à linha' : (erroSalvar?.message ?? null);
  const passo = desenho.a === null ? 'A' : desenho.completa ? '✓' : 'B';
  const dica =
    desenho.a === null
      ? 'Toque no início da linha (ponto A), dentro do talhão'
      : desenho.completa
        ? 'Confira as passadas. Toque de novo no mapa para recomeçar'
        : 'Agora toque no fim da linha (ponto B)';

  const salvar = () => {
    setTentouSalvar(true);
    if (nomeVazio || !desenho.a || !desenho.b) return;
    criar({ nome: nomeAtual.trim(), talhaoId: talhao.id, a: desenho.a, b: desenho.b, padraoDaFazenda: comoPadrao });
  };

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.mapaArea}>
        <MapaBase
          ref={controle}
          limites={limites}
          margem={{ top: top + 120, right: 40, bottom: 40, left: 40 }}
          aoTocar={([lng, lat]) => {
            if (!salva && !salvando) desenho.tocar({ lat, lng });
          }}>
          <CamadaContornos geo={contorno} estilo="foco" />
          <CamadaLinhaAB geo={desenho.geo} a={pontoA} b={pontoB} salva={!!salva} />
        </MapaBase>
        <BotoesDeZoom controle={controle} style={styles.zoom} />

        <View style={[styles.topo, { top: top + 5 }]}>
          <View style={styles.linha}>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.redondo}>
              <Icone nome="voltar" cor={cores.texto} tamanho={20} espessura={2} />
            </Pressable>
            <View style={styles.tituloPill}>
              <Text style={styles.titulo} numberOfLines={1}>
                {talhao.nome} · Linha de plantio
              </Text>
            </View>
          </View>
          {salva ? null : (
            <View style={styles.dica}>
              <View style={styles.contador}>
                <Text style={styles.contadorTexto}>{passo}</Text>
              </View>
              <Text style={styles.dicaTexto}>{dica}</Text>
            </View>
          )}
        </View>
      </View>

      <PainelLinha
        completa={desenho.completa}
        direcao={desenho.direcao}
        larguraM={LARGURA_IMPLEMENTO_M}
        quantidadePassadas={desenho.quantidadePassadas}
        linhasPadrao={linhasPadrao}
        nome={nomeAtual}
        aoMudarNome={(texto) => {
          setNome(texto);
          if (erroSalvar) limparErro();
        }}
        comoPadrao={comoPadrao}
        aoAlternarPadrao={() => setComoPadrao((atual) => !atual)}
        erro={erro}
        salvando={salvando}
        confirmacao={
          salva
            ? salva.padraoDaFazenda
              ? 'Linha salva como padrão da fazenda e enviada. Ela fica disponível para os outros talhões.'
              : 'Linha salva e enviada. Ela aparece nos monitores das máquinas.'
            : null
        }
        aoUsarPadrao={(linha) => {
          desenho.usarDirecao(linha.direcaoGraus);
          setNome(`${siglaTalhao(talhao.nome)} · ${linha.nome}`);
        }}
        aoUsarBorda={desenho.usarBordaMaisLonga}
        aoRefazer={() => {
          desenho.refazer();
          setTentouSalvar(false);
          limparErro();
        }}
        aoSalvar={salvar}
        // Vindo do plano, volta para ele (o formulário continua preenchido). Senão, o passo seguinte é planejar.
        aoConcluir={() => (origem === 'plano' ? router.back() : router.replace({ pathname: '/planejar', params: { talhaoId: talhao.id } }))}
        rotuloConcluir={origem === 'plano' ? 'Voltar ao plano' : 'Próximo: planejar a operação'}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.mapaFundo },
  espera: { flex: 1, backgroundColor: cores.fundo },
  mapaArea: { flex: 1 },
  zoom: { position: 'absolute', right: 16, bottom: 16 },
  topo: { position: 'absolute', left: 16, right: 16, gap: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, alignItems: 'center', justifyContent: 'center' },
  tituloPill: { flexShrink: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: cores.controleMapa },
  titulo: { fontFamily: fontes.semi, fontSize: 14, color: cores.sobreEscuro },
  dica: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contador: { width: 28, height: 28, borderRadius: 14, backgroundColor: cores.desenho, alignItems: 'center', justifyContent: 'center' },
  contadorTexto: { fontFamily: fontes.semi, fontSize: 13, color: cores.desenhoTexto },
  dicaTexto: { flex: 1, fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.dicaTexto },
});
