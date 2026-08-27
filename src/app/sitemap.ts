import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * As páginas públicas — três, e é para ser três mesmo.
 *
 * ═══ POR QUE UM SITEMAP TÃO CURTO ════════════════════════════════════════════════════════════
 *
 * Quase todo endereço deste site é o conteúdo de uma pessoa: um relatório, uma análise, uma tela
 * de planos de uma sessão específica. Listá-los seria entregar ao buscador exatamente o que
 * `robots.ts` acabou de pedir para ele não olhar.
 *
 * O que resta são as três portas de entrada de verdade. Um sitemap curto e correto vale mais que
 * um longo: ele diz ao buscador onde está o conteúdo que se quer encontrado, em vez de fazê-lo
 * adivinhar entre milhares de páginas privadas.
 *
 * ═══ POR QUE ESTÁTICO, E NÃO GERADO DO BANCO ═════════════════════════════════════════════════
 *
 * Não há conteúdo público que nasça no banco. O catálogo é servido de arquivo, e as raquetes não
 * têm página própria. No dia em que tiverem, esta função passa a consultar — e vai ser uma
 * mudança óbvia, porque o motivo está escrito aqui.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();

  return [
    {
      url: SITE_URL,
      lastModified: agora,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      /*
        O questionário é porta de entrada, não página interna.

        Um anúncio pode apontar direto para cá, pulando a home — e quem busca "qual raquete
        combina comigo" quer justamente esta tela, não a apresentação.
      */
      url: `${SITE_URL}/questionario`,
      lastModified: agora,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/catalogo`,
      lastModified: agora,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    /*
      As páginas legais entram no sitemap, e não é formalidade.

      As plataformas de anúncio verificam se existe política de privacidade acessível antes de
      aprovar campanha de produto pago. Listá-las é o caminho mais curto entre o robô e a página —
      e elas não competem com nada, porque ninguém busca por elas.
    */
    { url: `${SITE_URL}/privacidade`, lastModified: agora, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${SITE_URL}/termos`, lastModified: agora, changeFrequency: 'yearly', priority: 0.1 },
  ];
}
