import { ImageResponse } from 'next/og';
import { brl } from '@/payments/catalogo';
import { precosPublicados } from '@/payments/precos';

/**
 * A imagem que aparece quando o link é compartilhado — §15.
 *
 * ═══ POR QUE ISTO IMPORTA MAIS EM TRÁFEGO PAGO ═══════════════════════════════════════════════
 *
 * Sem esta imagem, o link colado no WhatsApp, no Instagram ou dentro de um anúncio aparece como um
 * retângulo cinza com o endereço escrito. Em tráfego frio, esse retângulo é a primeira coisa que a
 * pessoa vê do produto, antes de qualquer texto — e um link sem prévia lê como link suspeito.
 *
 * ═══ POR QUE ELA DEIXOU DE SER UM CARTÃO DE MARCA ════════════════════════════════════════════
 *
 * A primeira versão trazia a marca, o slogan e a lista do que o produto entrega. Estava correta e
 * não vendia nada: quem recebe um link no WhatsApp não está procurando saber quem somos, e "raquete
 * · corda · espessura · tensão" só significa alguma coisa para quem já entendeu o problema.
 *
 * A versão atual lidera pelo PROBLEMA e ancora no preço. É o mesmo movimento que a home faz — e,
 * num compartilhamento, é a única chance de fazê-lo, porque a prévia costuma ser tudo o que a
 * pessoa lê antes de decidir se abre.
 *
 * ═══ E POR QUE ELA NÃO É SÓ A MARCA — ISTO JÁ FOI TENTADO ════════════════════════════════════
 *
 * Set/2026: esta peça foi trocada por um monograma centralizado em fundo verde, com o argumento de
 * que "o WhatsApp mostra uma miniatura de cem pixels e nenhum texto sobrevive". O argumento estava
 * errado, e o erro foi de PREMISSA, não de execução.
 *
 * O WhatsApp abre um CARTÃO GRANDE: a imagem ocupa a largura inteira da mensagem e aparece por
 * completo, com o título e o domínio embaixo. Verificado num print de conversa real. Nesse tamanho
 * a marca sozinha fica pequena e não diz nada além de "existe uma empresa"; a manchete e o preço
 * são perfeitamente legíveis.
 *
 * A miniatura pequena existe em outros lugares — resultado de busca, alguns clientes de e-mail —,
 * e ali o título ao lado carrega o nome. Otimizar a peça para o caso menos importante custava o
 * caso mais importante.
 *
 * ═══ O PREÇO VEM DO BANCO, E ISSO TEM UM PORÉM QUE VOCÊ PRECISA CONHECER ═════════════════════
 *
 * Ele é lido de `products`, como em toda tela (§34), então nasce certo. Mas WhatsApp e Facebook
 * GUARDAM a prévia por conta própria, às vezes por semanas, e não existe forma de pedir que eles a
 * releiam. Depois de mudar o preço no painel, um link antigo pode continuar mostrando o valor
 * anterior por um tempo — e a página, aberta, mostra o novo.
 *
 * A alternativa seria não escrever preço nenhum aqui. Ele fica porque é o que faz a prévia
 * funcionar como anúncio, e porque o desencontro é temporário, visível e para MENOS risco do que
 * parece: quem clica vê o preço real antes de qualquer pagamento, e o que a loja cobra nunca sai
 * daqui.
 *
 * Formato 1200×630 — o que Instagram, WhatsApp, Facebook e X recortam sem cortar nada.
 */

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Errar a raquete custa caro. Tennis Engineer — análise técnica independente.';

/**
 * O monograma, escrito como SVG literal.
 *
 * ─── POR QUE NÃO O COMPONENTE `<LogoMark>` ───────────────────────────────────────────────────
 *
 * O gerador de OG desenha um subconjunto de CSS sobre elementos simples; ele não executa o
 * componente React nem resolve `currentColor`, `clipPath` por id ou `className`. Passar o SVG
 * pronto, como imagem, é o que faz o desenho chegar inteiro.
 *
 * A cópia tem um custo real: mudar a marca em `logo.tsx` não muda esta. É o preço de a prévia não
 * depender de rede nem de execução — e a marca é, por definição do brand book, a coisa que menos
 * muda no produto. Uma mudança nela é um evento, não um ajuste.
 *
 * Branco fixo, como o book manda sobre fundo escuro: "a marca deve ser aplicada sempre em preto ou
 * branco; cores de destaque nunca são aplicadas à marca" (pág. 04).
 */
const MONOGRAMA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <clipPath id="ball"><circle cx="60" cy="60" r="41"/></clipPath>
    <clipPath id="face"><ellipse cx="41" cy="64" rx="21" ry="29" transform="rotate(-8 41 64)"/></clipPath>
  </defs>
  <g stroke="#FFFFFF" stroke-width="1.2" stroke-dasharray="5 3 1.5 3">
    <line x1="60" y1="7" x2="60" y2="26"/><line x1="60" y1="94" x2="60" y2="113"/>
    <line x1="7" y1="60" x2="26" y2="60"/><line x1="94" y1="60" x2="113" y2="60"/>
  </g>
  <g clip-path="url(#face)" stroke="#FFFFFF" stroke-width="0.7" opacity="0.65">
    <g transform="skewX(-6) translate(5 0)">
      <line x1="24" y1="30" x2="24" y2="98"/><line x1="30" y1="30" x2="30" y2="98"/>
      <line x1="36" y1="30" x2="36" y2="98"/><line x1="42" y1="30" x2="42" y2="98"/>
      <line x1="48" y1="30" x2="48" y2="98"/><line x1="54" y1="30" x2="54" y2="98"/>
      <line x1="16" y1="38" x2="58" y2="38"/><line x1="16" y1="44" x2="58" y2="44"/>
      <line x1="16" y1="50" x2="58" y2="50"/><line x1="16" y1="56" x2="58" y2="56"/>
      <line x1="16" y1="62" x2="58" y2="62"/><line x1="16" y1="68" x2="58" y2="68"/>
      <line x1="16" y1="74" x2="58" y2="74"/><line x1="16" y1="80" x2="58" y2="80"/>
      <line x1="16" y1="86" x2="58" y2="86"/><line x1="16" y1="92" x2="58" y2="92"/>
    </g>
  </g>
  <g clip-path="url(#ball)" fill="none" stroke="#FFFFFF">
    <path d="M 36 25 Q 20 62 44 95" stroke-width="1.1"/>
    <path d="M 87 34 Q 95 60 88 90" stroke-width="1.6"/>
  </g>
  <circle cx="60" cy="60" r="41" stroke="#FFFFFF" stroke-width="2.6"/>
  <path d="M 40 36 H 84 V 44 H 66 V 58.5 H 81.5 V 66.5 H 66 V 83 H 85 V 91 H 54 V 44 H 40 Z" fill="#FFFFFF"/>
</svg>`;

const MONOGRAMA_URI = `data:image/svg+xml;base64,${Buffer.from(MONOGRAMA).toString('base64')}`;

/* Paleta do brand book, escrita em hexadecimal: o gerador de OG não enxerga o Tailwind. */
const VERDE = '#0E3D2E';
const AMARELO = '#E8C547';
const LARANJA = '#C75B39';
const BRANCO = '#FFFFFF';

export default async function Image() {
  const precos = await precosPublicados();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: VERDE,
          padding: '48px 64px',
          position: 'relative',
        }}
      >
        {/*
          Malha de blueprint, a mesma textura do herói.

          Desenhada com divs e não com imagem de fundo: o gerador de OG não carrega CSS externo nem
          arquivo, e uma textura que falha silenciosamente deixaria o card chapado sem ninguém ver.
        */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', opacity: 0.06 }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${i * 40}px`,
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: BRANCO,
              }}
            />
          ))}
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={`h${i}`}
              style={{
                position: 'absolute',
                top: `${i * 40}px`,
                left: 0,
                right: 0,
                height: '1px',
                backgroundColor: BRANCO,
              }}
            />
          ))}
        </div>

        {/* ── ASSINATURA ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/*
            O monograma de verdade, e não um círculo com "TE" escrito dentro.

            A primeira versão desenhava um círculo com as duas letras porque o gerador de OG não
            executa o componente React do logotipo. Funcionava e violava o brand book, que manda
            NUNCA abreviar a marca para "TE" (pág. 04) — justamente o que aquele selo fazia.

            Passando o SVG pronto como imagem, o desenho chega inteiro: bola, leito de cordas,
            costuras, marcas de registro e a ligadura T+E. Sem rede, sem arquivo, sem React.
          */}
          <img src={MONOGRAMA_URI} width={52} height={52} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 27, fontWeight: 700, color: BRANCO }}>
              Tennis Engineer
            </div>
            <div style={{ display: 'flex', fontSize: 17, color: BRANCO, opacity: 0.6 }}>
              Seu jogo. Seu setup. Sob medida.
            </div>
          </div>
        </div>

        {/* ── A MANCHETE ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 44,
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
          }}
        >
          <div style={{ display: 'flex', color: BRANCO }}>Errar a raquete</div>
          <div style={{ display: 'flex', color: BRANCO }}>custa caro.</div>
          {/*
            O preço em Court Yellow é o único número da peça, e é onde o olho para.

            Ele fecha a frase que a linha branca abriu: o problema custa caro, a solução custa isto.
            Sem o valor, a prévia faria a pergunta e deixaria a resposta para depois do clique — que
            é exatamente onde a pessoa desiste.
          */}
          <div style={{ display: 'flex', color: AMARELO, marginTop: 6 }}>
            Acertar custa {brl(precos.racket_report)}.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            width: '100%',
            height: 2,
            backgroundColor: BRANCO,
            opacity: 0.22,
          }}
        />

        {/* ── O PORQUÊ, EM UMA FRASE ─────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            marginTop: 22,
            fontSize: 24,
            lineHeight: 1.4,
            color: BRANCO,
            opacity: 0.85,
          }}
        >
          Uma raquete que não combina com você trava sua evolução e custa tempo e dinheiro.
        </div>

        {/* ── A AÇÃO ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            marginTop: 26,
            backgroundColor: LARANJA,
            color: BRANCO,
            fontSize: 25,
            fontWeight: 700,
            padding: '18px 38px',
            borderRadius: 8,
          }}
        >
          Descubra sua raquete ideal
        </div>

        {/* ── RODAPÉ ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 'auto',
            fontSize: 19,
            fontWeight: 600,
            color: BRANCO,
            opacity: 0.55,
          }}
        >
          <div style={{ display: 'flex' }}>tennisengineer.com.br</div>
          <div style={{ display: 'flex' }}>Análise técnica independente</div>
        </div>
      </div>
    ),
    size,
  );
}
