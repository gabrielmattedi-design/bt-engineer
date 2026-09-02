import { ImageResponse } from 'next/og';

/**
 * A imagem que aparece quando o link é compartilhado — §15.
 *
 * ═══ POR QUE ISTO IMPORTA MAIS EM TRÁFEGO PAGO ═══════════════════════════════════════════════
 *
 * Sem esta imagem, o link colado no WhatsApp, no Instagram ou dentro de um anúncio aparece como um
 * retângulo cinza com o endereço escrito. Em tráfego frio, esse retângulo é a primeira coisa que a
 * pessoa vê do produto, antes de qualquer texto — e um link sem prévia lê como link suspeito.
 *
 * ═══ POR QUE ELA VOLTOU A SER SÓ A MARCA ═════════════════════════════════════════════════════
 *
 * A versão anterior era uma peça de anúncio: manchete em duas linhas, o preço em amarelo, um botão
 * e um rodapé. Fazia sentido no papel e não sobreviveu ao destino real.
 *
 * O WhatsApp exibe a prévia como uma MINIATURA de cerca de cem pixels, recortada no centro. Uma
 * manchete de 62px vira um borrão de dois pixels de altura; o botão vira uma tarja laranja sem
 * texto; o preço, que era o ponto da peça, some. Relatado assim: "apareceu, mas muito pequeno,
 * fica ruim".
 *
 * Uma marca centralizada é a única coisa que atravessa esse recorte. Ela não precisa ser lida —
 * precisa ser RECONHECIDA, e reconhecer é o que ainda funciona em cem pixels. O nome do produto
 * continua na prévia, como texto do título ao lado da miniatura: escrevê-lo também na imagem seria
 * gastar o espaço que a marca precisa para dizer a mesma coisa duas vezes.
 *
 * O monograma vai INTEIRO — leito de cordas, costuras e marcas de registro. É a mesma aplicação do
 * herói da home. Existe uma versão simplificada no componente, para selos abaixo de ~24px; aqui ela
 * seria um empobrecimento sem motivo, porque o desenho é renderizado grande e só depois reduzido
 * pelo aplicativo, com a suavização dele.
 *
 * ═══ E O PREÇO SAIU, DE PROPÓSITO ════════════════════════════════════════════════════════════
 *
 * Ele era o motivo de esta rota ler o banco. Sem ele, a imagem não depende de nada e some junto o
 * problema que ela carregava: WhatsApp e Facebook guardam a prévia por semanas, sem forma de pedir
 * que releiam, então um preço aqui congelava no valor do dia em que o link foi compartilhado pela
 * primeira vez. Anunciar um valor e cobrar outro é o que o resto deste código existe para impedir.
 *
 * Formato 1200×630 — o que Instagram, WhatsApp, Facebook e X aceitam sem recusar. Quem recorta em
 * quadrado pega os 630 do centro, e é por isso que a marca fica centralizada nos DOIS eixos.
 */

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Tennis Engineer';

/** Grand Slam Green — a superfície institucional da marca (brand book, pág. 01). */
const VERDE = '#0E3D2E';

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
const B = '#FFFFFF';

const MONOGRAMA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <clipPath id="ball"><circle cx="60" cy="60" r="41"/></clipPath>
    <clipPath id="face"><ellipse cx="41" cy="64" rx="21" ry="29" transform="rotate(-8 41 64)"/></clipPath>
  </defs>
  <g stroke="${B}" stroke-width="1.2" stroke-dasharray="5 3 1.5 3">
    <line x1="60" y1="7" x2="60" y2="26"/><line x1="60" y1="94" x2="60" y2="113"/>
    <line x1="7" y1="60" x2="26" y2="60"/><line x1="94" y1="60" x2="113" y2="60"/>
  </g>
  <g clip-path="url(#face)" stroke="${B}" stroke-width="0.7" opacity="0.65">
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
  <g clip-path="url(#ball)" fill="none" stroke="${B}">
    <path d="M 36 25 Q 20 62 44 95" stroke-width="1.1"/>
    <path d="M 87 34 Q 95 60 88 90" stroke-width="1.6"/>
  </g>
  <circle cx="60" cy="60" r="41" stroke="${B}" stroke-width="2.6"/>
  <path d="M 40 36 H 84 V 44 H 66 V 58.5 H 81.5 V 66.5 H 66 V 83 H 85 V 91 H 54 V 44 H 40 Z" fill="${B}"/>
</svg>`;

const MONOGRAMA_URI = `data:image/svg+xml;base64,${Buffer.from(MONOGRAMA).toString('base64')}`;

/**
 * Lado do monograma, em pixels.
 *
 * 380 sobre 630 de altura deixa ~125px de respiro em cima e embaixo, e cabe folgado no recorte
 * quadrado central de 630×630 que os aplicativos de mensagem fazem. Maior encostaria na borda do
 * recorte; menor desperdiçaria a única coisa que a miniatura consegue mostrar.
 */
const MARCA_PX = 380;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: VERDE,
          position: 'relative',
        }}
      >
        {/*
          Malha de blueprint — a mesma textura do herói, em passo LARGO.

          No herói ela tem 8px e some no fundo. Aqui a imagem inteira é reduzida a uma miniatura, e
          uma malha fina viraria um chuvisco cinza por cima do verde. Com 60px de passo e opacidade
          baixa, ela ainda lê como papel de projeto no tamanho cheio e simplesmente desaparece no
          tamanho pequeno, que é o comportamento certo para uma textura.
        */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', opacity: 0.05 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={`v${i}`}
              style={{
                position: 'absolute',
                left: `${i * 60}px`,
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: B,
              }}
            />
          ))}
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={`h${i}`}
              style={{
                position: 'absolute',
                top: `${i * 60}px`,
                left: 0,
                right: 0,
                height: '1px',
                backgroundColor: B,
              }}
            />
          ))}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MONOGRAMA_URI} width={MARCA_PX} height={MARCA_PX} alt="" />
      </div>
    ),
    size,
  );
}
