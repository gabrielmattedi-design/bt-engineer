# Publicação

Como o Tennis Engineer vai para o ar, e por que cada peça está onde está.

---

## 1. Onde tudo mora

| Peça | Serviço | Região |
|---|---|---|
| Aplicação | Vercel | `gru1` (São Paulo) |
| Banco | Neon (Postgres) | `sa-east-1` (São Paulo) |
| Domínio | registro.br | — |

### Por que `gru1`, e por que isso importa mais do que parece

A escolha óbvia seria pensar na distância até o visitante: servidor no Brasil responde mais rápido
para quem acessa do Brasil. Verdade, e é o menor dos dois motivos.

O grande é o **banco**. Servir uma análise não é uma consulta só — é gravar o perfil, gravar a
sessão, gravar as 46 linhas de ranking, ler entitlements. Com a função nos EUA e o Postgres em São
Paulo, cada uma dessas idas e voltas atravessa o continente duas vezes. Uma latência de ~120 ms por
consulta se multiplica pelo número de consultas, e o custo aparece justamente na página que a pessoa
acabou de pagar para ver.

Função e banco na mesma região transformam esse trecho em rede local.

A configuração vive em `vercel.json`, e não no painel: assim ela é revisável, versionada, e vai
junto se o projeto for recriado. O plano Hobby permite uma região; se o deploy recusar, o log da
Vercel diz qual é o limite do plano.

---

## 2. Variáveis de ambiente

Estas são as que o código realmente lê. Qualquer outra que apareça num painel é resíduo. A lista
completa e conferível é `VARIAVEIS_DO_PROJETO`, em `src/lib/ambiente.ts`: um teste
(`tests/integrity/configuracao-obrigatoria.test.ts`) falha se o código ler uma variável que não
está nela, ou se ela listar uma que ninguém lê.

> **Este projeto é uma cópia do Tennis Engineer.** Nenhum valor vem de lá — banco, Mercado Pago,
> Resend, pixel, segredos, tudo é novo. E `tennisengineer.com.br` nunca entra aqui, em variável
> nenhuma: o portão de build varre o ambiente inteiro e recusa o deploy se encontrar o domínio
> antigo, o `tennis-engineer.vercel.app` ou a caixa de contato de lá.

### Identidade — sem valor padrão, o build FALHA

| Variável | Formato | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://dominio`, sem barra no fim | Links de acesso, recibos, Open Graph, sitemap, card compartilhado |
| `EMAIL_FROM` | `Nome <nao-responda@dominio>` | Remetente de todo e-mail. O domínio precisa estar verificado no Resend |
| `CONTACT_EMAIL` | `endereco@dominio` | O canal de atendimento, e o destino do descadastro da pesquisa |

Até a cópia, as três tinham padrão — o domínio, o remetente e a caixa do Tennis Engineer. Lá era
conveniência; aqui faria o sistema funcionar normalmente com a identidade de outra operação, sem
erro nenhum. Agora `npm run build` roda `scripts/config-gate.ts` primeiro e lista tudo o que falta
de uma vez; e cada módulo recusa carregar sem a sua, para quem rodar `next build` direto.

`CONTATO_EMAIL` (com O) **deixou de existir**. Era um segundo nome para a caixa de contato, lido só
pelo cron da pesquisa, enquanto o ensaio de `/admin/pesquisa` lia `CONTACT_EMAIL`: o ensaio
mostrava um destino de descadastro e o envio real usava outro. Se aparecer num painel, é resíduo.

### Obrigatórias em produção

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Postgres. **Use a string do POOLER** (tem `-pooler` no host) |
| `ADMIN_PASSWORD` | Painel administrativo. Mínimo 8 caracteres, sem valor padrão |

Sobre a `DATABASE_URL`: cole-a **como o provedor entrega**, inclusive com
`?sslmode=require&channel_binding=require`. O `channel_binding` derrubaria a conexão — é opção de
cliente do libpq, não existe no servidor — e `src/database/client.ts` a remove sozinho. Ver
`tests/integrity/database-url.test.ts`.

### Enquanto o catálogo não estiver conferido

| Variável | Valor | Efeito |
|---|---|---|
| `ALLOW_UNVERIFIED_DATASET` | `true` | **Sem ela o build FALHA.** É a trava que impede vender recomendação com dado não verificado. Com ela, o site exibe faixa permanente de ambiente de testes |

### Como o acesso é liberado (escolha uma)

| Variável | Valor | Efeito |
|---|---|---|
| `INVITE_ONLY` | `true` | Checkout fechado. O relatório nasce só de um código de convite resgatado |
| `ALLOW_FAKE_PAYMENTS` | `true` | Funil aberto com pagamento simulado, e aviso visível de que nada é cobrado |

As duas também existem como interruptor em `/admin/setup`, para não depender de redeploy. O convite
**vence** de tudo: ligado, nenhuma outra chave reabre o checkout.

### Acesso por e-mail (magic link)

| Variável | Para quê |
|---|---|
| `AUTH_SECRET` | Assina o cookie de sessão. **Mínimo 32 caracteres, sem valor padrão** |
| `RESEND_API_KEY` | Envio de e-mail. Sem ela nada é enviado — e a tela DIZ que não enviou |
| `EMAIL_FROM` | Remetente — ver "Identidade", acima. Sem padrão |

Não existe segredo padrão para `AUTH_SECRET`, e isso é deliberado: um padrão estaria no
repositório, ou seja, seria público, e qualquer pessoa forjaria um cookie válido para qualquer
conta. Sem a variável, o login por e-mail simplesmente não funciona — e a tela avisa em vez de
fingir que enviou.

Para gerar um valor, no console do navegador (F12 → Console):

```js
crypto.randomUUID() + crypto.randomUUID()
```

O remetente precisa estar num domínio **verificado no Resend** (registros DKIM e SPF no DNS).
Sem isso o e-mail sai, mas cai em spam — e um link de acesso no spam é um cliente perdido, porque
ninguém procura lá.

### Pesquisa de satisfação (envio automático, 15 dias depois da compra)

| Variável | Para quê |
|---|---|
| `CRON_SECRET` | Autentica o agendamento diário. **Sem ela a rota RECUSA — nada é enviado** |
| `PESQUISA_LIMITE_DIARIO` | Teto de envios por dia. Padrão `15` |

`CRON_SECRET` é o interruptor geral: a Vercel manda `Authorization: Bearer <valor>` nos
agendamentos dela, e `/api/cron/pesquisa` recusa qualquer chamada que não traga esse cabeçalho.
Sem a variável a rota recusa **todo mundo**, inclusive a Vercel — que é a escolha certa para o
inverso: uma rota que libera quando o segredo falta vira um endereço público disparando e-mail
para clientes reais a cada visita.

O valor se gera igual ao `AUTH_SECRET` (`crypto.randomUUID()`), e a Vercel injeta o mesmo valor no
cabeçalho automaticamente quando a variável existe no projeto.

O teto diário existe por entregabilidade, não por custo: um domínio que manda dez e-mails por dia e
de repente manda cento e vinte parece disparo em massa — e a reputação queimada levaria junto a
entrega do **relatório**, que é o produto.

#### Antes de ligar

`/admin/pesquisa` diz na tela se o disparo está ligado ou desligado, e traz o **ensaio**: a prévia
do e-mail exatamente como ele sai, um envio de teste para o endereço que você escolher, e a prévia
do formulário (`/avaliacao/previa`) — nenhum dos três grava coisa alguma nem consome a fila.

O caminho, em ordem: conferir a prévia → mandar o teste para si mesmo → abrir no celular, no
computador e no **modo escuro** → conferir se caiu no spam → percorrer o formulário até o
agradecimento. Só então configurar `CRON_SECRET`.

#### Quem entra na fila de cada dia

Todo dia o agendamento procura pedidos que atendam **todas** estas condições:

| | |
|---|---|
| status | `paid` — pedido pago, confirmado pelo gateway |
| pago há | entre **15 e 45 dias** |
| pesquisa deste pedido | ainda não existe |
| pesquisa desta **pessoa** | nenhuma nos últimos 90 dias |
| quantidade | no máximo o teto do dia (15) |

Pega o e-mail da compra, cria a linha, dispara e grava o desfecho. Os mais antigos primeiro.

Três consequências que valem entender:

- **É uma janela, não um dia exato.** "Exatamente 15 dias" perderia para sempre a safra de qualquer
  dia em que o agendamento falhasse — deploy, instabilidade, limite da Vercel — e ninguém ficaria
  sabendo. Com o intervalo, um dia perdido é recuperado no dia seguinte sozinho.
- **O teto de 45 dias é o fim da fila.** Quem passar disso não recebe mais: perguntar "como foi?"
  sobre uma compra de dois meses atrás tem resposta pior e faz a pessoa se perguntar por que só
  agora. É também o que impede a primeira execução de varrer o histórico inteiro.
- **Uma pesquisa por pessoa por trimestre.** A trava do banco é por pedido, e quem comprou o laudo e
  voltou para o upgrade receberia duas pesquisas quase iguais. A segunda compra não se perde: volta
  a ser candidata quando os 90 dias virarem, ou envelhece para fora da janela.

Depois de ligado, a primeira leva sai no próximo agendamento (9h de Brasília) e alcança de uma vez
todos os pedidos elegíveis dos últimos 45 dias — respeitando o teto diário. Ela é a maior de todas,
e normalmente enche o teto por alguns dias seguidos até a fila acumulada escoar.

#### Como saber o que saiu

`/admin/pesquisa` lista cada envio com a data, o endereço e o desfecho: **aceito**, **recusado** (com
o motivo) ou **sem registro**. Recusados têm um botão de tentar de novo.

Três coisas que essa tela não diz, e é importante não ler nela o que ela não afirma:

- **Aceito não é entregue.** Significa que o Resend recebeu a mensagem — chave válida, remetente
  autorizado, endereço bem formado. Se ela quicou ou caiu no spam do destinatário, isso só chegaria
  por um webhook do Resend, que este projeto não tem.
- **Sem registro não é sucesso.** É linha criada antes destas colunas existirem, ou qualquer caminho
  que tenha gravado sem registrar o desfecho.
- **Só recusa explícita é reenviável.** Um envio "sem registro" pode ter saído, e repeti-lo por via
  das dúvidas manda a mesma pesquisa duas vezes para o mesmo cliente.

O log do cron na Vercel traz o resumo de cada execução (`[pesquisa] fila N, enviados X, falhas Y`),
mas é efêmero — a tela é o registro que fica.

#### Sobre o remetente

A pesquisa sai do **mesmo domínio** dos e-mails transacionais, de propósito. O manual mandaria
separar num subdomínio, para que uma reclamação de spam não contamine a reputação que entrega o
relatório. Nesta escala isso sairia pela culatra: um subdomínio novo começa **sem reputação
nenhuma**, o que entrega pior do que um domínio com histórico — e a pesquisa são 15 mensagens por
dia, no máximo, para gente que comprou há duas semanas. Vale reconsiderar se um dia houver
comunicação recorrente para lista grande.

### Opcionais

| Variável | Padrão | Observação |
|---|---|---|
| `PAYMENT_PROVIDER` | `fake` | Apontar para um gateway real desativa o simulado por completo |
| `ANTHROPIC_API_KEY` | — | Melhora a leitura do texto livre. **O produto funciona 100% sem ela**, e nenhuma recomendação depende de IA |

---

## 3. Domínio e DNS

O domínio raiz é o endereço canônico, sem `www` — e é o mesmo valor de `NEXT_PUBLIC_SITE_URL`.
Abaixo, `<dominio>` é o domínio DESTE produto.

> `tennisengineer.com.br` e `www.tennisengineer.com.br` pertencem ao Tennis Engineer e **nunca**
> são adicionados a este projeto na Vercel. Se forem, a Vercel passa a injetar o domínio em
> `VERCEL_PROJECT_PRODUCTION_URL` e o portão de build recusa o deploy.

### Na Vercel

Projeto → **Settings → Domains** → adicionar o domínio → **Connect to an environment: Production**.

### No registro.br

Mantendo os servidores DNS do próprio registro.br (**DNS → Configurar endereçamento**):

| Registro | Nome | Valor |
|---|---|---|
| `A` | raiz (campo vazio) | o IP que a Vercel indicar |

No modo simples, basta digitar o IP no campo "Endereço do site" — o registro.br cria o `A` na raiz.
O campo de servidor de e-mail fica **vazio** enquanto não houver e-mail no domínio; preenchê-lo
errado cria um MX quebrado que só dá sintoma meses depois.

Use sempre o valor que o painel da Vercel exibir, nunca um copiado de tutorial: eles mudam.

### `www`

Precisa de duas ações, nesta ordem:

1. Vercel: adicionar `www.<dominio>` como **Redirect to Another Domain** →
   `<dominio>`, com **308 Permanent Redirect**
2. registro.br: **MODO AVANÇADO** → um `CNAME` de `www` para o destino que a Vercel indicar

O 308 é permanente e preserva o método HTTP. Um 307 temporário diria aos buscadores que o endereço
canônico ainda pode mudar, e o ranking ficaria dividido entre os dois.

---

## 4. Primeira subida de um banco vazio

Em `/admin/setup`, na ordem:

1. **Criar tabelas** — executa a DDL embutida em `src/database/bootstrap-sql.ts`
2. **Semear produtos** — cria os cinco produtos com os preços

As duas são idempotentes: repetir é inofensivo. `tests/integrity/schema-bootstrap.test.ts` tranca
isso, depois de três defeitos reais que quebravam a segunda execução.

---

## 5. Reputação de domínio novo

Um domínio recém-registrado tem reputação zero, e antivírus de navegação (Kaspersky, Norton,
SmartScreen) marcam o site como não confiável. Com página de preços e fluxo de pagamento, o perfil
"domínio novo + cobrança" bate exatamente com a heurística de phishing.

Não é defeito do site e resolve-se com tempo e tráfego legítimo. Enquanto durar, **visitantes reais
veem o aviso** — vale avisar quem receber o link nesta fase, senão a conclusão natural é que o site
é golpe.

---

## 6. O que falta para poder cobrar

| | Situação |
|---|---|
| Curadoria do catálogo | 46 raquetes e 56 cordas em `pending_verification` — é o bloqueio real |
| Cadastro e login | Não implementado. `users` e `orders.user_id` existem e estão vazios |
| Gateway de pagamento | Não integrado. Hoje só o adapter simulado |
| Plano da Vercel | **Hobby proíbe uso comercial.** Cobrar exige migrar para Pro |

Enquanto `ALLOW_UNVERIFIED_DATASET` estiver ligada, o produto está publicado e **não vende** — que é
o estado correto para esta fase.
