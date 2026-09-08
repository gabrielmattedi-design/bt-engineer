import { CONTATO_EMAIL, OPERACAO, OPERACAO_DESCRICAO } from '@/lib/contato';
import { SITE_DOMAIN } from '@/lib/site';

export const metadata = {
  title: 'Privacidade — Tennis Engineer',
  description: 'O que o Tennis Engineer guarda, por quanto tempo e como pedir para apagar.',
};

/**
 * Política de privacidade.
 *
 * ═══ POR QUE ELA DESCREVE O SISTEMA, E NÃO UM MODELO GENÉRICO ════════════════════════════════
 *
 * Quase toda política de privacidade lista tudo o que um site PODERIA fazer, por precaução. O
 * efeito é que ela deixa de informar: quem lê não distingue o que acontece de verdade do que está
 * ali só para cobrir hipótese.
 *
 * Este texto afirma o que o código faz, e cada afirmação é verificável nele: `funnel_markers` não
 * grava IP nem referrer, `visitor_campaigns` guarda só os `utm_*` que o próprio anunciante
 * escreveu, os tokens vão para o banco como SHA-256, e não há nenhum script de terceiro.
 *
 * O risco de escrever assim é conhecido e aceito: se o sistema mudar, o texto passa a mentir. É
 * por isso que ele fica curto e concreto — texto curto e específico alguém revisa quando muda;
 * texto longo e genérico ninguém lê nem antes nem depois.
 */
export default function PrivacidadePage() {
  return (
    <>
      <h1>Privacidade</h1>
      <p className="lead">
        Este texto descreve o que o {OPERACAO} guarda de verdade. Ele é curto porque o sistema
        coleta pouco.
      </p>

      <h2>Quem é responsável</h2>
      <p>
        O {SITE_DOMAIN} é uma {OPERACAO_DESCRICAO}. Para qualquer pedido relativo aos seus dados —
        acesso, correção ou exclusão — escreva para <strong>{CONTATO_EMAIL}</strong>. Respondemos
        pelo mesmo endereço.
      </p>

      <h2>O que guardamos</h2>
      <ul>
        <li>
          <strong>Suas respostas do questionário</strong> e a análise gerada a partir delas. É o
          produto: sem isso não há recomendação, e é o que permite você reabrir o mesmo relatório
          depois.
        </li>
        <li>
          <strong>Seu e-mail</strong>, quando você compra ou pede um link de acesso. Serve para
          enviar o relatório e para você voltar a ele.
        </li>
        <li>
          <strong>Dados da compra</strong> — valor, produto e o identificador do pagamento no
          Mercado Pago. Nenhum dado de cartão passa por este site: o pagamento acontece inteiro na
          tela do Mercado Pago.
        </li>
        <li>
          <strong>Um identificador anônimo</strong> guardado num cookie, para saber que foi você
          quem respondeu o questionário quando voltar. Ele não tem nome, e no nosso banco fica
          apenas o resultado de um cálculo irreversível sobre ele.
        </li>
      </ul>

      <h2>O que não guardamos</h2>
      <p>
        Nós não registramos endereço de IP, tipo de navegador, localização, nem de onde você veio ao
        chegar. Não usamos Google Analytics. A nossa medição de uso é feita no nosso próprio banco e
        registra apenas que alguém alcançou uma etapa, sem nada que identifique a pessoa — e ela
        funciona assim para todo mundo, inclusive para quem recusa o cookie de medição abaixo.
      </p>

      <h2>O cookie de medição do Meta</h2>
      <p>
        Quando anunciamos, precisamos saber quais anúncios trazem pessoas que se interessam de
        verdade. Para isso usamos o <strong>pixel do Meta</strong> (Facebook e Instagram), que só é
        carregado <strong>depois de você aceitar</strong> — se você recusar, ou simplesmente não
        responder, ele não é carregado em momento nenhum.
      </p>
      <p>
        Quando você aceita, o Meta recebe que alguém visitou uma página do site e que começou o
        questionário. Quem faz esse registro é o Meta, com as próprias regras dele, e por isso ele
        pode relacionar essa visita à sua conta do Facebook ou do Instagram, se você tiver uma. Esse
        é o ponto em que o nosso &quot;não guardamos nada sobre você&quot; passa a ter uma exceção, e
        é por isso que perguntamos antes em vez de simplesmente ligar.
      </p>
      <p>
        Nós nunca enviamos ao Meta o que você respondeu no questionário, o seu resultado, o seu
        e-mail ou o seu nome. Recusar não muda nada no site: o questionário, a análise e o relatório
        funcionam igual.
      </p>
      <p>
        Quando você chega por um link de anúncio, guardamos os parâmetros de campanha que o próprio
        anúncio carrega na URL — algo como &quot;instagram&quot; ou &quot;campanha de agosto&quot;.
        São dados sobre o anúncio, não sobre você.
      </p>

      <h2>Cookies</h2>
      <p>
        Os cookies necessários são todos nossos: o identificador anônimo da sua análise, a sessão de
        quem faz login, o nome da campanha quando você vem de um anúncio, e a sua resposta ao aviso
        de medição — esta última guardada justamente para não perguntarmos de novo a cada visita.
        Nenhum deles segue você em outros sites.
      </p>
      <p>
        Existe um único cookie de terceiro, o do Meta descrito acima, e ele só passa a existir se
        você aceitar.
      </p>
      <p>
        <strong>Para mudar de ideia a qualquer momento</strong>, use o link no rodapé da página
        inicial — ele mostra a sua escolha atual (&quot;medição ativa&quot; ou &quot;medição
        desativada&quot;) e, ao ser clicado, traz o aviso de volta para você responder outra coisa.
        Revogar é tão simples quanto aceitar, e não exige apagar nada no navegador.
      </p>

      <h2>Com quem compartilhamos</h2>
      <p>
        Com o mínimo que cada fornecedor precisa: o <strong>Mercado Pago</strong> processa o
        pagamento, o <strong>Resend</strong> entrega os e-mails e o <strong>Meta</strong> recebe as
        visitas de quem aceitou o cookie de medição, como descrito acima. Não vendemos, alugamos nem
        cedemos dados para ninguém, em nenhuma hipótese.
      </p>

      <h2>Por quanto tempo</h2>
      <p>
        As análises ficam guardadas enquanto o site existir, porque é isso que permite você reabrir
        um relatório que comprou. Se quiser que apaguemos os seus dados antes disso, peça por e-mail
        — apagamos, e você perde o acesso aos relatórios daquela conta, que é a contrapartida
        inevitável.
      </p>

      <h2>Seus direitos</h2>
      <p>
        A Lei Geral de Proteção de Dados garante que você pode saber o que guardamos sobre você,
        corrigir o que estiver errado, pedir uma cópia e pedir a exclusão. Todos esses pedidos vão
        pelo mesmo endereço de contato, e não exigem justificativa.
      </p>

      <h2>Mudanças</h2>
      <p>
        Se este texto mudar, a versão nova passa a valer a partir da publicação. Mudanças que
        alterem o que é coletado serão avisadas por e-mail a quem tiver conta.
      </p>
    </>
  );
}
