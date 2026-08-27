import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Configurações operacionais que o DONO liga e desliga — não segredos, não credenciais.
 *
 * ─── POR QUE NO BANCO E NÃO EM VARIÁVEL DE AMBIENTE ──────────────────────────────────────────
 *
 * Variável de ambiente é o lugar certo para segredo e para configuração de infraestrutura: ela
 * fica fora do código, é criptografada em repouso e não vaza em log. Mas ela tem um custo que só
 * aparece quando o dono do produto não é desenvolvedor — para mudá-la é preciso achar a tela certa
 * no painel da hospedagem, marcar o ambiente certo e refazer o deploy. São três passos invisíveis,
 * cada um com uma forma silenciosa de falhar, e o resultado observável de todos é o mesmo: nada
 * muda.
 *
 * Foi exatamente o que aconteceu com `ALLOW_FAKE_PAYMENTS`. A trava estava certa, a mensagem de
 * erro estava certa, e mesmo assim o funil ficou parado — porque o passo estava num lugar que o
 * dono não encontrou.
 *
 * Esta tabela guarda apenas chaves cujo valor é uma DECISÃO OPERACIONAL, visível para quem usa o
 * site e reversível a qualquer momento. Segredo nenhum entra aqui: `DATABASE_URL`, chaves de
 * gateway e `ADMIN_PASSWORD` continuam em variável de ambiente, onde devem estar.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Chaves reconhecidas. Tipar impede que um erro de digitação vire uma configuração fantasma. */
export const SETTING_KEYS = {
  /** 'true' faz o site aceitar o provedor simulado em produção, com aviso permanente ao visitante. */
  simulatedPayments: 'simulated_payments_enabled',
  /**
   * 'true' fecha o checkout inteiro: o acesso passa a existir SÓ por código de convite.
   *
   * É a trava para a fase de teste com convidados. O checkout simulado libera o relatório sem
   * cobrar, o que é útil enquanto só o dono percorre o funil e vira um problema no minuto em que o
   * link sai da mão dele: quem recebe repassa, e o produto pago vira gratuito para quem tiver a
   * URL. Com o convite ligado não existe caminho de pagamento para repassar — existe um código,
   * que tem dono, limite e histórico.
   */
  inviteOnly: 'invite_only_access',
  /**
   * Quando um e-mail de teste saiu com sucesso pela última vez (ISO 8601).
   *
   * Existe porque o diagnóstico de e-mail INFERE e este campo REGISTRA. A consulta que o painel faz
   * ao provedor exige uma chave de acesso total; uma chave de envio responde 401 nela e manda
   * e-mail perfeitamente. Sem um registro do que de fato aconteceu, o painel fica preso num aviso
   * permanente sobre um sistema que funciona — e um aviso que sempre aparece deixa de ser lido,
   * inclusive no dia em que for verdade.
   */
  lastEmailOk: 'last_email_test_ok_at',
} as const;
