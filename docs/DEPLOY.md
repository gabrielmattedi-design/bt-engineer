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

Estas são as que o código realmente lê. Qualquer outra que apareça num painel é resíduo.

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
| `EMAIL_FROM` | Remetente. Padrão: `Tennis Engineer <nao-responda@tennisengineer.com.br>` |

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

### Opcionais

| Variável | Padrão | Observação |
|---|---|---|
| `PAYMENT_PROVIDER` | `fake` | Apontar para um gateway real desativa o simulado por completo |
| `NEXT_PUBLIC_SITE_URL` | `https://tennisengineer.com.br` | Só para um segundo ambiente com endereço próprio |
| `ANTHROPIC_API_KEY` | — | Melhora a leitura do texto livre. **O produto funciona 100% sem ela**, e nenhuma recomendação depende de IA |

---

## 3. Domínio e DNS

O domínio raiz é o endereço canônico: `tennisengineer.com.br`, sem `www`.

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

1. Vercel: adicionar `www.tennisengineer.com.br` como **Redirect to Another Domain** →
   `tennisengineer.com.br`, com **308 Permanent Redirect**
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
