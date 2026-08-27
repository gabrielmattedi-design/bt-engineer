import { CONTATO_EMAIL, OPERACAO, OPERACAO_DESCRICAO } from '@/lib/contato';
import { SITE_DOMAIN } from '@/lib/site';

export const metadata = {
  title: 'Termos e reembolso — Tennis Engineer',
  description: 'O que você compra, o que a análise é e como pedir reembolso.',
};

/**
 * Termos de uso e política de reembolso.
 *
 * ═══ POR QUE O REEMBOLSO É SIMPLES, EM VEZ DE CHEIO DE RESSALVA ══════════════════════════════
 *
 * O Código de Defesa do Consumidor dá sete dias de arrependimento em compra fora do
 * estabelecimento. Um produto digital entregue na hora tende a inspirar a ressalva do tipo "salvo
 * se o conteúdo já foi acessado" — e ela é péssima aqui por dois motivos.
 *
 * Primeiro: o conteúdo é acessado em SEGUNDOS. A ressalva anularia o direito na prática para todo
 * mundo, o que é exatamente o tipo de cláusula que não se sustenta quando questionada.
 *
 * Segundo: ela custa mais do que economiza. O produto custa entre R$ 19,99 e R$ 49,99. Devolver
 * sem discutir é mais barato que uma disputa no gateway — que leva a taxa junto e deixa marca na
 * conta que recebe. Recusa gera contestação; devolução gera uma linha no extrato.
 *
 * ═══ O LIMITE QUE PRECISA ESTAR ESCRITO ══════════════════════════════════════════════════════
 *
 * A recomendação é uma análise técnica, não conselho médico nem garantia de desempenho. Isso já é
 * dito no rodapé do site e no relatório; aqui ele fica no lugar em que tem efeito, e sem letra
 * miúda: o texto está no mesmo corpo do resto.
 */
export default function TermosPage() {
  return (
    <>
      <h1>Termos e reembolso</h1>
      <p className="lead">
        O que você compra, o que a análise é — e o que ela não é.
      </p>

      <h2>Quem vende</h2>
      <p>
        O {SITE_DOMAIN} é uma {OPERACAO_DESCRICAO}. O contato para qualquer assunto, inclusive
        reembolso, é <strong>{CONTATO_EMAIL}</strong>.
      </p>

      <h2>O que você compra</h2>
      <p>
        Um relatório com a recomendação de equipamento gerada a partir das suas respostas. Conforme
        o plano escolhido, ele traz a raquete recomendada e o motivo da escolha, e pode incluir a
        corda, a espessura e a tensão inicial sugeridas.
      </p>
      <p>
        O questionário e a prévia da análise são gratuitos. Antes de pagar você já vê quantas
        raquetes foram avaliadas, a confiança do resultado e o quanto cada finalista combina com
        você. O que o pagamento revela são os modelos e o raciocínio por trás deles.
      </p>

      <h2>O que a análise é — e o que não é</h2>
      <p>
        É uma análise técnica que cruza as suas respostas com as especificações dos equipamentos do
        nosso catálogo. Os índices que aparecem no relatório são métricas internas nossas, não
        especificações do fabricante.
      </p>
      <p>
        Não é conselho médico nem garantia de desempenho. Equipamento adequado ajuda, e não
        substitui a avaliação de um profissional de saúde nem o trabalho com um treinador. Se você
        sente dor ao jogar, procure um profissional antes de trocar de raquete.
      </p>
      <p>
        A recomendação sai do catálogo que mantemos, que não inclui todos os modelos do mercado.
        Não temos vínculo comercial com nenhuma marca, e nenhuma paga para aparecer.
      </p>

      <h2>Reembolso</h2>
      <p>
        <strong>Sete dias, sem justificativa.</strong> Se você comprou e se arrependeu, escreva para{' '}
        {CONTATO_EMAIL} dentro de sete dias com o e-mail usado na compra. Devolvemos o valor
        integral pelo mesmo meio de pagamento, sem perguntas e sem exigir explicação.
      </p>
      <p>
        Vale mesmo que você já tenha lido o relatório inteiro. É o seu direito pelo Código de Defesa
        do Consumidor, e não fazemos a ressalva de &quot;conteúdo já acessado&quot; que anularia
        esse direito na prática — o relatório abre em segundos.
      </p>
      <p>
        Depois dos sete dias, se algo não funcionou como prometido, escreva assim mesmo. Resolvemos
        caso a caso, e a resposta costuma ser devolver.
      </p>

      <h2>Acesso ao relatório</h2>
      <p>
        O relatório fica guardado e você reabre quando quiser, pelo link que recebe por e-mail ou
        entrando com o mesmo endereço em {SITE_DOMAIN}. Ele guarda a versão exata do sistema e do
        catálogo que o produziram — reabrir mostra o mesmo relatório que você recebeu, e não uma
        recalculada de hoje.
      </p>
      <p>
        Quem tem o link tem o relatório. Ele é pessoal: ao compartilhar, você compartilha a análise
        inteira.
      </p>

      <h2>Uso do site</h2>
      <p>
        O conteúdo dos relatórios é para uso pessoal. Revender, republicar ou extrair o catálogo de
        forma automatizada não é permitido.
      </p>
      <p>
        O {OPERACAO} pode ajustar o catálogo, o método e os preços a qualquer momento. Alterações
        não mudam relatórios já entregues, justamente porque cada um guarda a versão que o gerou.
      </p>

      <h2>Se algo der errado</h2>
      <p>
        Pagou e o relatório não abriu? Escreva para {CONTATO_EMAIL} com o comprovante do Mercado
        Pago. Localizamos a compra e liberamos o acesso — é mais rápido que abrir disputa, e resolve
        do mesmo jeito.
      </p>
    </>
  );
}
