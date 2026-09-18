# Registro da marca Tennis Engineer

> **O que este documento é.** Um roteiro operacional para depositar a marca no INPI, escrito por
> quem não é advogado. Serve para você chegar a um especialista já sabendo o que quer, ou para
> depositar por conta própria com os riscos conhecidos. Taxas, prazos e códigos de serviço **mudam**
> — confira cada número na tabela vigente do INPI antes de pagar.
>
> Base legal citada: Lei 9.279/1996 (Lei da Propriedade Industrial, "LPI").

---

## 1. Por que agora, e não depois do CNPJ

O Brasil adota o **sistema atributivo**: a marca é de quem **deposita** primeiro, não de quem usa
primeiro (LPI art. 129). Enquanto o pedido não existe, o nome não é seu — por mais que ele esteja
em anúncio pago, no perfil com milhares de seguidores e em centenas de laudos entregues.

Existe uma rede de segurança, e ela é frágil: o **direito de precedência** (art. 129 §1) garante
prioridade a quem usava a marca de boa-fé, no país, há pelo menos **6 meses** antes do depósito de
terceiro. É defesa, não título: exige provar o uso, dentro de um processo que já virou disputa.

Por isso a recomendação é **depositar como pessoa física agora**, e não esperar constituir empresa.
A data do depósito é o que se está comprando. Transferir a marca para um CNPJ depois é um
procedimento comum e barato (transferência de titularidade); esperar meses pela empresa com a
campanha no ar é risco sem contrapartida.

### A condição que a pessoa física precisa cumprir

LPI art. 128 §1: só pode requerer registro quem **exerce efetiva e licitamente** a atividade, e essa
condição é declarada no próprio pedido. A declaração é feita no formulário; a comprovação pode ser
exigida depois.

No seu caso a prova é abundante e já existe: site no ar com produto pago, extrato do gateway de
pagamento, notas de anúncio, perfil comercial. **Junte isso numa pasta antes de depositar** — não
para anexar, mas para não ser pego de surpresa se houver exigência.

> ⚠️ **MEI provavelmente não resolve.** Atividades de consultoria e serviços intelectuais estão fora
> da lista de ocupações do MEI. Se a ideia for abrir CNPJ para a marca, a figura adequada
> provavelmente é ME, não MEI — pergunta para contador, não para mim. E isso **não** é motivo para
> adiar o depósito: deposita como pessoa física e transfere depois.

---

## 2. As três decisões

### 2.1 Tipo de marca — **comece pela nominativa**

| Tipo | O que protege | No seu caso |
|---|---|---|
| **Nominativa** | só a expressão `TENNIS ENGINEER`, em qualquer grafia, cor ou fonte | **é esta.** A mais ampla |
| **Mista** | o conjunto texto + elemento gráfico | protege menos: só aquele desenho com aquele nome |
| **Figurativa** | só o símbolo (o monograma bola + cordas + E) | opcional, num segundo pedido |

A nominativa é a que impede outra pessoa de usar o nome. A mista só impede quem copiar o conjunto —
alguém escreveria "Tennis Engineer" com outra tipografia e estaria fora do alcance.

Se o orçamento permitir dois pedidos, o segundo é a **figurativa** do monograma (que já existe
desenhado em `src/components/marketing/logo.tsx`). Mas se for um só, é a nominativa.

> Há um caso em que se recomenda a mista: quando a nominativa corre risco alto de ser recusada por
> descritividade, o elemento gráfico ajuda a conceder. Ver §5.

### 2.2 Classe — **42**, e provavelmente só ela

A proteção vale por classe de produto/serviço (Classificação de Nice). Cada classe é um pedido e uma
taxa a mais, então não se marca classe "por garantia".

O que o produto faz hoje: recebe respostas de um questionário e devolve uma **recomendação técnica**
de raquete, corda, espessura e tensão, por um site. Isso é serviço técnico prestado por software —
**classe 42**.

| Classe | Cobre | Entra? |
|---|---|---|
| **42** | serviços científicos e tecnológicos, análise e pesquisa, software como serviço (SaaS) | **sim — é o núcleo** |
| 41 | educação, treinamento, atividades esportivas | só se houver curso/conteúdo educacional vendido |
| 35 | publicidade, comércio, varejo | só se um dia vender raquete ou corda |
| 9 | software baixável, aplicativos | não — o produto é serviço web, não programa distribuído |

**Comece pela 42.** As outras entram quando o produto realmente as ocupar; depositar classe que não
se usa é pagar por proteção que pode ser derrubada por caducidade (art. 143: falta de uso por 5
anos).

### 2.3 Especificação de serviços — o texto que define o alcance real

Dentro da classe, o que protege é a **especificação**. Ampla demais o INPI exige correção; estreita
demais deixa o concorrente de fora do seu alcance.

O e-Marcas oferece uma lista pré-aprovada de itens e permite especificação de livre preenchimento.
Prefira os itens da lista — reduzem exigência. O sentido a cobrir é este:

> Serviços de consultoria e análise técnica em equipamentos esportivos; recomendação personalizada
> de raquetes, cordas e tensões de encordoamento; disponibilização de uso temporário de software não
> baixável (SaaS) para análise e recomendação de equipamento esportivo.

Leve esse texto e procure na lista do INPI os itens equivalentes. O que não tiver equivalente vai no
livre preenchimento.

---

## 3. Antes de depositar: terminar a busca

A busca já feita (18/09/2026, radical, sem classe) não retornou nada para `tennis engineer`. Falta:

- [ ] `tennis` sozinho, modo **contém**
- [ ] `engineer` sozinho, modo **contém**
- [ ] `tenis` sem acento, modo **contém** — o INPI avalia semelhança **fonética**, e em português a
      palavra corrente é "tênis". Uma marca como "Engenharia do Tênis" jamais apareceria numa busca
      por `tennis engineer` e seria exatamente o tipo de anterioridade que o examinador cita.

As duas primeiras devolvem muito resultado. Não se procura quantidade: procura-se alguma marca que
junte as **duas ideias** em serviço parecido. Se nenhuma juntar, o caminho está limpo até onde dá
para enxergar.

> A base do INPI é atualizada com atraso (o print de 18/09 trazia dados até 15/09) e pedidos
> recém-depositados demoram semanas até aparecer. "Nada encontrado" nunca é garantia.

---

## 4. O passo a passo no e-INPI

1. **Cadastro.** Criar login no e-INPI (pessoa física, com CPF). É o cadastro que dá acesso ao
   e-Marcas e à emissão de guias.
2. **Emitir a GRU.** Guia de Recolhimento da União, com o **código de serviço do pedido de registro
   de marca**. Escolher a **retribuição reduzida** se você se enquadrar — pessoa física, ME, EPP,
   MEI, cooperativa e algumas outras categorias pagam uma fração do valor cheio. O enquadramento é
   declarado e pode ser fiscalizado.
3. **Pagar a GRU.** O pedido só é aceito com a guia paga.
4. **Preencher o e-Marcas**: natureza (marca de produto/serviço), apresentação (**nominativa**),
   classe (**42**), especificação, e a declaração de exercício da atividade (art. 128 §1).
5. **Protocolar.** Sai o número do processo. **Essa é a data que vale** — a partir dela a
   prioridade é sua.

Custo, em ordem de grandeza: algumas centenas de reais por classe, somando depósito e concessão, com
a retribuição reduzida. Não confie neste parágrafo para orçar — consulte a tabela vigente.

---

## 5. O risco real deste nome: descritividade

Não é colidência — é o art. 124, VI da LPI, que proíbe registrar sinal de caráter genérico ou
**simplesmente descritivo** em relação ao serviço.

"Tennis Engineer" está em inglês, mas isso não protege: o INPI considera o significado quando a
expressão é compreensível pelo público brasileiro, e "tennis" é palavra reconhecida.

A favor do registro: o nome é **sugestivo**, não descritivo. Você não vende engenharia, nem se
apresenta como engenheiro — vende recomendação de equipamento. É preciso um salto de interpretação
para ligar "engenheiro de tênis" a "laudo de raquete e corda", e marca sugestiva é registrável.

Ainda assim é o ponto em que um examinador pode implicar. Dois efeitos práticos:

- Se vier **exigência**, ela é respondível — com argumentação de que o sinal é evocativo, e com prova
  de uso e reconhecimento de mercado. É aqui que um advogado paga o próprio custo.
- Se o risco pesar, depositar **também** a mista (nome + monograma) aumenta a chance de sair com
  algum registro. Protege menos, mas protege.

---

## 6. Os prazos que matam um pedido em silêncio

Esta é a parte em que depositar sozinho costuma dar errado. O processo leva de **12 a 18 meses** e é
inteiramente conduzido pela **Revista da Propriedade Industrial (RPI)**, publicada semanalmente, às
terças. O INPI **não liga, não manda e-mail e não cobra**: publica. Quem não lê, perde.

| Etapa | Prazo | O que acontece se passar |
|---|---|---|
| Oposição de terceiros | 60 dias da publicação do pedido | você tem 60 dias para se manifestar — em silêncio, o exame segue só com a versão do opositor |
| Exigência do examinador | 60 dias | pedido **arquivado definitivamente** |
| Pagamento da concessão, após o deferimento | 60 dias (prorrogáveis por mais 30, com acréscimo) | pedido **arquivado**, e tudo que foi pago se perde |

O terceiro é o mais cruel: você venceu, e perde por não ter pago no prazo de uma publicação que
ninguém avisou que saiu.

**Consequência prática:** ou você cria a rotina de checar a RPI toda semana pelo número do processo
durante um ano e meio, ou contrata quem faça isso. É exatamente aqui que os honorários de um
escritório se justificam — o monitoramento vale mais que o preenchimento do formulário.

Concedido, o registro vale **10 anos**, renováveis indefinidamente por períodos iguais. A renovação
também tem prazo, e também só é avisada pela RPI.

---

## 7. Checklist

**Antes**
- [ ] Buscas restantes: `tennis`, `engineer`, `tenis` (modo contém, sem classe)
- [ ] Pasta com prova de atividade: site, extrato do gateway, notas de anúncio, perfil comercial
- [ ] Decidir: só nominativa, ou nominativa + figurativa (dois pedidos, duas guias)

**Depósito**
- [ ] Cadastro no e-INPI
- [ ] GRU do pedido de registro, com retribuição reduzida se aplicável
- [ ] GRU paga
- [ ] e-Marcas: nominativa · classe 42 · especificação · declaração do art. 128 §1
- [ ] Protocolar e **guardar o número do processo**

**Depois — para sempre**
- [ ] Acompanhar a RPI semanalmente pelo número do processo (ou contratar acompanhamento)
- [ ] Reservar os 60 dias de resposta a qualquer exigência
- [ ] Reservar a verba da concessão para quando o deferimento sair

---

## 8. Onde eu paro

Posso redigir a especificação, preparar a resposta a uma exigência, organizar a prova de uso e
montar a rotina de acompanhamento da RPI. Não posso assinar peça, não represento você perante o
INPI, e não substituo parecer de advogado.

Pelo estágio do projeto — campanha paga no ar, receita mensal em quatro dígitos, nome já associado
ao produto no mercado —, o custo de um escritório especializado é pequeno perto do custo de perder o
nome ou de arquivar o pedido por prazo perdido. A minha recomendação é: usar este documento para
chegar à conversa sabendo o que pedir, e contratar o acompanhamento.
