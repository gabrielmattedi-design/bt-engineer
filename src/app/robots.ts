import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * O que os buscadores podem indexar — e por que isto é segurança, não SEO.
 *
 * ═══ O VAZAMENTO QUE ISTO FECHA ══════════════════════════════════════════════════════════════
 *
 * O acesso ao relatório é pelo LINK: `grantedEntitlements` consulta o `publicId` que está na URL,
 * sem exigir cookie nenhum. Isso é deliberado e necessário — o link que chega por e-mail precisa
 * abrir no celular, no computador do trabalho, em qualquer lugar. Se dependesse do cookie do
 * navegador que comprou, o e-mail seria inútil.
 *
 * A contrapartida é que quem tem o endereço tem o relatório. Enquanto ele circula só entre a caixa
 * de entrada e o dono, tudo bem. Um endereço INDEXADO é outra coisa: vira um relatório pago
 * encontrável por qualquer pessoa numa busca, e o dono nunca saberia.
 *
 * Não é hipótese remota. Basta um `publicId` aparecer numa captura de tela postada, num link
 * compartilhado em página pública, ou numa barra de endereço com sugestão sincronizada — e o robô
 * segue dali. `Disallow` é o que impede que o buscador guarde e publique o que encontrar.
 *
 * ═══ POR QUE ISTO NÃO BASTA SOZINHO ══════════════════════════════════════════════════════════
 *
 * `robots.txt` é um pedido, não uma tranca: um robô mal-comportado ignora. Por isso cada uma
 * dessas páginas também declara `robots: { index: false }` no próprio HTML, e as duas camadas
 * existem porque falham de formas diferentes — o arquivo cobre a rota inteira antes da visita, a
 * meta tag cobre a página mesmo quando alguém chegou nela por outro caminho.
 *
 * Nenhuma das duas substitui a única proteção de verdade, que é o `publicId` ser imprevisível.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Relatórios e análises: cada URL destas é o conteúdo de uma pessoa específica.
          '/resultado/',
          '/analise/',
          '/planos/',
          '/retorno/',
          // Área do cliente e autenticação. `/entrar/<token>` é uma chave de acesso de uso único.
          '/minhas-analises',
          '/entrar/',
          // Painel do dono.
          '/admin',
          // Superfície interna que não tem por que aparecer em busca nenhuma.
          '/api/',
          '/checkout-simulado/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
