import { boolean, integer, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { orders } from './commerce';

/**
 * A pesquisa de satisfação enviada quinze dias depois da compra.
 *
 * ═══ POR QUE UMA LINHA POR PEDIDO, CRIADA NO ENVIO ═══════════════════════════════════════════
 *
 * A linha nasce quando o e-mail é DISPARADO, não quando a pessoa responde. Isso faz a própria
 * tabela ser a trava de idempotência: o cron procura pedidos que ainda não têm linha, e um pedido
 * que já tem nunca é reenviado — nem se o cron rodar duas vezes no mesmo dia, nem se a Vercel
 * repetir a chamada.
 *
 * A alternativa, gravar só quem responde, deixaria o sistema sem memória de quem já foi
 * incomodado. Mandar a mesma pesquisa duas vezes para quem não respondeu é o caminho mais curto
 * para virar spam — e quem reclama é justamente o cliente insatisfeito que se queria ouvir.
 *
 * ═══ POR QUE AS RESPOSTAS SÃO COLUNAS, E NÃO UM JSON ═════════════════════════════════════════
 *
 * O formulário tem cinco perguntas e elas não vão mudar toda semana. Colunas permitem agrupar no
 * banco — `count(*) filter (where usou = 'nao_segui')` é a consulta que responde a pergunta mais
 * importante do projeto. Com JSON, toda leitura vira varredura e desserialização em memória.
 *
 * ─── O QUE NÃO ESTÁ AQUI ─────────────────────────────────────────────────────────────────────
 *
 * Não há coluna de e-mail nem de nome. O pedido já tem o usuário, e duplicar dado pessoal em mais
 * uma tabela é mais um lugar para vazar e mais um lugar para esquecer de apagar. A junção custa
 * nada e a responsabilidade fica num lugar só.
 */
export const satisfactionSurveys = pgTable('satisfaction_surveys', {
  id: uuid('id').defaultRandom().primaryKey(),

  /**
   * Um pedido, uma pesquisa. `unique` é a garantia de que ninguém recebe duas vezes — e ela vive
   * no banco, não na lógica, porque lógica esquece sob concorrência e restrição não.
   */
  orderId: uuid('order_id')
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: 'cascade' }),

  /**
   * O código que identifica a pessoa no link, sem login.
   *
   * Aleatório e longo o bastante para não ser adivinhado. Ele não dá acesso a nada além de
   * responder esta pesquisa — não abre relatório, não mostra dado de compra —, então o pior caso
   * de um link vazado é alguém responder uma pesquisa no lugar de outro.
   */
  token: text('token').notNull().unique(),

  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),

  /**
   * ═══ O QUE ACONTECEU COM O ENVIO ═══════════════════════════════════════════════════════════
   *
   * A linha nasce ANTES do disparo, para ser a trava de idempotência (ver acima). O efeito colateral
   * é que a existência da linha significa "foi tentado", e não "foi enviado" — e sem estas colunas
   * as duas coisas eram indistinguíveis. Um e-mail recusado pelo provedor produzia exatamente a
   * mesma linha de um entregue, e o painel contava os dois como "enviadas".
   *
   * Isso é grave neste caso específico: a linha também impede a segunda tentativa. Uma falha
   * silenciosa não atrasa a pesquisa daquele cliente — ELIMINA. Ele nunca mais entra na fila.
   *
   * `null` significa desconhecido, não sucesso: é o estado das linhas criadas antes desta coluna
   * existir, e de qualquer caminho que grave sem registrar o resultado. Tratar ausência como
   * sucesso é como se perde a informação de novo.
   */
  envioOk: boolean('envio_ok'),
  /** O id da mensagem no provedor. Serve para achar o envio no painel do Resend. */
  envioId: text('envio_id'),
  /**
   * O motivo da recusa, curto.
   *
   * Guarda o código e a categoria — `HTTP 403`, `falha de rede` —, nunca o corpo inteiro da resposta
   * do provedor, que às vezes ecoa cabeçalhos da requisição. Basta para decidir o que fazer.
   */
  envioErro: text('envio_erro'),

  /** `segui_tudo` · `segui_parte` · `ainda_nao` · `nao_vou`. A pergunta que divide o diagnóstico. */
  usou: text('usou'),
  /** Só para quem seguiu: `melhorou_muito` · `melhorou_pouco` · `igual` · `piorou`. */
  efeito: text('efeito'),
  /** Só para quem não seguiu: `custo` · `tempo` · `discordei` · `nao_entendi` · `outro`. */
  impedimento: text('impedimento'),
  impedimentoOutro: text('impedimento_outro'),
  /** 1 a 5 — `smallint` porque nota de 1 a 5 não precisa de quatro bytes. */
  notaLaudo: smallint('nota_laudo'),
  sugestao: text('sugestao'),
  podeContatar: boolean('pode_contatar'),

  /**
   * Quantos dias separaram o pagamento do envio.
   *
   * Gravado no disparo porque a regra pode mudar — se um dia a janela virar 20 ou 30 dias, as
   * respostas antigas continuam legíveis sabendo com qual régua foram colhidas. Sem isso, uma
   * comparação futura entre safras misturaria janelas diferentes sem ninguém perceber.
   */
  diasDepoisDaCompra: integer('dias_depois_da_compra').notNull(),
});
