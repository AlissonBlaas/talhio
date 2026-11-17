import type { StyleSpecification } from '@maplibre/maplibre-react-native';

/**
 * Imagem de satélite do mapa. O padrão é o serviço World Imagery da Esri, bom para desenvolvimento.
 * Antes de vender, confira a licença ou troque por um fornecedor contratado (ex.: MapTiler),
 * definindo EXPO_PUBLIC_SATELITE_TILES com a URL de tiles {z}/{x}/{y}.
 */
const TILES =
  process.env.EXPO_PUBLIC_SATELITE_TILES ??
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const ESTILO_SATELITE: StyleSpecification = {
  version: 8,
  sources: {
    satelite: {
      type: 'raster',
      tiles: [TILES],
      tileSize: 256,
      // Acima disso a Esri não tem foto em boa parte do campo e devolve um quadro cinza "Map data not yet available".
      // Com o teto em 17, o mapa AMPLIA a foto do nível 17 nos zooms maiores em vez de pedir um nível que não existe.
      maxzoom: Number(process.env.EXPO_PUBLIC_SATELITE_ZOOM_MAXIMO) || 17,
      attribution: 'Imagem: Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'satelite', type: 'raster', source: 'satelite' }],
};
