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
 * O card de resultado que a pessoa compartilha já foi desenhado com cuidado. O link do site, que é
 * o que a campanha distribui, não tinha nada.
 *
 * ═══ POR QUE GERADA EM CÓDIGO, E NÃO UM PNG NA PASTA ═════════════════════════════════════════
 *
 * Um arquivo de imagem sai de sincronia em silêncio: alguém muda a assinatura da marca ou o
 * posicionamento, e o PNG continua mostrando a versão de meses atrás para todo mundo que
 * compartilhar. Gerada do mesmo texto que o site usa, ela não tem como divergir.
 *
 * Fica no formato 1200×630, que é o que Instagram, WhatsApp, Facebook e X recortam sem cortar nada.
 */

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Tennis Engineer — Seu jogo. Seu setup. Sob medida.';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          // Grand Slam Green — a superfície institucional da marca (brand book, pág. 01).
          backgroundColor: '#0E3D2E',
          padding: '80px',
          position: 'relative',
        }}
      >
        {/*
          Malha de blueprint, a mesma textura do herói.

          Desenhada com divs e não com imagem de fundo: o gerador de OG não carrega CSS externo nem
          arquivo, e uma textura que falha silenciosamente deixaria o card chapado sem ninguém ver.
        */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', opacity: 0.07 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${i * 100}px`,
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: '#FFFFFF',
              }}
            />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={`h${i}`}
              style={{
                position: 'absolute',
                top: `${i * 100}px`,
                left: 0,
                right: 0,
                height: '1px',
                backgroundColor: '#FFFFFF',
              }}
            />
          ))}
        </div>

        {/* Marca em BRANCO sobre o verde — nunca colorida (brand book, pág. 04). */}
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '-0.02em',
          }}
        >
          Tennis Engineer
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 44,
            color: '#FFFFFF',
            opacity: 0.9,
          }}
        >
          Seu jogo. Seu setup. Sob medida.
        </div>

        {/* Linha de conceito em Court Yellow — "performance e energia". */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 40, gap: 16 }}>
          <div style={{ width: 60, height: 3, backgroundColor: '#E8FF4A' }} />
          <div style={{ display: 'flex', fontSize: 28, color: '#E8FF4A', fontWeight: 600 }}>
            Precisão técnica aplicada ao seu jogo
          </div>
        </div>

        {/*
          A promessa concreta fecha o card.

          "Raquete, corda, espessura e tensão" diz o que a pessoa recebe; a marca e o slogan sozinhos
          diriam apenas que existe uma empresa de tênis. Em anúncio, quem não entende a entrega em
          dois segundos não clica.
        */}
        <div
          style={{
            display: 'flex',
            marginTop: 56,
            fontSize: 30,
            color: '#FFFFFF',
            opacity: 0.65,
          }}
        >
          Raquete · corda · espessura · tensão — a partir do seu jogo
        </div>
      </div>
    ),
    size,
  );
}
