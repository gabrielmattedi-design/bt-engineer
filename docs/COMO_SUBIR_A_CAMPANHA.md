# COMO_SUBIR_A_CAMPANHA.md — passo a passo

> Companheiro do `TRAFEGO_PAGO.md`. Lá está **por que** cada decisão foi tomada; aqui está **onde
> clicar**. Escrito para quem nunca abriu o Gerenciador de Anúncios.
>
> **Aviso honesto:** o Meta renomeia e reorganiza esses menus com frequência. Os nomes abaixo são os
> de setembro de 2026. Se um botão não estiver com o nome exato, procure pelo que faz a mesma coisa
> — a estrutura (campanha → conjunto → anúncio) não muda.

---

## Parte 0 — Criar o portfólio empresarial do Tennis Engineer

> **Esta parte foi escrita depois, em 08/09/2026, porque a Parte 1 original assumia que o negócio já
> existia no Meta.** O dono abriu o Gerenciador e caiu numa tela de escolha de "ativo de negócios"
> com dois portfólios de OUTROS negócios dele e a conta pessoal — e nenhum Tennis Engineer.
>
> A confusão é razoável e vale nomear: **aquela tela não lista o que existe do seu produto, ela
> pergunta debaixo de qual negócio você quer criar as coisas.** O Tennis Engineer não aparece
> porque ninguém criou. Não há nada quebrado.

**Onde:** `business.facebook.com`

1. Na tela de escolha, clique em **"Criar um portfólio empresarial"** (canto inferior esquerdo).
2. Nome: `Tennis Engineer`. Seu nome e seu e-mail de trabalho.
3. Dentro do portfólio novo, vá em **Configurações** (engrenagem) → **Contas**, e faça os três na
   ordem abaixo. Cada um é um item do menu da esquerda.

#### 3.1 Contas do Instagram

`+ Adicionar` → entrar com o login do Instagram do Tennis Engineer.

#### 3.2 Páginas

`+ Adicionar` abre um menu de três opções, e **duas delas causam problema**:

| Opção | O que faz | |
|---|---|---|
| **Adicionar uma Página** | traz para o portfólio a Página que você já criou | ✅ |
| Solicitar acesso a uma Página | pede permissão ao dono — você pediria a você mesmo | ❌ |
| Criar uma nova Página | cria uma **segunda** Página com o mesmo nome | ❌ o erro mais comum |

Como a Página foi criada pelo seu perfil pessoal, ela aparece na busca e entra sem aprovação de
ninguém. **Isso transfere a POSSE da Página para o portfólio** — é o que se quer aqui, mas não é um
vínculo solto e desfazer é trabalhoso.

#### 3.3 Contas de anúncios

`+ Adicionar` → **Criar uma nova conta de anúncios**.

| Campo | Valor |
|---|---|
| Nome | `Tennis Engineer` |
| Fuso horário | `América/São_Paulo (Brasília)` |
| Moeda | `BRL` |

> ⚠️ **Fuso e moeda não podem ser alterados depois da criação.** Uma conta em fuso errado reporta
> "gasto de ontem" com um recorte de dia que não é o seu, e o número nunca bate com o do
> `/admin/funil`. Conferir aqui custa dez segundos; corrigir depois exige criar outra conta e perder
> o histórico.

Adicione a forma de pagamento nessa mesma tela.

### ⚠️ A Página do Facebook — confirmado em 08/09: não existia

Para anunciar no Instagram, o Meta em geral exige uma **Página do Facebook** vinculada, mesmo que
você nunca vá publicar nada nela. O Tennis Engineer não tinha, e é o bloqueio mais comum de quem só
mantém Instagram.

**Onde:** `facebook.com/pages/create`

| Campo | O que por |
|---|---|
| Nome da Página | `Tennis Engineer` — **igual ao Instagram**, sem variação |
| Categoria | `Produto/serviço` (ou `Site de esportes`) |
| Bio | `Seu jogo. Seu setup. Sob medida.` |
| Site | `<dominio>` |
| Foto de perfil | `fb-perfil.png` — 1024×1024 |
| Capa | `fb-capa.png` — 1640×856 |

Depois de criar: **Configurações da Página → Contas vinculadas → conectar o Instagram.**

**Sobre as imagens.** A logo do produto é um componente React (`components/marketing/logo.tsx`), não
um arquivo — então não havia nada para subir. As duas imagens foram geradas extraindo o SVG do
monograma do próprio site em execução e compondo sobre o verde da marca. Não foram redesenhadas, e
por isso não divergem do que está no ar. Se precisar refazer, o caminho é esse: renderizar o site e
capturar `svg[aria-label="Tennis Engineer"]`.

O brand book manda a marca ser aplicada só em preto ou branco (nunca colorida) — as duas peças usam
branco sobre o `court #0E3D2E`, que é aplicação de fundo e não coloração da marca.

**Uma ressalva:** a Página nasce vazia, e uma Página sem nenhuma publicação às vezes chama revisão
do Meta na primeira campanha. Vale publicar duas ou três coisas nela antes — pode ser o mesmo
conteúdo do Instagram. Não precisa manter depois.

### E se o Instagram não for conta profissional

Para anunciar, o Instagram precisa ser **Conta Comercial** ou **Criador de Conteúdo**, não pessoal.
No app: Configurações → Tipo de conta e ferramentas → Mudar para conta profissional. É gratuito e
não muda nada para quem já te segue.

### Por que um portfólio novo, e não os que já existem

Você já tem "Lupo Aracruz" e "Porquês do Mercado". **Não coloque o Tennis Engineer dentro deles.**
Pixel, conta de anúncios e página ficam amarrados ao portfólio, e misturar negócios diferentes cria
uma bagunça que só aparece quando você quiser separar — dar acesso a alguém, vender, encerrar um.
Dois minutos agora evitam isso.

**Um risco real a conhecer:** conta de anúncios recém-criada não tem histórico, e o Meta às vezes
limita ou revisa a primeira entrega. Se a conta nova travar, use a sua conta pessoal
(`890049998322150`) só para este teste de R$ 490 — é um teste, não uma estrutura definitiva. Não
faça o contrário (mover a conta pessoal para dentro do portfólio): essa mudança é difícil de
desfazer.

---

## Parte 1 — Criar o pixel

**Onde:** `business.facebook.com/events_manager`

> ### ⚠️ "Pixel" agora se chama "conjunto de dados"
>
> O Meta renomeou, e a palavra "pixel" quase sumiu da interface. **Criar um conjunto de dados É
> criar o pixel** — não são coisas diferentes, e não existe um botão "criar pixel" para procurar.
>
> Foi o que travou o dono em 08/09: ele chegou na tela certa, viu "Conjuntos de dados e pixels" e
> não reconheceu que era ali.

Dois caminhos chegam no mesmo lugar. O segundo é o que você já tem aberto se veio das Configurações:

**Caminho A — pelo Gerenciador de Eventos:** `business.facebook.com/events_manager` →
**"Conectar fontes de dados"** → **"Web"** → **"Conectar"**.

**Caminho B — pelas Configurações do portfólio:** **Fontes de dados** → **Conjuntos de dados e
pixels** → botão **`+ Adicionar`**.

Depois, nos dois:

1. Confira no alto da tela que você está **dentro do portfólio Tennis Engineer** — não na conta
   pessoal nem em outro negócio. É onde erra quem tem mais de um, e um pixel no portfólio errado só
   se revela quando a campanha não otimiza.
2. Nome: `Tennis Engineer — site`.
3. A caixa **"Adicione a API de Conversões..."** vem marcada. **Deixe marcada.** Ela não liga nada
   sozinha — só habilita o conjunto a receber eventos de servidor, e quem teria de enviar é o nosso
   servidor, que hoje não envia (ver `TRAFEGO_PAGO.md` §5-bis). Marcar não expõe nada e deixa
   pronto para quando valer a pena construir.

   > O **"17,8% de redução no custo por resultado"** que ele exibe ali é de anunciantes que
   > implementaram a API de verdade. Marcar a caixa sozinha entrega exatamente zero disso.

4. **"Selecione qualquer categoria aplicável": deixe em branco.** O campo é para categorias
   reguladas — saúde, crédito, emprego, habitação, questões sociais. Recomendação de raquete não é
   nenhuma delas.

   > ⚠️ **Mas repare no motivo.** O questionário pergunta sobre dor no cotovelo e sensibilidade no
   > braço, o que É dado de saúde. O campo fica em branco porque **esse dado nunca chega ao Meta** —
   > o pixel manda só "visitou uma página" e "começou o questionário", sem nenhum parâmetro sobre a
   > pessoa. Se um dia alguém enriquecer os eventos com as respostas, esta resposta muda e a conta
   > de anúncios passa a correr risco. `tests/ethics/consentimento.test.ts` impede isso proibindo o
   > módulo do pixel de importar perfil, respostas ou resultado.

5. Se ele oferecer método de instalação, escolha **"Instalar código manualmente"** — ou feche. **Não
   copie o código que ele mostra**: ele já está no site, e colar de novo faria o pixel disparar
   duas vezes por página.
6. **Copie o ID**, ~15 dígitos. Ele aparece na listagem logo abaixo do nome do conjunto; se não
   aparecer, clique no conjunto e ele fica no topo da tela de detalhes.

> Se ele insistir em verificar a instalação, pule. O pixel só vai responder depois da Parte 2 — o
> site ainda não sabe o número.

---

## Parte 2 — Ligar o pixel no site

**Onde:** `vercel.com`

1. Entre e abra o projeto do Tennis Engineer.
2. Menu de cima: **Settings** → menu da esquerda: **Environment Variables**.
3. Clique em **Add New** e preencha:

   | Campo | O que por |
   |---|---|
   | Key (nome) | `NEXT_PUBLIC_META_PIXEL_ID` |
   | Value (valor) | o número que você copiou na Parte 1 |
   | Environments | deixe as três marcadas |

4. **Save**.

> ### ⚠️ A Vercel vai avisar "Keep This Value Private"
>
> Ela mostra isso para **qualquer** variável `NEXT_PUBLIC_`, sem olhar o conteúdo. Aqui está tudo
> certo: expor é o ponto. O pixel roda no navegador, então o id precisa chegar lá — e ele não é
> segredo, fica visível no HTML de todo site que anuncia. O que seria segredo é o token da API de
> Conversões, que não usamos.
>
> **Não aceite a sugestão "Remove the prefix".** Sem o `NEXT_PUBLIC_`, o Next não entrega o valor ao
> navegador, `pixelConfigurado()` passa a devolver `false` e o pixel não carrega — **sem erro, sem
> log, sem nada quebrado na tela**. O sintoma só apareceria semanas depois, na campanha que não
> otimiza. O nome tem de ser exatamente `NEXT_PUBLIC_META_PIXEL_ID`.
>
> O botão "Change to Config" é só uma classificação para ela parar de avisar. Clicar ou ignorar dá
> no mesmo.
5. **⚠️ Agora o passo que quase todo mundo esquece:** variável nova só vale depois de um novo
   deploy. Vá em **Deployments**, ache o mais recente no topo, clique nos três pontinhos (`···`) e
   escolha **Redeploy**.

   > **Desmarque "Use existing Build Cache".** Com o cache ligado a Vercel pode reaproveitar o
   > pacote anterior — o mesmo que não tem a variável — e o problema se repete com a aparência de
   > ter sido refeito.

6. Espere terminar (uns 2 minutos).

### ⚠️ A ORDEM importa, e foi o que travou o dono por uma hora

`NEXT_PUBLIC_*` é embutido no pacote no momento da **compilação**, não lido em tempo de execução.
Então a sequência tem de ser, nesta ordem:

```
salvar a variável   →   DEPOIS   →   deploy
```

O que aconteceu em 08/09 foi o contrário: os deploys estavam com "4m ago" e a variável com "Added
just now". O pacote em produção tinha sido compilado antes de a variável existir, carregava string
vazia, e `pixelConfigurado()` devolvia `false` — o script nunca era injetado.

**O sintoma é indistinguível de um pixel quebrado:** nenhum erro, nenhum log, o site inteiro
funcionando, e zero eventos no Gerenciador. Foram descartadas nesta ordem, todas erradas: CSP
bloqueando o script, bloqueador de anúncio, ferramenta de teste do Meta, `www` no endereço. A causa
era a diferença de quatro minutos entre dois carimbos de hora na mesma tela.

Antes de procurar defeito em qualquer outro lugar, **compare o horário da variável com o do último
deploy.** Se a variável for mais nova, é isso — e nada mais precisa ser investigado.

**Enquanto essa variável estiver vazia, o pixel fica desligado** — inclusive para quem aceitar o
banner. É de propósito: o padrão seguro é não rastrear.

---

## Parte 3 — Conferir que funcionou

1. No Chrome, instale a extensão **Meta Pixel Helper** (busque por esse nome na Chrome Web Store).
2. Abra `<dominio>` **numa aba anônima** (para o banner aparecer do zero).
3. Clique em **Aceitar** no banner de cookies.
4. Clique no ícone da extensão. Deve aparecer o seu pixel e o evento **PageView**.
5. Comece o questionário. Volte na extensão: agora deve aparecer também **Lead**.

**Se não aparecer nada:** o mais provável é que faltou o redeploy do passo 5 da Parte 2. O segundo
mais provável é bloqueador de anúncio ligado no seu navegador.

**Teste também a recusa**, que é o que precisa funcionar de verdade: abra outra aba anônima, clique
em **Recusar**, e confira na extensão que **nada** é carregado.

---

## Parte 3-bis — Conferir o evento de COMPRA

Esta parte não existia no plano original: ela nasceu quando a otimização mudou de `Lead` para
`Compra` (ver 4.2). Sem ela, a campanha otimizaria por um evento não verificado.

**O que se está provando aqui não é que o evento dispara — é que ele dispara UMA vez.** Contar a
mesma venda duas vezes dobra o retorno aparente, e ninguém investiga um número que veio bom.

1. Aba anônima, **Aceitar** o banner. Console (F12) → **Network** → filtro `tr/?`.
2. Questionário + pagamento com cartão de teste do Mercado Pago.
3. Na volta, deve surgir **um** `tr/?id=<pixel>&ev=Purchase` com **status 200**.
4. O `?compra=1` deve **sumir sozinho** da barra de endereço, sem recarregar.
5. Em **Payload**, conferir `cd[value]` com o valor real e `cd[currency]=BRL`.
6. **F5 na página do relatório: não pode aparecer outro `Purchase`.**
7. Fechar a aba e reabrir o link do relatório: também não pode.

> **Passou em 08/09/2026.** `Purchase` com 200 no retorno do pagamento; F5 devolveu só `PageView`.
> As duas travas — o parâmetro na URL e a marca no `localStorage` — funcionam em produção.

**Observação sobre o valor:** o código não envia evento sem valor legível
(`purchase-pixel.tsx`: `if (valorEmReais === null || valorEmReais <= 0) return`). Então um `Purchase`
que aparece já é, por construção, um evento com valor positivo. A alternativa — mandar zero ou o
ticket médio — envenenaria a única conta que decide escalar.

---

## Parte 3-ter — Desligar o que o Meta liga sozinho

**Onde:** Gerenciador de Eventos → seu pixel → **Configurações**

Desative **"Incluir automaticamente informações mais detalhadas de páginas e produtos"** e qualquer
detecção automática de eventos que houver ali.

**Por quê.** O recurso "usa IA para identificar e enviar mais detalhes do site, como informações
básicas da página, avaliações e preços" — ou seja, o Meta lê a página e manda o que achar relevante,
sem passar pelo nosso código.

Isso quebra por fora uma garantia que o projeto sustenta por dentro: `src/lib/meta-pixel.ts` diz que
os eventos daqui carregam **apenas constantes escritas naquele arquivo**, e
`tests/ethics/consentimento.test.ts` proíbe estruturalmente que o módulo do pixel importe perfil,
respostas ou resultado. O motivo é concreto — uma das perguntas do questionário é sobre **dor no
cotovelo**, que é dado de saúde. Nenhum teste nosso impede uma IA da Meta de raspar a página; a
única trava disponível para esse caminho é o botão desligado.

A detecção automática de eventos tem ainda um efeito prático: ela inventa eventos a partir de
cliques em botões — foi a origem provável dos `Subscribe` fantasmas vistos em 08/09, com o botão de
plano virando "assinatura" na cabeça do detector.

Desligar não afeta `PageView`, `Lead` nem `Purchase`: os três são explícitos no nosso código.

---

## Parte 4 — Criar a campanha

**Onde:** `adsmanager.facebook.com`

### 4.1 A campanha

1. Botão verde **"+ Criar"**.
2. Objetivo: **Vendas**. (Não é "Tráfego" — tráfego compra cliques, e cliques são baratos justamente
   porque não valem nada.)
3. Nome da campanha: `teste-set-01`
4. **Tipo de compra: Leilão** — não "Reserva".
5. **Anúncios de catálogo Advantage+: DESATIVADO.** Ver abaixo.
6. **Orçamento: tanto faz** — R$ 70/dia, na campanha ou no conjunto. Ver abaixo.
7. **Estratégia de lance: Volume mais alto.** É a que manda o Meta buscar o máximo de conversões
   dentro da verba.
8. Continuar.

> **Anúncios de catálogo Advantage+ tem de ficar desativado.** Não há catálogo de produtos aqui, e
> ligá-lo mandaria informação de página e preço para a Meta por fora do nosso código — exatamente o
> que a Parte 3-ter desliga, e pelo mesmo motivo.

> ### ⚠️ Sobre o CBO, esta linha dizia "DESLIGADO" e afirmava mais do que os fatos permitem
>
> O orçamento de campanha (CBO) só importa quando há **mais de um conjunto**, porque aí é ele que
> decide sozinho qual conjunto leva a verba. Este plano tem **um conjunto só**, com os 4 anúncios
> dentro: com um conjunto, campanha e conjunto dão no mesmo, e os R$ 70 vão para o mesmo lugar.
>
> Então deixe onde o Meta já colocou e siga. A única consequência prática é que, com o orçamento na
> campanha, o campo não reaparece dentro do conjunto — **o período de 7 dias continua sendo definido
> lá**, na programação.
>
> Isto passa a importar no dia em que houver um segundo conjunto: aí o CBO divide a verba entre os
> dois por conta própria, e a escolha volta a ser uma decisão.

> **O "gasto diário máximo" maior que o orçamento não é erro.** Com R$ 70/dia o Meta anuncia um teto
> diário de R$ 122,50 e um teto semanal de R$ 490. Ele gasta mais nos dias em que encontra
> oportunidade boa e menos nos outros, respeitando o total da semana. Ver R$ 100 num dia é normal e
> não é motivo para mexer em nada — e mexer reinicia o aprendizado.

> **Por que Leilão e não Reserva.** Reserva (Alcance e Frequência) é outro produto: compra um número
> garantido de impressões, com CPM fixo, contratado com antecedência. Serve para campanha de marca.
>
> Ela **não otimiza por conversão** — entrega impressões, não procura quem compra —, então todo o
> trabalho de fazer o `Purchase` disparar direito não teria onde ser usado. E como a entrega é fixada
> na hora da compra, ela também não aprende: o teste de 4 criativos depende exatamente do contrário,
> do algoritmo concentrar a verba no que responde. O piso de verba, ainda por cima, costuma ficar bem
> acima de R$ 490.

### 4.2 O conjunto de anúncios

| Campo | O que escolher | Por quê |
|---|---|---|
| Nome | `teste-criativo` | — |
| Local de conversão | **Site** | — |
| Evento de conversão | **Compra** | ver abaixo — esta linha mudou em 08/09 |
| Orçamento | **Diário, R$ 70** | não aparece aqui se já estiver na campanha — ver 4.1 |
| Programação | começa amanhã, termina em 7 dias | — |
| Público — Local | Brasil | — |
| Público — Idade | 25 a 55 | — |
| Público — Detalhamento | **Tênis** (interesse) | e só isso |
| Advantage+ / público avançado | pode deixar ligado | dá espaço para o algoritmo achar quem responde |
| Posicionamentos | **Automático** | — |

> ### ⚠️ Esta escolha era "Lead" até 08/09, e foi trocada
>
> O argumento antigo estava escrito aqui: o Meta precisa de ~50 conversões por semana para aprender,
> e não há verba para 50 compras semanais — então otimizar por `Lead`, que acontece muito mais vezes.
>
> **O que derrubou o argumento foi o nosso próprio funil.** 84% de quem abre o questionário termina.
> Ou seja, `Lead` é praticamente "clicou no anúncio e não fechou a aba" — ele não separa quem compra
> de quem não compra. Um evento de otimização só serve se DISCRIMINA. Treinar o Meta por um evento
> que quase todo mundo dispara é pedir que ele ache gente que clica em anúncio, e ele é ótimo nisso:
> o custo por `Lead` ficaria excelente, a receita não viria, e todas as métricas da campanha
> pareceriam boas.
>
> **O preço da troca, dito por inteiro:** com `Compra` a campanha fica em *aprendizado limitado* o
> tempo todo (~10 a 30 compras/semana contra as 50 do limiar). Limitado não é quebrado, mas é real.
>
> **Por isso R$ 70/dia × 7 dias, e não R$ 35 × 14** — mesma verba. A fase de aprendizado conta 50
> conversões numa **janela de 7 dias**, não 50 no total. Espalhar em 14 dias garante nunca chegar
> perto. Custa tempo de respiro para o teste de criativo; com otimização por compra, vale.
>
> **Gatilho de desistência, escrito antes de começar:** menos de **60 cliques nos primeiros 3 dias**
> significa que a entrega colapsou por falta de sinal. Aí troca para `Lead` e aceita o teste mais
> fraco. Trocar reinicia o aprendizado, então é decisão de uma vez só — não de ficar alternando.
>
> Raciocínio completo, com os números: `docs/TRAFEGO_PAGO.md` §5.
>
> **Pré-requisito que não é óbvio:** o evento `Purchase` não existia no código até 08/09 —
> `metaCompra` estava escrito e nunca era chamado. Otimizar por compra teria sido otimizar por um
> evento que nunca dispara. Antes de escolher "Compra" aqui, o teste da Parte 3-bis tem que ter
> passado.

### 4.3 Os anúncios

Crie **todos dentro do MESMO conjunto**. Criar um conjunto por criativo é o erro caro: eles passam a
disputar o mesmo público, encarecem o leilão entre si, e a verba se divide à força.

#### Não é preciso publicar nada no feed

O Meta oferece duas origens para a mídia do anúncio:

| | O que faz |
|---|---|
| **Criar anúncio** (padrão) | você sobe a mídia ali. Ela roda como anúncio e **nunca aparece no seu perfil** |
| Usar publicação existente | impulsiona um post que já está no feed; curtidas e comentários acumulam nele |

**Use a primeira.** Isso é o "dark post", e é o que permite adaptar um criativo especificamente para
a campanha — trocar um CTA, cortar uma versão mais curta — sem poluir o feed com variações que só
existem para o anúncio. A prova social que a segunda acumula só passa a valer com volume que esta
campanha não tem.

#### Quantos, e por que 4 e não 2

A primeira versão deste guia mandava rodar 2, com a conta de que 4 anúncios dariam ~150 cliques cada
contra ~300 de dois. **A conta estava errada**: ela pressupunha divisão igual da verba, e o Meta não
divide igual — dentro de um conjunto único ele concentra a entrega em um ou dois nos primeiros dias
e praticamente para de servir o resto.

Então a escolha real não é entre 150 e 300 cliques por peça; é entre dar ao algoritmo 2 ou 4 opções
para achar o vencedor. Com 4 ele acha mais rápido, os perdedores param sozinhos e custam quase nada,
e as peças já estão produzidas — deixá-las de fora não economiza dinheiro, só informação.

#### O critério para uma peça ENTRAR

Não é "vender ou não vender". É:

> **Todo criativo tem de apontar para o mesmo lugar que a campanha mede.**

O caso que criou esta regra: havia um vídeo de 6s terminando em *"leia a legenda"*. Ele manda a
pessoa para DENTRO do Instagram; a campanha otimiza por alguém que SAI do Instagram e começa o
questionário. São direções opostas no mesmo anúncio — o Meta serviria, ninguém clicaria, o custo por
conversão explodiria e o algoritmo o mataria em dois dias, ao custo de uns R$ 30 para descobrir algo
previsível.

A peça não era ruim: 6 segundos é ótimo formato para Reels. **Estava a uma frase de servir** — trocar
"leia a legenda" por "descubra a sua no link". Criativo de engajamento tem lugar no orgânico, onde
engajamento é a moeda; em pago você compra uma ação específica, e quem pede outra ação está
comprando a coisa errada com o seu dinheiro.

#### Retenção de vídeo não é o critério aqui

O vídeo institucional de 30s tinha ~5s de tempo médio de visualização no orgânico. Isso parece
reprovação e não é, por dois motivos:

- **a campanha compra clique, não visualização.** Se o gancho está entregue nos primeiros 5
  segundos, 5 segundos de média significam que a mensagem chegou inteira;
- **orgânico e pago entregam para públicos diferentes** — a retenção medida com seguidores não
  transfere para tráfego frio.

O sinal que sobra é outro, e esse é real: a parte mais valiosa do vídeo — a demonstração do
questionário — quase ninguém está vendo. A saída não é descartar o vídeo, é **cortar uma versão de
10 a 15 segundos** com gancho + relance da demonstração + CTA. Como não é preciso publicar nada,
cortar variações custa só o tempo de edição.

Os quatro são iguais em tudo — formato conforme a mídia, chamada para ação **Saiba mais**, texto e
título vindos da pauta — e diferem **só no `utm_content` da URL**:

| Anúncio | Formato | `utm_content` |
|---|---|---|
| 1 — reel dos 3 erros | vídeo único | `reel-3-erros` |
| 2 — vídeo de 30s, mostra a plataforma e o relatório | vídeo único | `reel-30s` |
| 3 — estático da posição 4,7 | imagem única | `estatico-4-7` |
| 4 — estático do preço | imagem única | `estatico-preco` |

A URL de cada um, trocando só a última palavra:

```
https://<dominio>/?utm_source=meta&utm_medium=cpc&utm_campaign=teste-set-01&utm_content=reel-3-erros
```

> ⚠️ **O `utm_content` diferente em cada um é o que faz o teste existir.** Se dois anúncios tiverem
> a mesma URL, eles viram uma linha só na coluna "Criativo" do `/admin/funil` e não há como saber
> qual funcionou. É o único passo desta lista que, se você errar, não dá para consertar depois — o
> dado do clique só existe no instante do clique.

### 4.4 Antes de publicar: o teste das quatro URLs

É a única conferência que testa a coisa sem conserto. `estatico-4-7` e `estatico-47` parecem iguais
numa olhada e produzem linhas diferentes — e o dado do clique só existe no instante do clique.

Para **cada** uma das quatro URLs:

1. **Janela anônima nova** — uma por URL. A atribuição é de primeiro toque, com cookie de 30 dias:
   na mesma janela, as quatro visitas seriam creditadas só à primeira.
2. Cole a URL do campo de destino do anúncio (copie, não redigite) e abra.
3. **Comece o questionário** e responda a primeira tela.
4. Feche a janela inteira.

> ⚠️ **O passo 3 não é opcional, e foi onde este teste falhou na primeira vez.** Visitar a home com
> o link só grava um cookie no navegador; a linha no banco nasce na etapa 0 do questionário
> (`funnel-actions.ts`, `if (stepIndex === 0) await recordVisitorCampaign(token)`). Abrir as quatro
> URLs e parar na home não produz linha nenhuma — o que parece "a medição está quebrada" e não é.

Depois abra `/admin/funil` → **"De onde vieram"**. Têm de aparecer **quatro linhas** com
`meta` / `teste-set-01` / os quatro criativos.

- Menos de quatro linhas → dois anúncios estão com a mesma URL.
- Coluna Criativo vazia (`—`) → faltou o `utm_content` em alguma.
- Nenhuma linha → faltou o `utm_source`: sem ele o middleware não grava nada (`middleware.ts:58`).

Some 4 ao "Abriu o questionário" do funil geral. É ruído seu, e dilui assim que a campanha rodar.

### 4.5 Publicar

Revise e publique. O Meta leva algumas horas para aprovar.

---

## Parte 5 — Depois de ligar

> **A partir daqui o assunto muda de arquivo.** Este documento vai até o primeiro gatilho do dia 3.
> Operar uma campanha que já está rodando — orçamento, fase de aprendizado, leitura de número,
> quando NÃO mexer — está em **`OPERACAO_DA_CAMPANHA.md`**, escrito durante a campanha de setembro
> e quase todo derivado de erro cometido ao vivo.

### Os primeiros 3 dias: não toque em nada

Qualquer alteração — orçamento, público, criativo, texto — **reinicia a fase de aprendizado**, e uma
campanha de 7 dias não tem tempo para reaprender. A vontade de mexer no dia 2 é o erro mais caro que
existe em campanha pequena.

Se o resultado do dia 1 parecer horrível, é normal. O algoritmo está explorando — e com otimização
por compra ele explora mais, porque tem menos exemplos.

### ⚠️ Entrega zero no dia 1 — o caso de 09/09/2026, e a coluna que resolvia em 5 segundos

Às 07:31 do primeiro dia, com início às 00:00, o aplicativo mostrava tudo **"Ativo"** nos três níveis
e **Alcance 0 · Impressões — · R$ 0,00**.

**A resposta estava numa coluna que o aplicativo do celular não mostra.** No computador, a coluna
**Veiculação** dizia:

> **Preparando para veicular.** Todos os anúncios nesta campanha passaram com sucesso pela análise.
> Agora, nosso sistema de veiculação está fazendo a correspondência deles com o lance e o público
> certos. *Normalmente 2 horas, mas pode levar até 12 horas.*

**"Ativo" e "Veiculação" são coisas diferentes.** "Ativo" é o estado do INTERRUPTOR — você ligou.
"Veiculação" é o estado da ENTREGA, e tem pelo menos três valores que produzem zero impressão:
`Em análise`, `Preparando` e `Ativo`-mas-sem-leilão. O aplicativo mostra o primeiro; só o desktop
mostra o segundo.

> **Antes de investigar qualquer coisa, abra o `adsmanager.facebook.com` NO COMPUTADOR e leia a
> coluna Veiculação.** Se disser "Preparando", não há nada a fazer além de esperar até 12 horas a
> contar do horário de início. Foi o que aconteceu aqui, e custou uma manhã de investigação de seis
> itens que estavam todos certos.

**A conclusão que este documento chegou a afirmar — "zero impressão é bloqueio, não lentidão" — está
errada** e ficou registrada aqui de propósito: existe um terceiro estado, e ele é o mais comum no
primeiro dia de uma conta nova.

#### Se a coluna Veiculação NÃO disser "Preparando"

Aí sim vale a investigação, nesta ordem — todas passaram em 09/09, e é justamente por isso que valem
estar escritas: elimina-se o verificável antes de recorrer a palpite.

| # | Onde | O que tem de aparecer |
|---|---|---|
| 1 | Filtro de data do painel | **"Hoje"**. Ele guarda a janela anterior entre visitas e mostra R$ 0,00 de uma campanha que está rodando — já custou tempo duas vezes neste projeto |
| 2 | Os três interruptores | Campanha, conjunto **e** anúncio. Anúncio "Ativo" sob conjunto pausado não entrega, e o painel não avisa |
| 3 | `adsmanager.facebook.com/ads/manage/billing` | "Conta ativa" + forma de pagamento cadastrada. Sem cobrança válida a conta bloqueia a entrega **sem marcar nada de vermelho no anúncio** |
| 4 | `business.facebook.com/accountquality` | "Nenhum problema com a conta ou ativo" |
| 5 | `business.facebook.com/settings/pixels` → Ativos conectados | A conta de anúncios precisa estar conectada ao pixel — mesma ligação ativo-com-ativo que faltou no Instagram na véspera |
| 6 | Conjunto → Editar → Programação | A data de início. Se for amanhã, o "Ativo" é só a campanha esperando, e não há nada errado |

**Se as seis passarem e já tiverem se passado mais de 12 horas do início**, o que sobra não é
constatação, é julgamento: a otimização por **Compra** num pixel com **um** evento de compra. Sem
exemplos, o Meta não monta público inicial, e conta nova não tem histórico próprio para compensar.

**A ação é puxar o gatilho da seção seguinte mais cedo**, trocando o evento para `Lead`
(134 eventos no histórico contra 1 de compra). Sem gasto e sem entrega, **não há aprendizado para
reiniciar** — a regra dos 3 dias só passa a valer quando a campanha efetivamente roda, então a troca
sai de graça.

⚠️ **Espere a janela das 12 horas fechar com folga antes de trocar.** Agir na borda do prazo que o
próprio Meta anuncia é matar a campanha no minuto em que ela ia começar — e a troca reinicia o
aprendizado, então não é uma decisão de ida e volta.

Se mesmo com `Lead` a entrega continuar zerada depois de uma ou duas horas, não é o evento: é algo
estrutural, e o caminho é o suporte — em Qualidade da Conta, **"Resolva meus problemas de veiculação
de anúncio"**.

### No dia 3: o único gatilho

**Menos de 60 cliques acumulados** significa que a entrega colapsou por falta de sinal de conversão.
Aí, e só aí, troque o evento do conjunto para **Lead** e aceite um teste mais fraco.

> Este gatilho foi escrito prevendo entrega *fraca*. Entrega **zero** no dia 1 é a mesma falha em
> forma mais grave, e antecipa a troca — ver a seção acima.

É decisão de uma vez só: trocar reinicia o aprendizado, então alternar entre os dois eventos garante
nunca sair da exploração. Com 60 cliques ou mais, deixe como está mesmo que ainda não haja compras.

### A partir do dia 7

Abra `<dominio>/admin/funil`, janela de 7 dias, e olhe a tabela de baixo — a que tem a
coluna **Criativo**. Anote por criativo:

- **Chegaram** — ⚠️ **não são visitantes: é quem ABRIU o questionário.** A linha de origem só nasce
  na etapa 0 do questionário (`funnel-actions.ts`, `if (stepIndex === 0)`); visitar a home com o
  link só grava um cookie no navegador. Quem clica no anúncio e sai da home é invisível nesta
  tabela — e um criativo que traga 100 cliques sem nenhuma abertura não aparece aqui de forma
  alguma, o que se leria erradamente como "não trouxe ninguém".

  Isso dá de graça o melhor diagnóstico da campanha: **cliques do Meta ÷ Chegaram**. Se o Meta
  marcar 300 cliques e a tabela mostrar 60, o problema é a home, não o criativo — e nenhum ajuste
  de campanha conserta isso.
- **Terminaram** (o questionário)
- **Pagaram**

E no Gerenciador de Anúncios, anote o **valor gasto por anúncio**.

Com esses dois lados dá para fechar a conta que decide:

```
CAC  =  valor gasto  ÷  compras
```

**Teto: R$ 45,60** — o líquido por venda (`TRAFEGO_PAGO.md` §3). Abaixo disso a campanha se paga.

O **custo por início** (`valor gasto ÷ chegaram`, teto R$ 11,08) continua valendo como leitura
secundária: ele separa "o anúncio não traz ninguém" de "traz e não compra", que exigem consertos
diferentes. Mas não é mais o número que decide.

> **Cuidado com o número do Meta contra o nosso.** Quem paga e fecha o navegador antes de voltar do
> gateway não gera evento no pixel — o total do Meta será sempre um pouco MENOR que o nosso. Os
> dois estão certos, contando coisas diferentes.
>
> ⚠️ **Resolvido em 12/09/2026 — e são DOIS divisores, não um.**
>
> O dono leu **5** em "Pagou" no `/admin/funil` e contou **7** em `/admin/vendas`. O extrato do
> Mercado Pago confirmou 7 pagamentos. **Os dois números estavam certos:** ele conferiu os e-mails
> da lista e achou **uma pessoa com 3 compras no mesmo dia** — 7 pedidos, 5 pessoas.
>
> A instrução que estava aqui — "use as compras do `/admin/funil`, que é o registro completo" —
> estava errada de qualquer forma. O funil conta PESSOAS, de propósito: `funnel_markers` tem
> restrição única em (visitante, marco), e é isso que faz a taxa de conversão significar algo.
>
> **A conta certa depende do que se quer decidir:**
>
> | Pergunta | Divisor |
> |---|---|
> | **CAC** — quanto custou trazer um cliente | **pessoas** (5) |
> | Custo por venda | pedidos (7) |
>
> E a consequência que interessa: quando uma pessoa compra duas ou três vezes, a **receita por
> cliente adquirido fica acima do ticket médio**, e o teto do que se pode pagar para trazer um
> cliente sobe junto. Dividir tudo por pedidos esconde exatamente isso — dá um custo por venda
> menor e um teto que parece o de sempre.
>
> **O que o painel agora mostra, e por quê.** Três números: pedidos pagos, pessoas por trás deles,
> e pessoas no funil. Os dois primeiros vêm de `orders`; o terceiro do funil. Se as pessoas por
> trás dos pedidos baterem com o funil, ele está certo e a diferença é segunda compra. Se não
> baterem, o funil perdeu marco — e aí é defeito, com rastro no log
> (`[funil] marco "paid" descartado`).
>
> ─── O ERRO DE MÉTODO, QUE VALE MAIS QUE A CORREÇÃO ───
>
> Eu respondi duas vezes sem olhar dado. Primeiro afirmei que a diferença era cliente recomprando,
> deduzido do código. Depois, diante dos e-mails do Mercado Pago (que eram **5**, porque 2 não
> chegaram), recuei e tratei tudo como insolúvel. As duas respostas eram igualmente inúteis.
>
> O que faltava não era mais dedução: era o terceiro número. **Dois números discordando não se
> resolvem por raciocínio sobre o código** — se resolvem instrumentando a diferença.

### Quando parar

Escrito antes de começar, porque depois de gastar é tarde para ser imparcial:

- **CAC abaixo de R$ 25** → funcionou. Escale devagar (+20% de orçamento por semana, nunca
  dobrando).
- **Entre R$ 25 e R$ 45,60** → funciona, mas apertado. Vale mais consertar o degrau da prévia
  (`TRAFEGO_PAGO.md` §5-bis) do que por mais verba.
- **Acima de R$ 45,60** → tráfego frio não fecha a conta com este funil. A saída não é mais verba: é
  ticket maior, funil mais curto, ou outro canal.
- **Zero compras, mas custo por início abaixo de R$ 5** → o anúncio funciona e o site não converte
  frio. O conserto é no funil, não na campanha.
- **Ninguém inicia o questionário** → o problema é a home, não o anúncio. Pause e conserte antes de
  gastar o resto.

---

## Resumo em uma tela

| # | Onde | O quê |
|---|---|---|
| 0 | business.facebook.com | criar o portfólio **Tennis Engineer**, conectar Instagram + Página do Facebook + conta de anúncios |
| 1 | business.facebook.com/events_manager | **dentro do portfólio novo**: criar o pixel, copiar o número |
| 2 | vercel.com | `NEXT_PUBLIC_META_PIXEL_ID` + **redeploy** |
| 3 | seu site, aba anônima | conferir com o Meta Pixel Helper (aceitar **e** recusar) |
| 3-bis | seu site + Network | compra de teste: **um** `ev=Purchase`, e o F5 **não** repete ✅ 08/09 |
| 3-ter | Gerenciador de Eventos → Configurações | **desligar** os eventos automáticos e a raspagem de página |
| 4 | adsmanager.facebook.com | campanha Vendas → conjunto com evento **Compra**, R$ 70/dia × 7 dias → 4 anúncios com `utm_content` diferente |
| 5 | — | **não mexer por 3 dias** |
| 5-bis | Gerenciador | dia 3: menos de 60 cliques → trocar para `Lead`, uma vez só |
| 6 | /admin/funil + Gerenciador | dia 7: **CAC vs. R$ 45,60** |
