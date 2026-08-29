/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Os arquivos `.sql` de migração precisam existir no servidor em runtime.
   *
   * `/admin/setup` executa as migrações a partir do painel, e o rastreador de arquivos do Next só
   * inclui o que consegue enxergar em `import`. Uma pasta lida por caminho, em tempo de execução,
   * é invisível para ele — sem esta declaração o botão funciona em desenvolvimento e falha em
   * produção com "arquivo não encontrado", que é o pior momento possível para descobrir isso.
   */
  outputFileTracingIncludes: {
    '/admin/setup': ['./src/database/migrations/**/*'],
  },

  /**
   * ═══ CABEÇALHOS DE SEGURANÇA ═══════════════════════════════════════════════════════════════
   *
   * Não havia nenhum. São instruções que o navegador obedece de graça, e cada uma fecha uma classe
   * inteira de ataque que o código sozinho não alcança — porque quem executa o ataque é o navegador
   * da vítima, não o nosso servidor.
   *
   * A lista é curta de propósito: só o que dá proteção real sem risco de quebrar a página. Um
   * cabeçalho apertado demais que quebra o site em silêncio é pior que cabeçalho nenhum, porque a
   * pressa de restaurar remove todos de uma vez.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            /*
              CLICKJACKING.
              Sem isto, qualquer pessoa embute o site num `<iframe>` invisível sobre a própria
              página e faz o visitante clicar em coisas achando que clica em outra. No painel de
              admin, um clique roubado é uma migração rodada ou um cupom criado.
            */
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // O mesmo, na forma moderna que os navegadores atuais preferem.
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'",
          },
          {
            /*
              O navegador para de "adivinhar" o tipo do arquivo pelo conteúdo. Sem isto, um arquivo
              enviado como texto pode ser interpretado como script se o conteúdo se parecer com um.
            */
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            /*
              VAZAMENTO DE URL PELO REFERER — e aqui não é teórico.

              O endereço do relatório é a chave de acesso a ele. Ao clicar em qualquer link externo
              a partir dessa página, o navegador manda a URL atual para o site de destino no
              cabeçalho `Referer` — entregando a chave do relatório pago a um terceiro qualquer.

              `strict-origin-when-cross-origin` manda só o domínio para fora, e a URL inteira
              apenas na navegação dentro do próprio site.
            */
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            /*
              Desliga recursos que este produto nunca usa. Se um script hostil chegar a rodar aqui
              um dia, ele já encontra câmera, microfone e localização fechados.
            */
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            /*
              HSTS: o navegador passa a recusar HTTP neste domínio, mesmo que alguém force o
              endereço. Fecha a janela do primeiro acesso, em que um redirecionamento pode ser
              interceptado numa rede pública.

              Sem `preload` e sem `includeSubDomains` de propósito: os dois são difíceis de desfazer
              e podem derrubar um subdomínio futuro que ainda não tenha certificado.
            */
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000',
          },
        ],
      },
      {
        /*
          O painel nunca deve ser guardado por intermediário nenhum.

          Sem isto, uma tela de administração pode ficar em cache de navegador compartilhado e
          reaparecer para a próxima pessoa que usar aquele computador.
        */
        source: '/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
