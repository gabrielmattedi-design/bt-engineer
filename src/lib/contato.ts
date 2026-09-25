/**
 * O canal de contato, em UM lugar só.
 *
 * ═══ POR QUE ISTO PRECISOU EXISTIR ═══════════════════════════════════════════════════════════
 *
 * Três telas diziam "fale com a gente" ou "responda o e-mail da compra que a gente resolve", e não
 * havia com quem falar: o remetente é `nao-responda@`, que não recebe por decisão de projeto, e
 * nenhuma página trazia endereço nenhum.
 *
 * A promessa quebrada custa caro no pior momento possível. Quem pagou e não recebeu o relatório
 * tem exatamente um caminho quando não encontra contato: abrir disputa no gateway. Aí some o
 * dinheiro, some a taxa, e fica a marca de contestação na conta que recebe.
 *
 * Um lugar só porque o endereço aparece em cinco pontos — três telas, os e-mails e as páginas
 * legais. Espalhado, o dia em que ele mudar deixa alguma cópia para trás, e a cópia esquecida é
 * justamente a que alguém vai tentar usar.
 *
 * Sem padrão: o que havia era a caixa do Tennis Engineer, e um cliente deste produto escrevendo
 * para a operação de outro é exatamente a promessa quebrada acima — ver `src/lib/ambiente.ts`.
 *
 * É também o destino do `List-Unsubscribe` da pesquisa de satisfação. Aquele cron lia uma variável
 * própria, `CONTATO_EMAIL`, com outro padrão (`contato@` do domínio antigo), enquanto o ensaio de
 * `/admin/pesquisa` — que declara mandar "os mesmos cabeçalhos do envio real" — lia esta. O ensaio
 * mostrava um destino e o envio real usava outro, e nenhuma tela revelava a diferença. Agora os
 * dois leem daqui.
 */

import { exigir } from './ambiente';

export const CONTATO_EMAIL = exigir('CONTACT_EMAIL', process.env.CONTACT_EMAIL);

/**
 * Como a operação se identifica nas páginas legais.
 *
 * ─── POR QUE NÃO HÁ CNPJ NEM CPF AQUI ────────────────────────────────────────────────────────
 *
 * Não existe CNPJ, e inventar um seria criar um registro falso. Publicar o CPF do responsável
 * também não é o caminho: a LGPD exige que o controlador seja IDENTIFICÁVEL e ofereça um canal de
 * atendimento — não que ele exponha um documento pessoal numa página aberta, o que seria expor um
 * dado sensível para reduzir risco nenhum.
 *
 * O que fica é verdade e é suficiente para o titular exercer os direitos dele: o nome da operação,
 * o país e um endereço que recebe e responde.
 */
export const OPERACAO = 'Tennis Engineer';
export const OPERACAO_DESCRICAO =
  'operação individual sediada no Brasil, sob responsabilidade de pessoa física';
