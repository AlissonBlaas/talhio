import type { Periodo, Relatorio } from '@talhio/shared';
import { File, Paths } from 'expo-file-system';
import { useMutation } from '@tanstack/react-query';
import { Share } from 'react-native';

import { relatoriosApi } from '../api/relatoriosApi';

/** relatorio-talhio-mes-2026-11.pdf, o mesmo nome que o servidor usa. */
const nomeDoArquivo = (r: Pick<Relatorio, 'periodo' | 'inicio' | 'fim'>) => `relatorio-talhio-${r.periodo}-${r.periodo === 'mes' ? r.inicio.slice(0, 7) : r.fim}.pdf`;

/**
 * Baixa o PDF do relatório que está na tela e abre o compartilhar do aparelho (salvar em Arquivos,
 * WhatsApp, e-mail). O módulo de compartilhar é carregado sob demanda: sem ele, usa o do React Native.
 */
export function useBaixarPdf() {
  const mutacao = useMutation({
    mutationFn: async ({ periodo, data, relatorio, maquinaIds }: { periodo: Periodo; data: string | null; relatorio: Relatorio; maquinaIds?: string[] }) => {
      const bytes = await relatoriosApi.pdf(periodo, data, maquinaIds);
      const arquivo = new File(Paths.cache, nomeDoArquivo(relatorio));
      if (arquivo.exists) arquivo.delete();
      arquivo.create();
      arquivo.write(bytes);
      try {
        const { isAvailableAsync, shareAsync } = await import('expo-sharing');
        if (await isAvailableAsync()) {
          await shareAsync(arquivo.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Relatório Talhio' });
          return;
        }
      } catch {
        // Aparelho compilado sem o módulo: cai para o compartilhar do React Native.
      }
      await Share.share({ url: arquivo.uri });
    },
  });
  return { baixar: mutacao.mutate, baixando: mutacao.isPending, erro: mutacao.error };
}
