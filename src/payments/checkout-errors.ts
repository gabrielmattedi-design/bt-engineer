/**
 * Tradução das falhas de checkout para frases que dizem o que fazer.
 *
 * Vive fora do arquivo `'use server'` porque lá todo export precisa ser uma função assíncrona —
 * um módulo separado é o que permite testar este mapeamento sem subir servidor nem banco. E ele
 * PRECISA de teste: é o texto que o dono do site vai ler no pior momento possível, quando o funil
 * de pagamento parou de funcionar e ele não tem acesso ao log da Vercel.
 *
 * A regra que orienta cada frase: dizer a AÇÃO, não o sintoma. "Erro ao processar" não ajuda
 * ninguém; "adicione ALLOW_FAKE_PAYMENTS=true nas configurações do projeto e refaça o deploy"
 * resolve o problema sem intermediário.
 */

export function describeCheckoutFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('ALLOW_FAKE_PAYMENTS')) {
    /**
     * O ponteiro para `/admin/setup` é a parte que faltava.
     *
     * Dizer "adicione a variável" não fecha o problema, porque a causa mais comum não é esquecer
     * de adicionar: é adicionar e a variável não chegar ao servidor — deploy não refeito, ambiente
     * errado, valor com maiúscula. O painel mostra o que o processo REALMENTE recebeu, que é a
     * única forma de sair da tentativa e erro contra um deploy de dois minutos.
     */
    return (
      'O pagamento ainda não está configurado neste site. Para rodar em modo demonstração, ' +
      'adicione a variável ALLOW_FAKE_PAYMENTS com o valor true nas configurações do projeto na ' +
      'Vercel, marque o ambiente Production e refaça o deploy. Abra /admin/setup para conferir se ' +
      'a variável chegou ao servidor.'
    );
  }

  if (message.includes('PAYMENT_PROVIDER') || message.includes('adapter')) {
    return `Configuração de pagamento inválida: ${message}`;
  }

  if (message.includes('DATABASE_URL')) {
    return 'O banco de dados não está configurado neste site (DATABASE_URL ausente).';
  }

  /**
   * Genérico deliberadamente vago sobre a causa, e específico sobre onde olhar.
   *
   * O erro cru pode carregar string de conexão, host interno ou trecho de SQL — nada disso pode
   * chegar ao navegador de um visitante. Ele vai inteiro para o log do servidor, que é onde tem
   * utilidade e onde o acesso é controlado.
   */
  return (
    'Não foi possível iniciar o pagamento. O erro foi registrado no log do servidor. ' +
    'Se o site acabou de subir, confira DATABASE_URL e PAYMENT_PROVIDER nas configurações do projeto.'
  );
}
