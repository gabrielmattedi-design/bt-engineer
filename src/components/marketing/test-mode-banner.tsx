import { isTestMode } from '@/domain/sourced';
import { inSimulatedPaymentMode } from '@/payments/mode';

/**
 * Aviso permanente de ambiente de testes.
 *
 * Aparece em TODA página enquanto `ALLOW_UNVERIFIED_DATASET=true` ou `ALLOW_FAKE_PAYMENTS=true`.
 * Não é fechável, e isso é deliberado: um aviso que o visitante dispensa no primeiro clique não
 * avisa ninguém.
 *
 * O §69 proíbe vender com dado não conferido. Publicar uma versão de testes é legítimo — desde que
 * quem chegue saiba exatamente o que está vendo.
 *
 * O aviso de pagamento é ainda mais importante que o de catálogo: alguém que chegue por um link e
 * encontre "R$ 19,99" numa loja que não cobra nada precisa saber disso ANTES de clicar, não
 * depois. As duas condições são independentes e a frase se ajusta para dizer só o que é verdade.
 */
export function TestModeBanner() {
  const unverifiedData = isTestMode();
  const simulatedPayments = inSimulatedPaymentMode();
  if (!unverifiedData && !simulatedPayments) return null;

  const messages: string[] = [];
  if (unverifiedData) {
    messages.push('as especificações técnicas ainda estão em conferência');
  }
  if (simulatedPayments) {
    messages.push('os pagamentos são simulados e nada é cobrado');
  }

  return (
    <div className="bg-ball px-4 py-2 text-center text-xs font-medium text-ink">
      Ambiente de testes — {messages.join(' e ')}.
    </div>
  );
}
