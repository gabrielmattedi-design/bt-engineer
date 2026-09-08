'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_EVENT,
  parseConsent,
  type ConsentState,
} from '@/lib/consent';
import { META_PIXEL_ID, metaDescarregarFila, pixelConfigurado } from '@/lib/meta-pixel';

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

    /*
      Despacha o que chegou antes do script existir.

      Um `<script>` embutido executa de forma SÍNCRONA no `appendChild`, então `window.fbq` já
      existe nesta linha. Sem esta chamada, todo evento disparado antes deste efeito é perdido — e
      é o caso normal, não a exceção: os efeitos dos filhos rodam antes dos do pai, e este
      componente ainda precisa de dois renders para chegar aqui.

      Foi assim que o `Lead` sumia. Ver o cabeçalho de `meta-pixel.ts`.
    */
    metaDescarregarFila();
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
    /* Avisa o link do rodapé, que também depende desta decisão. Ver `CONSENT_EVENT`. */
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  if (estado === null || estado !== 'nao_decidido') return null;

  return (
    /*
      ═══ O TAMANHO DESTE BANNER É UM NÚMERO MEDIDO, NÃO UM GOSTO ═════════════════════════════

      A primeira versão ocupava 490 px de uma tela de 844 — **30% da primeira dobra no celular**.
      Medido com o site rodando, num iPhone 13, que é o aparelho mais comum do tráfego de Instagram
      no Brasil. Para quem chega de anúncio, a primeira impressão do produto seria 70% site e 30%
      aviso de cookie, num visitante que decide em três segundos se fica.

      O que encolheu, e por quê:

        - o texto perdeu a explicação ("para entender quais anúncios trazem gente que se interessa
          de verdade") — ela é honesta e está por extenso em /privacidade, que é onde quem se
          importa vai ler. No banner ela só empurrava o site para baixo;
        - `text-xs` e `py-3` no celular, voltando ao normal a partir de `sm`;
        - os botões passaram a dividir a linha com o texto desde o começo, em vez de empilhar.

      Resultado: ~120 px no celular, contra 490. O que NÃO mudou é o que não pode mudar — recusar
      continua com o mesmo peso visual e a mesma área de clique que aceitar.
    */
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-court/15 bg-paper/95 px-3 py-3 backdrop-blur sm:px-6 sm:py-4"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-xs leading-snug text-ink/75 sm:text-sm sm:leading-relaxed">
          Usamos um cookie de medição do Meta. Sem ele o site funciona igual.{' '}
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
            className="flex-1 rounded-lg border border-court/30 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-court/5 sm:flex-none sm:min-w-[104px]"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => decidir('aceito')}
            className="flex-1 rounded-lg bg-clay px-4 py-2 text-sm font-semibold text-paper transition hover:bg-clay/90 sm:flex-none sm:min-w-[104px]"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
