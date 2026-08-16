/**
 * Modo de pagamento simulado — o único caminho pelo qual o adapter "fake" roda em produção.
 *
 * ─── POR QUE ISTO EXISTE ─────────────────────────────────────────────────────────────────────
 *
 * O adapter simulado concede acesso sem cobrar. Por isso ele era bloqueado por `NODE_ENV`, o que
 * é a proteção certa contra o acidente que importa: subir para produção e continuar entregando
 * relatórios pagos de graça sem ninguém perceber.
 *
 * Mas a Vercel define `NODE_ENV=production` em qualquer deploy, inclusive no que existe só para o
 * dono percorrer o próprio funil antes de haver gateway contratado. Com o bloqueio amarrado
 * apenas a `NODE_ENV`, clicar em "continuar para o pagamento" no site publicado devolvia uma
 * exceção de servidor — que foi exatamente o que aconteceu.
 *
 * ─── O DESENHO ───────────────────────────────────────────────────────────────────────────────
 *
 * O interruptor é a variável `ALLOW_FAKE_PAYMENTS`, seguindo o mesmo padrão de
 * `ALLOW_UNVERIFIED_DATASET`:
 *
 *   • ausente        → produção bloqueia o simulado, como antes. Nada mudou para quem esquecer.
 *   • ='true'        → o funil roda inteiro, e TODA página passa a exibir o aviso permanente de
 *                      que nada está sendo cobrado (`TestModeBanner`).
 *
 * A diferença em relação a simplesmente afrouxar o `NODE_ENV` é que ligar isto exige uma ação
 * deliberada, fica registrado na configuração do projeto, e é VISÍVEL para qualquer visitante.
 * Não existe estado em que o site cobre de verdade e o dono ache que está simulando, nem o
 * inverso.
 */

export function simulatedPaymentsAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.ALLOW_FAKE_PAYMENTS === 'true';
}

/** true quando o site publicado está aceitando "pagamentos" que não cobram nada. */
export function inSimulatedPaymentMode(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_FAKE_PAYMENTS === 'true' &&
    (process.env.PAYMENT_PROVIDER ?? 'fake') === 'fake'
  );
}

/** Mensagem única para quando o simulado é recusado — diz o que fazer, não só o que falhou. */
export const SIMULATED_PAYMENTS_BLOCKED =
  'O provedor de pagamento "fake" não pode ser usado em produção: ele concede acesso sem cobrar. ' +
  'Configure PAYMENT_PROVIDER com um gateway real, ou defina ALLOW_FAKE_PAYMENTS=true para rodar ' +
  'o funil em modo demonstração (com aviso visível ao visitante em todas as páginas).';
