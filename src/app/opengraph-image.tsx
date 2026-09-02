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
            O selo circular, desenhado com borda e texto.

            O logotipo do site é SVG num componente React que o gerador de OG não renderiza, e
            buscar um arquivo aqui criaria uma dependência de rede numa imagem que precisa sair
            sempre. Um círculo com a inicial é o mesmo sinal, sem nada para falhar.
          */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 46,
              height: 46,
              borderRadius: 23,
              border: `2px solid ${BRANCO}`,
              color: BRANCO,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            TE
          </div>
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
