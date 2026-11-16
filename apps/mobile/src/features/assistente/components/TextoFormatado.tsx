import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

import { ehNumero, lerBlocos, type Bloco, type Trecho } from '../formatar';

/** Até aqui as colunas dividem a largura do balão; com mais, a tabela rola de lado. */
const COLUNAS_QUE_CABEM = 4;
const LARGURA_DA_COLUNA = 92;

function Linha({ trechos, estilo }: { trechos: Trecho[]; estilo: object | object[] }) {
  return (
    <Text selectable style={estilo}>
      {trechos.map((t, i) =>
        t.forte ? (
          <Text key={i} style={styles.forte}>
            {t.texto}
          </Text>
        ) : (
          t.texto
        ),
      )}
    </Text>
  );
}

const textoDe = (trechos: Trecho[]) => trechos.map((t) => t.texto).join('');

function Tabela({ bloco }: { bloco: Extract<Bloco, { tipo: 'tabela' }> }) {
  const larga = bloco.colunas.length > COLUNAS_QUE_CABEM;
  // A primeira coluna é o nome (máquina, mês): mais larga e à esquerda. As outras são números, à direita.
  const estiloDaColuna = (n: number) => (larga ? { width: n === 0 ? LARGURA_DA_COLUNA + 36 : LARGURA_DA_COLUNA } : { flex: n === 0 ? 1.5 : 1 });
  const aDireita = (n: number) => n > 0 && bloco.linhas.every((l) => !textoDe(l[n] ?? []) || ehNumero(textoDe(l[n] ?? [])));
  const corpo = (
    <View style={styles.tabela}>
      <View style={styles.linhaDaTabela}>
        {bloco.colunas.map((coluna, n) => (
          <Text key={n} numberOfLines={2} style={[styles.cabecalho, estiloDaColuna(n), aDireita(n) && styles.direita]}>
            {coluna}
          </Text>
        ))}
      </View>
      {bloco.linhas.map((linha, i) => (
        <View key={i} style={[styles.linhaDaTabela, styles.linhaComDivisor]}>
          {linha.map((celula, n) => (
            <View key={n} style={estiloDaColuna(n)}>
              <Linha trechos={celula} estilo={[n === 0 ? styles.celulaNome : styles.celula, aDireita(n) && styles.direita]} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
  if (!larga) return corpo;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {corpo}
    </ScrollView>
  );
}

/**
 * Resposta do assistente desenhada: frase, título, tópicos e tabela. Recebe o texto como veio do servidor
 * (inclusive pela metade, enquanto chega) e não mostra nenhum símbolo de marcação.
 */
export const TextoFormatado = memo(function TextoFormatado({ texto }: { texto: string }) {
  const blocos = useMemo(() => lerBlocos(texto), [texto]);
  return (
    <View style={styles.blocos}>
      {blocos.map((bloco, i) => {
        if (bloco.tipo === 'titulo') return <Linha key={i} trechos={bloco.trechos} estilo={[styles.titulo, i > 0 && styles.tituloNoMeio]} />;
        if (bloco.tipo === 'tabela') return <Tabela key={i} bloco={bloco} />;
        if (bloco.tipo === 'topicos') {
          return (
            <View key={i} style={styles.topicos}>
              {bloco.itens.map((item, n) => (
                <View key={n} style={styles.topico}>
                  {item.marca ? <Text style={styles.numero}>{item.marca}.</Text> : <View style={styles.ponto} />}
                  <View style={styles.textoDoTopico}>
                    <Linha trechos={item.trechos} estilo={styles.texto} />
                  </View>
                </View>
              ))}
            </View>
          );
        }
        return <Linha key={i} trechos={bloco.trechos} estilo={styles.texto} />;
      })}
    </View>
  );
});

/** A resposta tem tabela? O balão usa a largura toda para ela caber. */
export const temTabela = (texto: string) => /(^|\n)\s*\|.+\|/.test(texto);

const styles = StyleSheet.create({
  blocos: { gap: 10 },
  texto: { fontFamily: fontes.regular, fontSize: 16, lineHeight: 23, color: cores.texto },
  forte: { fontFamily: fontes.rotuloLeve, color: cores.escuro },
  titulo: { fontFamily: fontes.rotulo, fontSize: 16, lineHeight: 21, color: cores.escuro },
  tituloNoMeio: { marginTop: 4 },
  topicos: { gap: 6 },
  topico: { flexDirection: 'row', gap: 10 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.folha, marginTop: 9 },
  numero: { fontFamily: fontes.rotuloLeve, fontSize: 15, lineHeight: 23, color: cores.folha, minWidth: 18 },
  textoDoTopico: { flex: 1 },
  tabela: { borderRadius: 14, backgroundColor: cores.fundo, paddingHorizontal: 12, paddingVertical: 4 },
  linhaDaTabela: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  linhaComDivisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: cores.bordaForte },
  cabecalho: { fontFamily: fontes.rotuloLeve, fontSize: 13, lineHeight: 17, color: cores.textoSuave },
  celulaNome: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20, color: cores.texto },
  celula: { fontFamily: fontes.regular, fontSize: 15, lineHeight: 20, color: cores.texto, fontVariant: ['tabular-nums'] },
  direita: { textAlign: 'right' },
});
