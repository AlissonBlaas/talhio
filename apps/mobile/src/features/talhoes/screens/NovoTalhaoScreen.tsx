import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConexaoDeere } from '@/features/conexao';
import { BotoesDeZoom, CamadaContornos, CamadaDesenhoTalhao, MapaBase, type MapaControle } from '@/mapa-motor';
import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { Icone } from '@/shared/components/Icone';
import { cantosDaImagemDemo } from '@/shared/lib/fazendaDemo';
import { hectares } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { PainelDesenho } from '../components/PainelDesenho';
import { LADO_DA_ALCA, useArrastarCanto } from '../hooks/useArrastarCanto';
import { useCriarTalhao } from '../hooks/useCriarTalhao';
import { useDesenhoTalhao, type Canto } from '../hooks/useDesenhoTalhao';
import { useMudarTalhao } from '../hooks/useMudarTalhao';
import { useTalhoes } from '../hooks/useTalhoes';
import { limitesDosTalhoes } from '../limites';

const DICAS = ['Toque no primeiro canto do talhão', 'Agora toque no próximo canto', 'Mais um canto para fechar a área', 'Toque num canto para mover. Toque no ponto branco de um lado para criar um canto ali.'];

/** Distância máxima, em pontos de tela, para um toque contar como toque num canto. */
const RAIO_TOQUE = 26;
/** O mesmo para o ponto do meio de um lado: menor, para não roubar o toque de quem quer pôr um canto novo perto da linha. */
const RAIO_TOQUE_DO_MEIO = 18;

/** A mesma área, aumentada para os lados: mostra a vizinhança do talhão. */
function arredores(limites: [number, number, number, number] | null, fator = 1.2): [number, number, number, number] | null {
  if (!limites) return null;
  const [oeste, sul, leste, norte] = limites;
  const dLng = (leste - oeste) * fator;
  const dLat = (norte - sul) * fator;
  return [oeste - dLng, sul - dLat, leste + dLng, norte + dLat];
}

/**
 * Desenhar um talhão novo ou, com `?id=`, redesenhar um que já existe (só os desenhados no app: os que vêm da John
 * Deere ou de arquivo são alterados na origem). Na edição o desenho começa pelo contorno atual e a tela oferece apagar.
 */
export function NovoTalhaoScreen() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { talhoes, carregando, erro: erroLista, atualizar } = useTalhoes();
  const desenho = useDesenhoTalhao();
  const { conexao } = useConexaoDeere();
  const comDeere = conexao?.modo === 'deere' && conexao.estado === 'pronto';
  const criacao = useCriarTalhao();
  const mudanca = useMudarTalhao();
  const { salvando, salvo, erro: erroSalvar, limparErro } = id ? mudanca : criacao;
  const [nome, setNome] = useState('');
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const controle = useRef<MapaControle>(null);
  const travado = !!salvo || salvando || mudanca.apagando;
  // O talhão que está sendo editado. Depois de apagado ele some da lista: o que a tela precisa já foi carregado.
  const editado = id ? talhoes.find((t) => t.id === id) : undefined;
  const [carregado, setCarregado] = useState<{ id: string; naDeere: boolean; limites: [number, number, number, number] | null } | null>(null);
  useEffect(() => {
    if (!editado || !editado.doApp || carregado) return;
    desenho.carregar((editado.contorno.coordinates[0] ?? []) as Canto[]);
    setNome(editado.nome);
    setCarregado({ id: editado.id, naDeere: editado.naDeere === true, limites: arredores(limitesDosTalhoes([editado]), 0.6) });
    // `desenho` muda a cada desenho; o carregamento acontece uma vez, quando o talhão chega.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editado, carregado]);
  const arrasto = useArrastarCanto({
    controle,
    selecionado: travado ? null : desenho.selecionado,
    cantos: desenho.cantos,
    aoMover: desenho.mover,
    aoTocar: desenho.selecionar,
  });
  // Talhões que já existem, como referência (montado uma vez por lista).
  const referencia = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon>>(
    // O talhão em edição fica de fora: o contorno antigo dele por baixo do desenho só confunde.
    () => ({ type: 'FeatureCollection', features: talhoes.filter((t) => t.id !== id).map((t) => ({ type: 'Feature', properties: {}, geometry: t.contorno })) }),
    [talhoes, id],
  );

  // Um toque no mapa pode selecionar um canto, mover o canto selecionado ou criar um canto novo.
  const aoTocarMapa = async (lngLat: Canto, ponto: [number, number]) => {
    if (travado) return;
    const naTela = await Promise.all(desenho.cantos.map((canto) => controle.current?.projetar(canto)));
    let maisPerto = -1;
    let menor = RAIO_TOQUE;
    naTela.forEach((p, indice) => {
      if (!p) return;
      const distancia = Math.hypot(p[0] - ponto[0], p[1] - ponto[1]);
      if (distancia < menor) {
        menor = distancia;
        maisPerto = indice;
      }
    });
    if (maisPerto >= 0) return desenho.selecionar(maisPerto);
    if (desenho.selecionado !== null) return desenho.moverSelecionado(lngLat);
    // Nenhum canto por perto e nada selecionado: tocou no meio de um lado? Então nasce um canto ali.
    const meiosNaTela = await Promise.all(desenho.meios.map((meio) => controle.current?.projetar(meio)));
    let lado = -1;
    let menorDoMeio = RAIO_TOQUE_DO_MEIO;
    meiosNaTela.forEach((p, indice) => {
      if (!p) return;
      const distancia = Math.hypot(p[0] - ponto[0], p[1] - ponto[1]);
      if (distancia < menorDoMeio) {
        menorDoMeio = distancia;
        lado = indice;
      }
    });
    if (lado >= 0) desenho.inserirNoMeio(lado);
    else desenho.adicionar(lngLat);
  };

  if (carregando) return <View style={styles.espera}><Carregando /></View>;
  if (erroLista) return <View style={styles.espera}><ErroComTentarDeNovo mensagem={erroLista.message} aoTentar={atualizar} /></View>;

  if (id && !carregado) {
    // Ainda não carregou: ou o talhão não existe mais, ou não é dos desenhados no app.
    return (
      <View style={styles.espera}>
        <ErroComTentarDeNovo mensagem={editado ? 'Este talhão veio da John Deere ou de um arquivo importado. Ele é alterado lá, não pelo aplicativo.' : 'Não encontrei esse talhão. Ele pode ter sido apagado.'} aoTentar={() => router.back()} />
      </View>
    );
  }

  // Sem talhões ainda, enquadra a área da fazenda de demonstração.
  const [oeste, norte] = cantosDaImagemDemo()[0];
  const [leste, sul] = cantosDaImagemDemo()[2];
  // Abre perto de um talhão que já existe (com folga em volta), e não com a fazenda inteira:
  // talhões distantes entre si deixariam tudo pequeno demais para desenhar.
  const limites = carregado?.limites ?? arredores(limitesDosTalhoes(talhoes.slice(0, 1))) ?? [oeste, sul, leste, norte];

  const nomeVazio = nome.trim() === '';
  const erro = tentouSalvar && nomeVazio ? 'Dê um nome ao talhão' : (erroSalvar?.message ?? null);

  const salvar = () => {
    setTentouSalvar(true);
    const contorno = desenho.contorno;
    if (nomeVazio || !contorno) return;
    const aoSalvar = {
      onSuccess: (talhao: { envioDeere?: 'enviado' | 'recusado' | 'nao-pedido' }) => {
        if (talhao.envioDeere !== 'recusado') return;
        Alert.alert(
          'Salvo só no Talhio',
          carregado
            ? 'As alterações foram salvas, mas a John Deere não aceitou recebê-las. No Operations Center o talhão continua como estava.'
            : 'O talhão foi salvo, mas a John Deere não aceitou criar lá. Ele vale para o mapa, a escala e os relatórios; a linha e o plano dele não chegam ao monitor do trator.',
        );
      },
    };
    const gravar = (enviarParaDeere: boolean) =>
      carregado ? mudanca.editar({ id: carregado.id, nome: nome.trim(), contorno, enviarParaDeere }, aoSalvar) : criacao.criar({ nome: nome.trim(), contorno, enviarParaDeere }, aoSalvar);
    if (!comDeere) return gravar(false);
    // Criar ou alterar na John Deere é escrever na conta da fazenda: só com o "sim" de quem está salvando.
    if (carregado?.naDeere) {
      return Alert.alert('Atualizar também na John Deere?', 'Este talhão existe no Operations Center da fazenda. O nome e o contorno de lá passam a ser estes; o contorno antigo fica guardado lá, inativo.', [
        { text: 'Só no Talhio', onPress: () => gravar(false) },
        { text: 'Atualizar na John Deere', onPress: () => gravar(true) },
      ]);
    }
    Alert.alert(carregado ? 'Enviar para a John Deere?' : 'Criar também na John Deere?', 'O talhão é criado no Operations Center da fazenda, para a linha e o plano poderem chegar ao monitor do trator. Ele fica visível para quem usa a conta e só sai de lá arquivando no Operations Center.', [
      { text: 'Só no Talhio', onPress: () => gravar(false) },
      { text: carregado ? 'Enviar para a John Deere' : 'Criar na John Deere', onPress: () => gravar(true) },
    ]);
  };

  const apagar = () => {
    if (!carregado) return;
    const executar = (naDeere: boolean) =>
      mudanca.apagar(
        { id: carregado.id, naDeere },
        {
          onSuccess: (resultado) => {
            router.back();
            if (resultado.naDeere === 'mantido' || resultado.naDeere === 'recusado') {
              Alert.alert(
                resultado.naDeere === 'recusado' ? 'Apagado só do Talhio' : 'Talhão apagado',
                `${resultado.naDeere === 'recusado' ? 'A John Deere não aceitou arquivar a cópia dela. ' : ''}A cópia continua no Operations Center e volta a aparecer no mapa como talhão da John Deere. Para tirar, arquive o talhão lá.`,
              );
            }
          },
          onError: (falha) => Alert.alert('Não consegui apagar', falha.message),
        },
      );
    const aviso = `O talhão "${nome.trim() || editado?.nome || ''}" e as linhas AB dele saem do Talhio. Não dá para desfazer.`;
    if (carregado.naDeere && comDeere) {
      return Alert.alert('Apagar este talhão?', `${aviso}\n\nEle também existe na John Deere. Lá o Talhio não apaga: arquiva, e dá para desarquivar no Operations Center.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar só do Talhio', style: 'destructive', onPress: () => executar(false) },
        { text: 'Apagar e arquivar na John Deere', style: 'destructive', onPress: () => executar(true) },
      ]);
    }
    Alert.alert('Apagar este talhão?', aviso, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => executar(false) },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.mapaArea}>
        <MapaBase ref={controle} limites={limites} margem={{ top: top + 120, right: 40, bottom: 40, left: 40 }} aoTocar={(posicao, ponto) => void aoTocarMapa(posicao, ponto)} aoParar={arrasto.aoPararOMapa}>
          <CamadaContornos geo={referencia} estilo="referencia" />
          <CamadaDesenhoTalhao geo={desenho.geo} salvo={!!salvo} />
        </MapaBase>
        {/* Área de toque sobre o canto selecionado: o dedo que começa aqui arrasta o canto, e o mapa fica parado. */}
        {arrasto.alca ? <View {...arrasto.manipuladores} accessibilityLabel="Arrastar o canto selecionado" style={[styles.alca, arrasto.alca]} /> : null}
        <BotoesDeZoom controle={controle} style={styles.zoom} />
        {!travado && desenho.selecionado !== null && desenho.cantos.length >= 3 ? (
          <Pressable accessibilityRole="button" onPress={desenho.arredondarSelecionado} style={styles.arredondar}>
            <Text style={styles.arredondarTexto}>Arredondar canto</Text>
          </Pressable>
        ) : null}

        <View style={[styles.topo, { top: top + 5 }]}>
          <View style={styles.linha}>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.redondo}>
              <Icone nome="voltar" cor={cores.texto} tamanho={20} espessura={2} />
            </Pressable>
            <View style={styles.tituloPill}>
              <Text style={styles.titulo}>{carregado ? 'Editar talhão' : 'Novo talhão'}</Text>
            </View>
          </View>
          {salvo ? null : (
            <View style={styles.dica}>
              <View style={styles.contador}>
                <Text style={styles.contadorTexto}>{desenho.cantos.length}</Text>
              </View>
              <Text style={styles.dicaTexto}>
                {desenho.selecionado !== null
                  ? `Canto ${desenho.selecionado + 1} selecionado: arraste para ajustar ou toque onde ele deve ficar`
                  : DICAS[Math.min(desenho.cantos.length, 3)]}
              </Text>
            </View>
          )}
        </View>
      </View>

      <PainelDesenho
        quantidadeCantos={desenho.cantos.length}
        areaHa={salvo ? salvo.areaHa : desenho.areaHa}
        nome={nome}
        aoMudarNome={(texto) => {
          setNome(texto);
          if (erroSalvar) limparErro();
        }}
        erro={erro}
        salvando={salvando}
        confirmacao={
          !salvo
            ? null
            : carregado
              ? `Alterações salvas: ${salvo.nome} · ${hectares(salvo.areaHa)}.${salvo.envioDeere === 'enviado' ? ' A John Deere recebeu o talhão como ficou.' : ''}`
              : `Talhão salvo: ${salvo.nome} · ${hectares(salvo.areaHa)}. Já aparece no mapa e pode receber planos.`
        }
        edicao={carregado ? { aoApagar: apagar, apagando: mudanca.apagando } : undefined}
        cantoSelecionado={desenho.selecionado !== null}
        aoRemover={desenho.remover}
        aoLimpar={() => {
          desenho.limpar();
          setTentouSalvar(false);
          limparErro();
        }}
        aoSalvar={salvar}
        aoConcluir={() => router.back()}
        aoDefinirLinha={() => {
          if (salvo) router.replace({ pathname: '/linha-ab', params: { talhaoId: salvo.id } });
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.mapaFundo },
  espera: { flex: 1, backgroundColor: cores.fundo },
  mapaArea: { flex: 1 },
  zoom: { position: 'absolute', right: 16, bottom: 16 },
  alca: { position: 'absolute', width: LADO_DA_ALCA, height: LADO_DA_ALCA, borderRadius: LADO_DA_ALCA / 2 },
  arredondar: { position: 'absolute', left: 16, bottom: 16, height: 44, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: cores.cartao },
  arredondarTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.texto },
  topo: { position: 'absolute', left: 16, right: 16, gap: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, alignItems: 'center', justifyContent: 'center' },
  tituloPill: { height: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: cores.controleMapa },
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
