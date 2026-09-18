import { magicLinkEmail, reportReadyEmail, satisfactionSurveyEmail, type Email } from './templates';
import { SITE_URL } from '@/lib/site';

/**
 * Os e-mails do produto, montados com dados de exemplo seguros.
 *
 * ═══ POR QUE UM LUGAR SÓ ═════════════════════════════════════════════════════════════════════
 *
 * A prévia na tela e o envio de teste precisam ser a MESMA mensagem. Montados em dois lugares,
 * bastaria alguém mudar um endereço de exemplo para que a peça conferida na tela deixasse de ser a
 * peça que chega na caixa — e uma prévia que mente é pior que nenhuma, porque dá confiança.
 *
 * ═══ POR QUE OS LINKS NÃO SÃO REAIS ══════════════════════════════════════════════════════════
 *
 * Cada e-mail deste produto carrega uma chave de acesso: o do relatório leva direto à análise
 * comprada, o de acesso é um token de uso único que abre a conta. Montar um teste com valores de
 * verdade seria criar chaves válidas para conferir layout — e uma delas ficaria para sempre na
 * caixa de quem recebeu o teste, ou no encaminhamento dela.
 *
 * Os destinos aqui são páginas públicas do site, que existem e abrem. O que se está conferindo é a
 * peça — a faixa, o botão, o assunto, o modo escuro, o spam —, e nada disso depende do link ser uma
 * chave de verdade.
 */
export type AmostraId = 'relatorio' | 'pesquisa' | 'acesso';

type Amostra = {
  id: AmostraId;
  label: string;
  /** Quando esta mensagem chega ao cliente, em uma linha. Vai na tela, ao lado do seletor. */
  quando: string;
  /**
   * `List-Unsubscribe` só na pesquisa.
   *
   * Ver `email/send.ts`: oferecer "descadastrar" num e-mail transacional é convidar a pessoa a
   * perder o acesso àquilo que ela pagou. O teste precisa reproduzir essa diferença — senão o
   * "cancelar inscrição" que o Gmail desenha apareceria no teste e não no envio real, ou o
   * contrário, e o ensaio estaria testando outra coisa.
   */
  descadastro: boolean;
  montar: () => Email;
};

export const AMOSTRAS: readonly Amostra[] = [
  {
    id: 'relatorio',
    label: 'Sua análise está pronta',
    quando: 'Logo depois do pagamento. É o e-mail que devolve o relatório a quem fechou o navegador.',
    descadastro: false,
    /*
      O nome e o preço são os do produto de verdade porque fazem parte do que se confere: é a linha
      que diz ao cliente o que ele comprou e por quanto. O ENDEREÇO é que não pode ser real — um
      link de relatório é a chave dele.
    */
    montar: () =>
      reportReadyEmail({
        url: `${SITE_URL}/minhas-analises`,
        productName: 'Setup completo',
        amountCents: 4999,
      }),
  },
  {
    id: 'pesquisa',
    label: 'O que achou do seu Setup?',
    quando: 'Quinze dias depois da compra, uma vez só, e só se o disparo estiver ligado.',
    descadastro: true,
    montar: () => satisfactionSurveyEmail({ url: `${SITE_URL}/avaliacao/previa` }),
  },
  {
    id: 'acesso',
    label: 'Seu link de acesso',
    quando: 'Quando alguém pede para entrar em /entrar, para reabrir as análises já compradas.',
    descadastro: false,
    /* `/entrar` e não um token: um token de verdade abriria a conta de quem recebesse o teste. */
    montar: () => magicLinkEmail({ url: `${SITE_URL}/entrar`, minutes: 15 }),
  },
];

export function amostraPor(id: string | null | undefined): Amostra {
  /*
    Desconhecido cai no primeiro em vez de quebrar. Quem digita `?modelo=xpto` na barra de endereço
    quer ver um e-mail, não uma tela de erro — e não há nada a proteger aqui: as três amostras são
    a mesma informação pública montada com dados de exemplo.
  */
  return AMOSTRAS.find((a) => a.id === id) ?? AMOSTRAS[0]!;
}
