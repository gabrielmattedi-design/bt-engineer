'use client';

import { useEffect, useState } from 'react';
import { CONSENT_COOKIE, CONSENT_EVENT, parseConsent, type ConsentState } from '@/lib/consent';

/**
 * "Preferências de cookies" — o caminho para MUDAR de ideia.
 *
 * ═══ POR QUE ISTO FALTAVA, E POR QUE É UMA FALHA E NÃO UM ENFEITE ════════════════════════════
 *
 * O banner de consentimento nasceu sem saída. Quem respondia uma vez ficava com a decisão gravada
 * por 180 dias, e a única forma de reverter era o que a página de privacidade mandava fazer:
 * *"apague os cookies deste site no seu navegador"*. Isso é hostil e, na prática, funciona só para
 * quem sabe onde fica esse menu.
 *
 * Faltou perceber que consentimento sem revogação fácil não é consentimento — a LGPD trata os dois
 * como o mesmo direito, e revogar tem de ser tão simples quanto conceder.
 *
 * O defeito apareceu por um caminho que não era o do usuário final: o dono testou o pixel, clicou
 * uma vez, e depois não conseguia mais ver o banner para testar o outro caminho. Ficou preso ao
 * próprio "não" sem nenhum botão na tela — exatamente o que qualquer visitante viveria.
 *
 * ═══ POR QUE ELE SÓ APARECE DEPOIS DE UMA DECISÃO ════════════════════════════════════════════
 *
 * Enquanto ninguém respondeu, o banner está na tela e este link seria uma segunda porta para a
 * mesma pergunta. Ele nasce quando existe algo para desfazer.
 */
export function ConsentReset() {
  const [estado, setEstado] = useState<ConsentState | null>(null);

  useEffect(() => {
    const ler = () => setEstado(parseConsent(document.cookie));
    ler();
    /* Sem isto, quem acabou de responder o banner não vê este link até a próxima navegação. */
    window.addEventListener(CONSENT_EVENT, ler);
    return () => window.removeEventListener(CONSENT_EVENT, ler);
  }, []);

  if (estado === null || estado === 'nao_decidido') return null;

  return (
    <button
      type="button"
      onClick={() => {
        /*
          `max-age=0` apaga o cookie. O reload é o que traz o banner de volta — ele lê o cookie num
          efeito de montagem, então mudar o cookie sem recarregar não o faria reaparecer.
        */
        document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
        window.location.reload();
      }}
      className="underline"
    >
      {/*
        O rótulo diz o estado atual, e não só a ação.

        "Preferências de cookies" sozinho obriga a clicar para descobrir o que foi decidido. Dizer
        "medição ativa" ou "medição desativada" responde a pergunta antes do clique — e para quem
        recusou, é a confirmação de que o "não" está valendo.
      */}
      Cookies: {estado === 'aceito' ? 'medição ativa' : 'medição desativada'}
    </button>
  );
}
