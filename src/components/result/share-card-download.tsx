'use client';

import { useState } from 'react';

/**
 * Baixa o card como PNG, rasterizando o SVG no próprio navegador.
 *
 * ─── POR QUE NO CLIENTE, E SEM BIBLIOTECA ────────────────────────────────────────────────────
 *
 * As alternativas seriam gerar a imagem no servidor (exige `sharp` ou `resvg` — dezenas de MB de
 * binário numa função serverless) ou usar `html2canvas` (~200 kB, e reimplementa o motor de
 * layout do navegador com resultado aproximado).
 *
 * O card já é um SVG autocontido — sem imagem externa, sem `@font-face`. Para esse caso o próprio
 * navegador faz o trabalho em vinte linhas: serializa, carrega como imagem, desenha no canvas e
 * exporta. É por isso que `share-card.tsx` usa fonte de sistema e cores literais: a restrição
 * daquele arquivo existe para viabilizar este.
 *
 * ─── A ESCALA 2× ─────────────────────────────────────────────────────────────────────────────
 *
 * O card sai em 2160×2700 para não amassar quando alguém abrir em tela de alta densidade ou der
 * zoom. Um PNG de card compartilhável que fica borrado no primeiro zoom não é compartilhado.
 */
export function ShareCardDownload({
  svgId,
  fileName,
}: {
  readonly svgId: string;
  readonly fileName: string;
}) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');

  async function download(): Promise<void> {
    const svg = document.getElementById(svgId);
    if (!(svg instanceof SVGSVGElement)) return;

    setState('working');
    try {
      const source = new XMLSerializer().serializeToString(svg);
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('falha ao carregar o SVG'));
        image.src = url;
      });

      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = (svg.viewBox.baseVal.width || 1080) * scale;
      canvas.height = (svg.viewBox.baseVal.height || 1350) * scale;

      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas indisponível');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('falha ao gerar o PNG');

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={download}
        disabled={state === 'working'}
        className="flex min-h-[56px] w-full items-center justify-center rounded bg-ball px-6
                   font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50
                   sm:w-auto"
      >
        {state === 'working' ? 'Gerando imagem…' : 'Baixar meu card'}
      </button>

      {state === 'error' && (
        <p className="mt-3 text-sm text-warn">
          Não foi possível gerar a imagem neste navegador. Uma captura de tela do card acima
          funciona igual.
        </p>
      )}
    </div>
  );
}
