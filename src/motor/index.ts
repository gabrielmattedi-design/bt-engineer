/**
 * O motor do Beach Tennis Engineer — docs/PROPOSTA_MOTOR_BT.md.
 *
 * Vive ao lado do motor de tênis (`src/recommendation`) enquanto as telas não migram: o questionário,
 * o relatório e o checkout copiados ainda chamam o antigo, e trocar tudo de uma vez deixaria o
 * projeto sem compilar no meio do caminho. Quando a última tela migrar, `src/recommendation` sai.
 */
export { carregarCatalogo, escalaDo, posicao, type Raquete, type Escala } from './catalogo';
export { faixaDoPreco, CORTES_BRL, ROTULO_DA_FAIXA, type Faixa } from './faixas';
export { montarPerfil, type Perfil, type Respostas, type RaqueteAtual, type Falta } from './jogador';
export {
  recomendar,
  MOTOR_VERSAO,
  EMPATE_TECNICO,
  MAX_POR_MARCA,
  NOTA_MINIMA_DE_ENCAIXE,
  type Resultado,
  type Avaliada,
  type Veredicto,
  type Exclusao,
} from './recomendar';
