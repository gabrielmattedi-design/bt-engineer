# Proposta — produtos, motor e questionário do Beach Tennis Engineer

Status: **rascunho para decisão do dono** · nenhuma linha de código de domínio escrita ainda.

Quando aprovado, este documento substitui `RECOMMENDATION_ENGINE.md`, `QUESTIONNAIRE.md` e
`STRING_AND_TENSION_ENGINE.md` (que descrevem o motor de tênis, ainda presente no código), e a §1
entra no `MONETIZATION.md`.

O catálogo de partida é `Rascunho_catálogo_bte.xlsx` (35 raquetes, cotação de 08/09/2026), tomado
como verdadeiro nesta fase. A varredura do catálogo vem depois.

---

## 1. Produtos

| SKU | Nome | Preço | Entrega |
|---|---|---|---|
| `racket_report` | Laudo da raquete | R$ 29,99 | a 1ª colocada + veredicto curto sobre a raquete atual |
| `full_report` | Análise completa | R$ 49,99 | as três colocadas, o comparativo entre elas e a avaliação completa da raquete atual |
| `report_upgrade` | Completar a análise | R$ 30,00 | o que o `full_report` tem e o `racket_report` não |

Sai: o setup (corda, espessura, tensão), os desbloqueios avulsos da 2ª e da 3ª (R$ 9,99 cada) e
o `setup_upgrade`. Três produtos: duas portas de entrada e um upgrade.

### 1.1 O veredicto curto está nos dois produtos

"Fique com a sua" ou "troque" aparece também no de R$ 29,99. Sem isso, quem já tem uma raquete
adequada pagaria R$ 29,99 e receberia a indicação de comprar outra — de R$ 329 a R$ 3.799 no
catálogo — sem saber que a dele servia. O veredicto "fique com a sua" nasceu de casos reais no
Tennis Engineer (`c8f02bd`) e não pode ficar atrás de um upgrade.

O que só o de R$ 49,99 tem é o PORQUÊ: onde a sua cai no mapa (§3), o que ganharia e o que perderia
em cada eixo trocando por cada uma das três, e o que vai sentir em quadra.

### 1.2 Quem não tem raquete

A avaliação da atual não aparece na oferta para quem declarou não ter raquete: é a regra "a loja só
oferece o que a pessoa consegue usar" (`597eea3`). Para essa pessoa, o de R$ 49,99 é descrito como
as três raquetes e o comparativo entre elas.

### 1.3 A escada de preço

R$ 29,99 + R$ 30,00 = R$ 59,99, contra R$ 49,99 do pacote: decidir em duas vezes custa R$ 10,01 a
mais. É a mesma escada do Tennis Engineer, onde laudo + upgrade somavam R$ 59,98, e a diferença de
R$ 9,99 foi mantida de propósito como "o preço de decidir em duas vezes, e nada além disso"
(MONETIZATION.md, `setup_upgrade`). O que aquele documento recusa é um prêmio MAIOR: o upgrade
desceu de R$ 39,99 porque ele não aparece na hora da primeira escolha. O editor de preços aceita
os R$ 30,00, porque a regra dele é só que o caminho fatiado não custe menos que o pacote.

---

## 2. O que o catálogo permite medir

Cinco variáveis por raquete entram no motor:

| Variável | Coluna | Como entra |
|---|---|---|
| Dureza do EVA | `nucleo_eva` | ordinal, ver §2.1 |
| Rigidez da face | `fibra_face` | ordinal, ver §2.1 |
| Peso | `peso_min_g`–`peso_max_g` | centro da faixa |
| Balanço | `balanco_min_mm`–`balanco_max_mm` | centro da faixa, mm a partir do cabo |
| Espessura | `espessura_mm` | direto |

`comprimento_mm` fica fora: é 500 em todas, e uma variável que não varia não informa nada.
`nivel_indicado` (do fabricante) entra como sinal auxiliar (§4.3). `perfil_jogo` e
`claim_fabricante` ficam para o texto do relatório, não para a nota.

**Sem textura da face e sem formato, não há eixo de spin nem de formato.** Por isso o questionário
não oferece "quero mais spin". O Tennis Engineer já pagou por um eixo que era pedido e o motor não
calculava (`d1b9c48`): a pessoa marca spin como prioridade 1, o motor não tem como atender, e o
relatório ignora justamente o que ela mais pediu. Quando a textura entrar no catálogo, spin entra
como terceiro eixo.

### 2.1 Escalas — **hipóteses a confirmar pelo dono**

| EVA | valor | | Face | valor |
|---|---|---|---|---|
| extra soft | 0,00 | | fibra de vidro | 0,10 |
| soft | 0,30 | | carbono 3K | 0,45 |
| medium | 0,55 | | carbono 6K | 0,55 |
| pro | 0,55 | | carbono + kevlar | 0,60 |
| hard | 0,85 | | carbono 12K | 0,70 |
| black eva | 0,85 | | carbono 18K | 0,80 |
| | | | carbono 24K | 0,90 |

Duas equivalências são decisão, não leitura:
- `pro` = medium. A única descrição de "EVA pro" no catálogo é a da Drop Shot Quantum: "densidade
  intermediária".
- `black eva` = hard. A Quicksand Kombat descreve "EVA black de alta densidade".

A ordem das faces (mais K = mais rígida) segue o que as marcas afirmam. Se o dono discordar de
alguma posição, é aqui que se muda, e tudo abaixo se recalcula.

---

## 3. O motor em dois eixos

### 3.1 A descoberta que muda o desenho

O primeiro protótipo seguiu o Tennis Engineer: cinco eixos exibidos (potência, controle,
manobrabilidade, conforto, estabilidade), com o mesmo orçamento fixo de atributos (`a3d214f`).
Medido nas 35:

| par | correlação |
|---|---|
| potência × controle | −0,98 |
| conforto × controle | −0,97 |
| potência × conforto | +0,92 |

Potência, controle e conforto são UMA medida, lida de três jeitos. Com EVA, face, peso, balanço e
espessura, o catálogo tem duas dimensões reais, e mostrar cinco seria fingir uma precisão que o dado
não tem. No relatório isso aparece como "a recomendada é ótima em potência e em conforto", o que é
verdade, e "e fraca em controle", o que é a mesma frase dita de novo.

### 3.2 Os dois eixos

```
resposta = 100 · (0,55·EVA + 0,30·face + 0,15·(1 − esp))      esp = norm(espessura, 19, 24)
inércia  = 100 · (0,50·norm(peso, 300, 350) + 0,50·norm(balanço, 235, 290))
```

| | 0 | 100 |
|---|---|---|
| **Resposta** | macia: saída de bola fácil, conforto, tolerância ao erro | firme: controle, precisão, pede swing para a bola andar |
| **Inércia** | leve na mão: reação na rede, braço poupado | pesada na mão: peso de bola, estabilidade no smash e na bola forte |

Medido nas 35: resposta de 20 a 80, inércia de 34 a 74, e **correlação entre os dois de −0,01**. São
independentes de verdade, então o mapa 2D é uma representação fiel do catálogo, não uma
simplificação dele.

Validação cruzada: o índice de exigência derivado destes eixos correlaciona **0,67** com o nível que
o próprio fabricante indica, sem que o nível do fabricante entre na conta. As maiores discordâncias
são raquetes macias vendidas como avançadas (Shark Elite 3K, Zand Z Blade), o que é coerente: macia
não é sinônimo de iniciante.

### 3.3 Os alvos ficam na escala do catálogo

A raquete mais leve na mão do catálogo tem inércia 34. Um alvo absoluto de 25 para uma iniciante
pequena nunca é alcançado, e a distância até ele pune igualmente todas as candidatas. O Tennis
Engineer tropeçou exatamente nisso e passou a trabalhar em posição de catálogo (`165310e`,
`catalog-scale.ts`). Aqui é igual: o alvo do jogador é expresso de 0 a 100 dentro da faixa real das
raquetes, e se reescala sozinho quando o catálogo muda.

### 3.4 O mapa é o relatório

O relatório desenha as 35 raquetes num plano resposta × inércia, a zona ideal do jogador, as três
recomendadas e, no de R$ 49,99, a raquete atual. É a explicação inteira numa figura: "a sua está
aqui, você precisa estar ali, estas três estão lá". Os nomes que a pessoa entende (potência,
controle, conforto, manobrabilidade, peso de bola) aparecem como rótulos das pontas dos eixos.

---

## 4. Do jogador para o alvo

### 4.1 Alvo de resposta — quanto a raquete deve fazer por ele

Sobe (mais firme) com:
- swing rápido e movimento amplo (quem veio do tênis tem os dois);
- bolas que passam do fundo;
- nível calibrado alto;
- controle como prioridade.

Desce (mais macia) com:
- swing lento ou curto;
- bolas que caem curtas;
- potência, conforto ou tolerância como prioridade;
- dor.

O mecanismo: EVA macio devolve a bola sozinho em batida lenta, mas em batida forte vira trampolim e
a bola voa. Quem bate forte precisa de face que segure; quem bate devagar precisa de face que
empurre.

### 4.2 Alvo e TETO de inércia — quanto de massa ele move

A capacidade física reaproveita a do Tennis Engineer, que já lê altura, peso, força, preparo, idade
e sexo (`c8f02bd`, `8df271a`). Massa de raquete é absoluta: quem tem 50 kg move uma fração maior do
próprio peso a cada golpe.

- O alvo sobe com o papel de atacante (smash) e com estabilidade como prioridade.
- Desce com o jogo de rede e com manobrabilidade como prioridade.

Acima da capacidade vira **teto**, e não só distância, com a mesma assimetria do motor de tênis:
passar do que o braço aguenta produz atraso e lesão, ficar abaixo produz só perda de desempenho. No
protótipo, inércia acima do alvo pesa 1,4 e abaixo pesa 0,8.

### 4.3 Nota final

```
fit = 100 − 1,2 · distância(resposta, inércia ponderada)
          − penalidade de nível do fabricante (mais de meio degrau fora do nível calibrado)
          − penalidade de transição (se a raquete atual é conhecida e a mudança é brusca)
```

**Filtros duros**, que excluem em vez de penalizar:
- orçamento declarado (raquete sem preço sai quando há orçamento, porque não dá para garantir que
  cabe);
- dor atual + resposta acima do teto de conforto;
- inércia acima do teto físico;
- nível do fabricante `profissional` para iniciante.

**Premissa da 1ª prioridade**, herdada (`bc2d3ee`): quem pede controle em 1º lugar não recebe
raquete abaixo da média do catálogo em resposta. O mesmo vale para os outros pedidos.

### 4.4 O pódio

- Três modelos distintos.
- **No máximo 2 da mesma marca.** A Heroe's tem quatro raquetes na ponta firme do mapa, e sem o
  limite um atacante recebe três Heroe's que dizem a mesma coisa.
- Raquetes com especificação idêntica são **gêmeas**: AMA Kronos e Zand Z Jump caem no mesmo
  ponto. Entra a de preço mais próximo do orçamento, e o relatório nomeia a outra, como o "irmã de
  linha" do tênis (`0c299ee`).

### 4.5 Protótipo — cinco jogadores contra as 35

| Jogador | Pódio |
|---|---|
| Iniciante, 1,60 m / 55 kg, dor no cotovelo, até R$ 1.500 | Adidas BT 3.0 · Shark Tour · Vision SuperCarbon |
| Ex-tenista, 1,85 m / 85 kg, avançado, smash muito rápido, falta controle | Zand Z Bruxo · Quicksand Kombat · Heroes Rebel |
| Intermediário de rede, falta reação | Mormaii Vitória III · AMA Poison Bee · AMA Medusa |
| Avançado atacante com dor no ombro agora | AMA Poison Bee · Zeiq Julia Nogueira · Heroes Show |
| Intermediário, swing lento, falta potência | Drop Shot Renegade · Shark Predator · Mormaii Sunrise |

O protótipo é descartável e não está no repositório. Na implementação, os pesos ganham justificativa
por tipagem, como no motor de tênis, e os invariantes ganham teste: nenhuma recomendação acima do
teto físico, nenhuma firme para dor atual, pódio sempre com três quando houver candidatas, veredicto
presente nos dois produtos.

---

## 5. A raquete atual

Com 35 raquetes no catálogo, a maior parte dos clientes vai ter uma que não está nele. A avaliação
da atual é metade da promessa do de R$ 49,99, então ela não pode depender só do catálogo.

1. **Está no catálogo** → entra com as specs reais.
2. **Não está** → a pessoa informa o que sabe, e a raquete entra no mapa por aproximação, com
   confiança menor dita no relatório:
   - peso: pesar numa balança de cozinha leva 30 segundos e é mais preciso que a faixa do
     fabricante;
   - sensação da face: macia / média / dura;
   - material: fibra de vidro / carbono / não sei.

**Veredicto** (nos dois produtos):
- **fique com a sua** — a atual está na zona ideal, ou a diferença para a 1ª é menor que um empate
  técnico;
- **troque** — a atual está fora da zona;
- **troque já** — ela fere um filtro duro: acima do teto físico, ou firme demais para uma dor atual.

---

## 6. Questionário (~30 perguntas, 3–5 min)

Cada pergunta alimenta um alvo, um teto ou um filtro. As que não alimentam nada não entram (§11 do
Tennis Engineer).

| Etapa | Perguntas | Alimenta |
|---|---|---|
| 1. Corpo | idade · altura · peso · sexo · força · condicionamento | teto e alvo de inércia |
| 2. Dor | sente dor ao jogar? cotovelo / ombro / punho / nenhum; se sim: agora ou já passou, e intensidade | teto de resposta, teto de inércia, filtros |
| 3. Experiência | há quanto tempo joga BT · vezes por semana · aulas · torneio e categoria (iniciante, D, C, B, A, pro) · veio de outro esporte de raquete (tênis, padel, squash, nenhum) · como se classifica | nível calibrado |
| 4. Calibração (sim / às vezes / não) | sustenta troca de 10+ bolas · smash com direção · lob defensivo até o fundo · voleio de bloqueio sob pressão · saque com intenção | nível calibrado (peso maior que a autoavaliação) |
| 5. Jogo | papel na dupla: ataco e finalizo / defendo e devolvo tudo / fico na rede / construo e coloco / ainda não sei · movimento amplo de tênis ou curto de punho · velocidade do smash | alvo de resposta e de inércia |
| 6. Bola | suas bolas costumam: cair curtas / passar do fundo / ir na rede / sair sem direção / boa profundidade (até 2) · na rede a raquete parece lenta / certa / leve demais | alvo de resposta e de inércia |
| 7. Prioridades | sente falta de, até 3 em ordem: potência · controle · reação na rede · peso de bola · conforto · objetivo: potencializar meu jogo / mudar algo / algo mais fácil / evoluir | alvos e premissa da 1ª prioridade |
| 8. Raquete atual | busca no catálogo · se não achar: peso, sensação da face, material · gosta / não gosta | veredicto, transição, avaliação |
| 9. Orçamento | até R$ 800 / R$ 800–1.500 / R$ 1.500–2.500 / acima / sem limite | filtro |
| 10. Texto livre | opcional | sinais, sem sobrescrever resposta objetiva |

**Sai do questionário de tênis:** corda, tensão, arrebentamento, backhand de uma ou duas mãos, tipo
de forehand, spin.

**Entra:**
- esporte de origem, porque o ex-tenista chega com o swing amplo que o EVA macio não segura;
- papel na dupla;
- sensação na rede;
- orçamento. No tênis o catálogo ia até R$ 1.800; aqui vai de R$ 329 a R$ 3.799, e recomendar fora
  do bolso é recomendar nada.

---

## 7. Decisões pendentes do dono

1. As escalas de EVA e de face (§2.1), em especial `pro` = medium e a ordem 3K < 6K < kevlar < 12K
   < 18K < 24K.
2. Dois eixos no mapa, no lugar dos cinco eixos do radar de tênis (§3).
3. No máximo 2 da mesma marca no pódio (§4.4).
4. As faixas de orçamento (§6, etapa 9).
