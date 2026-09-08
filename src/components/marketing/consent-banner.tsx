'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  parseConsent,
  type ConsentState,
} from '@/lib/consent';
import { META_PIXEL_ID, pixelConfigurado } from '@/lib/meta-pixel';

/**
 * O banner de consentimento e o carregador do pixel, no mesmo componente.
 *
 * ═══ POR QUE JUNTOS, E NÃO EM DOIS COMPONENTES ═══════════════════════════════════════════════
 *
 * Porque separá-los cria a possibilidade de o pixel existir sem o banner. Dois componentes com o
 * mesmo estado é uma sincronia que alguém quebra numa refatoração de terça-feira — e o modo de
 * falha é carregar rastreamento sem ter perguntado, que é exatamente o que não pode acontecer.
 *
 * Juntos, o script SÓ é injetado dentro do ramo em que o estado é `aceito`. Não existe caminho no
 * código que carregue o pixel sem passar por essa condição.
 *
 * ═══ POR QUE O ESTADO COMEÇA COMO NÃO-DECIDIDO E SÓ É LIDO NO EFEITO ═════════════════════════
 *
 * O servidor não sabe o cookie no momento de renderizar este componente (ele é cliente), e chutar
 * causaria hidratação divergente: o HTML do servidor mostraria o banner e o cliente o esconderia,
 * piscando na tela de quem já respondeu.
 *
 * Começar como `null` (ainda não sei) e resolver no primeiro efeito custa um frame sem banner e
 * elimina a piscada. Quem já decidiu nunca vê nada.
 */
export function ConsentBanner() {
  const [estado, setEstado] = useState<ConsentState | null>(null);

  useEffect(() => {
    setEstado(parseConsent(document.cookie));
  }, []);

  /*
    A injeção do pixel.

    Roda quando o estado vira `aceito` — tanto na carga da página de quem já aceitou antes quanto
    no clique de quem acabou de aceitar. É o que faz o "Aceitar" valer imediatamente, sem recarga:
    sem isso, quem aceita só passa a ser medido na página seguinte, e o PageView da visita em que
    a pessoa disse sim se perde.
  */
  useEffect(() => {
    if (estado !== 'aceito' || !pixelConfigurado()) return;
    if (document.getElementById('meta-pixel')) return;

    const script = document.createElement('script');
    script.id = 'meta-pixel';
    script.async = true;
    script.textContent = `
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', ${JSON.stringify(META_PIXEL_ID)});
      fbq('track', 'PageView');
    `;
    document.head.appendChild(script);
  }, [estado]);

  function decidir(valor: 'aceito' | 'recusado') {
    /*
      `SameSite=Lax` e não `Strict`: com `Strict` o cookie não viaja quando a pessoa chega por um
      link externo — que é literalmente todo mundo que vem de anúncio, o público inteiro pelo qual
      este banner existe. A decisão pareceria não ter sido tomada e o banner voltaria.
    */
    document.cookie =
      `${CONSENT_COOKIE}=${valor}; path=/; max-age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax`;
    setEstado(valor);
  }

  if (estado === null || estado !== 'nao_decidido') return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-court/15 bg-paper/95 px-4 py-4 backdrop-blur sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-ink/80">
          Usamos um cookie de medição do Meta para entender quais anúncios trazem gente que se
          interessa de verdade. Sem ele o site funciona igual.{' '}
          <Link href="/privacidade" className="underline underline-offset-2">
            O que isso coleta
          </Link>
          .
        </p>
        {/*
          Os dois botões têm o mesmo tamanho, o mesmo peso de fonte e a mesma área de clique.

          É requisito, não estética: um "recusar" menor, mais claro ou escondido num link é o padrão
          escuro que a LGPD e o GDPR tratam como consentimento inválido — se recusar dá mais
          trabalho que aceitar, o "sim" não foi livre.
        */}
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decidir('recusado')}
            className="min-w-[104px] rounded-lg border border-court/30 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-court/5"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => decidir('aceito')}
            className="min-w-[104px] rounded-lg bg-clay px-4 py-2 text-sm font-semibold text-paper transition hover:bg-clay/90"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
