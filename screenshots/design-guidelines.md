# OSF Serviços — Design Guidelines

Valores extraídos do código do produto (`tailwind.config.ts` e `styles.css`). Cole este bloco
em outro prompt para gerar peças que combinem com o sistema.

---

## Identidade

**Produto:** OSF Serviços — sistema de gestão para prestadores de serviço em campo.
**Origem da marca:** energia solar. As duas cores vêm da própria logo: o dourado do chip no
"F" e o azul das células do painel solar.
**Tom visual:** escuro, sóbrio, com um único ponto de brilho dourado. Nada de gradientes
chamativos ou múltiplas cores concorrendo — o dourado é o único acento forte, e é sempre a
ação principal.

---

## Paleta

### Acentos de marca (fixos nos dois temas)

| Papel | Hex | Uso |
|---|---|---|
| Dourado (primário) | `#F0AC28` | CTA principal, valores em destaque, ícones ativos, item de menu selecionado |
| Dourado escuro | `#C98A1A` | Hover do dourado |
| Azul painel | `#14345F` | Cor secundária de marca, fundos institucionais |
| Azul claro | `#2F5B94` | Hover do azul, detalhes sobre fundo escuro |

### Tema escuro (padrão do produto — use este nas peças)

| Token | Hex | Uso |
|---|---|---|
| Fundo da página | `#0A0A0A` | Base de tudo |
| Cartão | `#141414` | Cards, painéis, modais |
| Superfície suave | `#1C1C1C` | Inputs, chips inativos |
| Superfície elevada | `#232323` | Hover, seções secundárias |
| Texto primário | `#FFFFFF` | Títulos e valores |
| Texto secundário | `#9CA3AF` | Rótulos, descrições |
| Texto apagado | `#4B5563` | Legendas, texto auxiliar |
| Borda sutil | `#2A2A2A` | Separadores, contorno de card |
| Borda forte | `#3A3A3A` | Foco, card ativo |

### Tema claro (existe no produto, mas evite em peças de divulgação)

Fundo `#E8EDE4` · cartão `#F8FAF6` · superfície `#D4DCCB` · elevada `#C8D4BE`
Texto `#0F1A0C` / `#1E3318` / `#3A5233` · bordas `#C0CCB5` / `#A8B89E`

### Semânticas financeiras

| Estado | Escuro | Claro |
|---|---|---|
| Entrada / positivo | `#22C55E` | `#3A7D2C` |
| Saída / negativo | `#EF4444` | `#B94545` |
| Pendente / atenção | `#EAB308` | `#C97A2A` |

### Categorias (gráficos e etiquetas)

`#EF4444` compras · `#F97316` alimentação · `#22C55E` mercado · `#06B6D4` saúde
`#8B5CF6` viagem · `#3B82F6` transporte · `#6B7280` outros

---

## Tipografia

| Papel | Fonte | Peso | Observação |
|---|---|---|---|
| Títulos, números grandes, botões | **Syne** | 700–800 | `letter-spacing: 0`. É a fonte de personalidade da marca |
| Corpo, rótulos, tabelas | **DM Sans** | 400–600 | Leitura longa e dados |

Números monetários usam **Syne bold** e o formato brasileiro: `R$ 27.410,25`.
Valores de destaque no dourado `#F0AC28`; valores neutros em branco.

---

## Forma e espaçamento

- **Raio de card:** 16px · **raio de ícone/input:** 12px · **pílulas e chips:** totalmente
  arredondados
- **Cards:** fundo `#141414`, borda `#2A2A2A` de 1px, sem sombra pesada — a separação vem do
  contraste de fundo, não de sombra
- **Botão primário:** fundo dourado `#F0AC28`, texto **preto** (nunca branco), negrito, raio 12px
- **Botão secundário:** fundo transparente, borda `#2A2A2A`, texto secundário
- **Respiro generoso:** o layout usa muito espaço vazio entre blocos. Não comprima

---

## Ícones

Biblioteca **Lucide**, traço fino, tamanho 16–20px em linha com texto.
Ícone ativo em dourado; inativo em `#9CA3AF`.

---

## Regras de aplicação

**Faça**
- Um único ponto dourado por composição — o resto respira em cinza e preto
- Números grandes como protagonistas (é um sistema de gestão: o dado é o herói)
- Fundo `#0A0A0A` cheio, sem textura
- Português do Brasil, direto, sem jargão

**Não faça**
- Dourado sobre branco (contraste insuficiente) — dourado sempre sobre fundo escuro
- Texto branco dentro de botão dourado — o texto é preto
- Mais de duas cores semânticas na mesma peça
- Gradientes coloridos, sombras longas, brilhos

---

## Posicionamento para a campanha (empresas de logística)

**Quem:** transportadoras, centros de distribuição, operadores logísticos com frota e
galpões espalhados — que precisam orçar serviço em campo com deslocamento.

**A dor:** orçar atendimento fora da base é chute. Ninguém sabe quanto custa mandar equipe
a 180 km de distância, e o deslocamento come a margem em silêncio.

**A promessa:** o OSF Serviços calcula a rota real por estrada, converte em custo de
deslocamento (ida e volta), soma aos serviços e devolve um PDF pronto para o cliente.

**Os três pilares para a peça**
1. **Rota real, não linha reta** — distância por malha viária, com o ponto de destino
   exibido para conferência antes de fechar
2. **Deslocamento vira preço automaticamente** — R$/km, taxa mínima e raio grátis
   configuráveis; o sistema aplica a regra
3. **Do orçamento ao PDF em minutos** — no celular, em campo, ou no computador

**Frases de apoio (tom do produto)**
- "Quanto custa mandar equipe até lá? O sistema responde."
- "372 km ida e volta. R$ 892,80 de deslocamento. Calculado, não chutado."
- "Orçamento fechado no celular, ainda no pátio do cliente."

---

## Prints disponíveis

Desktop 1440×900 (@2x → 2880×1800) · Mobile 390×844 (@3x → 1170×2532, formato de Stories)

| Arquivo | Tela |
|---|---|
| `{desktop,mobile}-01-dashboard.png` | Dashboard — saldo, carteiras, evolução mensal |
| `{desktop,mobile}-02-orcamentos-listagem.png` | Orçamentos — taxa de conversão, ticket médio, valor aprovado |
| `{desktop,mobile}-03-wizard-cliente.png` | Novo orçamento 1/5 — escolha do cliente |
| `{desktop,mobile}-04-wizard-servicos.png` | Novo orçamento 2/5 — catálogo de serviços |
| `{desktop,mobile}-05-wizard-servicos-carrinho.png` | Novo orçamento 2/5 — serviços selecionados |
| `{desktop,mobile}-06-wizard-deslocamento.png` | Novo orçamento 3/5 — **cálculo de deslocamento** |
| `{desktop,mobile}-07-wizard-revisao.png` | Novo orçamento 4/5 — **revisão com rota e custo** |

Os dois últimos são as telas-âncora da campanha: mostram a transportadora, os serviços de
frota e galpão, os 372 km ida e volta e o destino localizado no mapa.
