## Estrutura ContaCerta

_Estrutura de projeto._

### Visão geral

Sistema web para controle de gastos mostrando o quanto que o usuario esta gastando, que possa abranger diversas categorias as quais inclui custos diversos.  
Com compatibilidade para desktop e mobile.

### Pontos Principais

- Ambiente
- Melhorias e Sustentações

---

### 1 Tecnologias

- React
- NestJS (substituindo Express para melhor organização e escalabilidade)
- Node.js
- Mongo DB Atlas
- Mongoose
- JWT (Access + Refresh Token)

#### 1.1 Hospedagem

- vercel (backend adaptado para serverless)

#### 1.2 Frontend Interface

- Area de login
- Usuario
- Senha
- envio de email para confirmação

- Painel principal
- (topo da direita) menu que contenha opcoes de usuarios, como: logout, mudar do tema (dark ou white)

- A esquerda um menu de opcoes para que fique em formato de hambuguer de acordo com a responsividade, nesse menu:
  - gastos
  - ganhos
  - dashboard
  - contas pendentes
  - metas financeiras

- Quadro para visualizar previa do dashboard

- Insercao de Gastos:
  - Valor do Gasto
  - Categoria (qual o tipo de gasto)
  - data do gasto
  - descrição (opcional)

- Insercao de Ganhos:
  - Valor
  - data
  - descrição (opcional)

- Dashboard:
  - Dados relacionado a ganhos, Gastos, saldo e contas pendentes
  - Filto por mes e ano
  - especificar a categoria e o valor

---

#### Detalhamento de interface UI:

# 💰 Finance Dashboard — UI Structure

> Design System: **Dark Finance** · React + Tailwind CSS  
> Paleta: Fundo quase-preto · Verde-lima como accent · Cards em grafite escuro

---

## 🎨 Design Tokens (CSS / Tailwind Config)

```js
// tailwind.config.js
colors: {
  bg: {
    base:    '#0A0A0A',   // fundo global
    card:    '#141414',   // cards primários
    muted:   '#1C1C1C',   // cards secundários / rows
    overlay: '#232323',   // hover states
  },
  accent: {
    lime:    '#A3E635',   // verde-lima principal (saldo, tabs ativas, CTAs)
    orange:  '#F97316',   // linha "Spent" nos gráficos
    red:     '#EF4444',   // variação negativa / overspending
    yellow:  '#EAB308',   // risco / at-risk
  },
  text: {
    primary:   '#FFFFFF',
    secondary: '#9CA3AF',
    muted:     '#4B5563',
  },
  category: {
    shopping:   '#EF4444',
    food:       '#F97316',
    groceries:  '#22C55E',
    health:     '#06B6D4',
    travel:     '#8B5CF6',
    taxi:       '#3B82F6',
    other:      '#6B7280',
  }
}

borderRadius: { card: '16px', pill: '9999px', icon: '12px' }
fontFamily:   { sans: ['Syne', 'sans-serif'] }  // display/headings
              { body: ['DM Sans', 'sans-serif'] } // corpo
```

---

## 📐 Layout Global

```
┌─────────────────────────────────────────────┐
│  Sidebar (desktop) │   Main Content Area     │
│  Bottom Nav (mobile)                         │
└─────────────────────────────────────────────┘
```

- **Mobile-first** · max-width `430px` centrado em desktop
- Padding interno padrão: `px-5 py-4`
- Gap entre seções: `gap-4` / `gap-6`
- Todos os cards: `rounded-2xl bg-card p-4`

---

## 🗂️ Estrutura de Rotas / Telas

```
/                    → Home (Dashboard)
/expenses            → Expenses (visão geral por categoria)
/budget              → Monthly Budget
/transactions        → Transaction History
/category/:slug      → Category Detail (genérico — ex: taxi, food, travel…)
```

---

## 📱 Tela 1 — Home (`/`)

### Header

```
┌──────────────────────────────────────┐
│ [Avatar] Farida Orajova    [🌙] [🔔] │
└──────────────────────────────────────┘
```

- Avatar: `w-9 h-9 rounded-full`
- Nome: `text-sm font-medium text-text-secondary`
- Ícones à direita: `text-text-secondary`, hover `text-white`

---

### Hero Balance

```
Balance
$2,408.45          ← text-4xl font-bold text-accent-lime
```

- Label "Balance": `text-sm text-text-secondary uppercase tracking-widest`
- Valor: `text-5xl font-extrabold text-accent-lime`

---

### Card "Well Done" (Savings Highlight)

```
┌─────────────────────────────────────────┐
│  Well done! 🎉          ╭──────────╮    │
│  Your spending reduced  │  $75     │    │
│  by 2% from last month. │  Saved   │    │
│  [View Details →]       ╰──────────╯    │
└─────────────────────────────────────────┘
```

- Fundo: `bg-card rounded-2xl`
- Gráfico circular (donut): `stroke-accent-lime`, traço restante `stroke-bg-muted`
- Valor central: `text-xl font-bold text-white`
- Label: `text-xs text-text-secondary`
- "View Details": `text-accent-lime text-sm font-medium underline-offset-2`

---

### Wallets / Accounts (Scroll Horizontal)

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ [🏦]         │ │ [💵]         │ │ [🏦]         │
│ $425.35      │ │ $600.00      │ │ $775.00      │
│ PASHABANK USD│ │ Cash USD     │ │ LEO...       │
└──────────────┘ └──────────────┘ └──────────────┘
```

- Container: `flex gap-3 overflow-x-auto scrollbar-none`
- Card: `min-w-[130px] bg-card rounded-2xl p-3 flex flex-col gap-1`
- Ícone: `w-8 h-8 rounded-xl bg-bg-muted flex items-center justify-center`
- Valor: `text-base font-semibold text-white`
- Label banco: `text-xs text-text-secondary uppercase`

---

### Quick Actions (Ícones de Ação)

```
[↗ Send]  [↺ History]  [$ Exchange]  [+ Add]
```

- Container: `flex justify-between px-2`
- Cada item: `flex flex-col items-center gap-1`
- Ícone: `w-12 h-12 rounded-2xl bg-card flex items-center justify-center`
- Label: `text-xs text-text-secondary`
- Botão "+": `bg-accent-lime text-black rounded-full`

---

### Transaction History (Preview)

```
Transaction History              [See All →]
─────────────────────────────────────────────
[All]  [Spending]  [Income]       ← abas

2 July 2023
─────────────────────────────────────────────
[🚗] Taxi · Uber          -$15    8:25 pm
[🍔] Food · Starbucks     -$17    9:50 pm
```

- Título + link: `flex justify-between items-center`
- Abas: `flex gap-4`, aba ativa com `border-b-2 border-accent-lime text-white`, inativa `text-text-secondary`
- Data separador: `text-xs text-text-muted uppercase tracking-widest my-2`
- Row transação: `flex items-center gap-3 py-3 border-b border-bg-muted`
- Valor negativo: `text-white font-medium`
- Valor positivo: `text-accent-lime font-medium`

---

### Bottom Navigation

```
[🏠 Home]  [📊 Expenses]  [➕]  [📅 Budget]  [👤 Profile]
```

- Container: `fixed bottom-0 w-full bg-bg-card border-t border-bg-muted px-6 py-3 flex justify-between`
- Botão central "+": `w-12 h-12 bg-accent-lime rounded-full flex items-center justify-center -mt-6 shadow-lg shadow-lime-500/30`
- Ícone ativo: `text-accent-lime`
- Ícone inativo: `text-text-muted`

---

## 📊 Tela 2 — Expenses (`/expenses`)

### Header

```
← Expenses
```

---

### Period Tabs

```
[Daily]  [Weekly]  [Monthly]  [Yearly]
```

- Tab ativa: `text-accent-lime border-b-2 border-accent-lime font-semibold`
- Tab inativa: `text-text-secondary`

---

### Donut Chart + Legenda

```
┌─────────────────────────────────────────────┐
│                                             │
│   ╭──────────╮    ● Shopping                │
│   │  $295    │    ● Food                    │
│   │ Shopping │    ● Groceries               │
│   ╰──────────╯    ● Health                  │
│                   ● Travel                  │
│                   ● [categoria dinâmica]    │
└─────────────────────────────────────────────┘
```

- Donut: `recharts PieChart` ou `SVG manual`
- Centro: valor da categoria com maior gasto (dinâmico via `data.sort`)
- Legenda: `flex flex-col gap-1`, bolinha `w-3 h-3 rounded-full bg-[category.color]`

---

### Lista de Categorias (dinâmica via API)

```
┌──────────────────────────────────────────────┐
│ [🛒 ícone]  Groceries          $67.00  15% ↑ │
│ [🛍️ ícone]  Shopping          $158.00   8% ↓ │
│ [🍔 ícone]  Food              $125.00   2% ↓ │
│ [💊 ícone]  Health             $28.00   1% ↓ │
│ [✈️ ícone]  Travel            $685.00  12% ↑ │
│ [categoria] {name}            ${amount} {%}  │
└──────────────────────────────────────────────┘
```

- **Renderização 100% dinâmica**: `categories.map(cat => <CategoryRow />)`
- Row: `flex items-center gap-3 bg-card rounded-2xl p-4 mb-2`
- Ícone container: `w-10 h-10 rounded-xl flex items-center justify-center` com `bg` da cor da categoria
- Variação positiva: `text-accent-red` + `↑`
- Variação negativa: `text-accent-lime` + `↓`

#### `CategoryRow` Props Interface

```ts
interface Category {
  id: string;
  name: string;
  slug: string; // usado para navegar → /category/:slug
  icon: string; // nome do ícone (Lucide ou similar)
  color: string; // hex da cor
  amount: number;
  change: number; // % variação (positivo = aumento gasto)
  period: "daily" | "weekly" | "monthly" | "yearly";
}
```

---

## 📈 Tela 3 — Monthly Budget (`/budget`)

### Header + Progress Bar

```
← Monthly Budget
────────────────────────────────────
Spend: $3,050 / $5,000          61%
[████████████████░░░░░░░░░░░░░░░░]
```

- Barra: `rounded-full h-2 bg-bg-muted`
- Preenchimento: dinâmico via `(spent/limit)*100`%
- Cor: verde se `< 70%`, amarelo se `70–90%`, vermelho se `> 90%`

---

### Line Chart — Budget vs Spent

```
$2500 │         ╭────╮          ·····╮
$2000 │    ╭────╯    ╰──╮   ···      │
$1500 │────╯             ╰·──        │
      └───┬───┬───┬───┬───┬───┬──
         Jan Feb Mar Apr May Jun Jul
              ── Budget   ── Spent
```

- Lib: `recharts LineChart`
- Linha Budget: `stroke="#A3E635"` suavizada (`type="monotone"`)
- Linha Spent: `stroke="#F97316"`
- Grid: `stroke="#1C1C1C"` linhas horizontais suaves
- Tooltip customizado: fundo `bg-card`, bordas `border-bg-muted`

---

### Bar Chart — Last 6 Periods

```
$2500 │ █         █
$2000 │ █    █    █
$1500 │ █    █    █    █
$1000 │ █    █    █    █    █
 $500 │ █    █    █    █    █    █
      └─────────────────────────────
        Jan  Feb  Mar  Apr  May  Jun
       ■ Within  ■ Risk  ■ Overspending
```

- Lib: `recharts BarChart`
- Cor por status: `{ within: '#22C55E', risk: '#EAB308', over: '#EF4444' }`
- Status calculado dinamicamente no frontend com base nos dados do backend

---

## 🧾 Tela 4 — Transaction History (`/transactions`)

### Header + Tabs

```
← Transaction History
────────────────────────────────────
[All]  [Spending]  [Income]
```

---

### Lista Agrupada por Data (dinâmica)

```
{data.groupBy('date').map(group => (
  <DateGroup date={group.date}>
    {group.transactions.map(tx => <TransactionRow tx={tx} />)}
  </DateGroup>
))}
```

#### `Transaction` Interface

```ts
interface Transaction {
  id: string;
  date: string; // ISO 8601
  time: string; // "8:25 pm"
  category: string; // "taxi" | "food" | "shopping" | ...
  categorySlug: string; // para navegação
  merchant: string; // "Uber", "Starbucks", "Bravo"...
  amount: number; // negativo = gasto, positivo = receita
  type: "income" | "spending";
}
```

#### TransactionRow Layout

```
┌──────────────────────────────────────────────────┐
│ [ícone categoria]  {categoria}    -{$amount}      │
│                    {merchant}      {time}         │
└──────────────────────────────────────────────────┘
```

- Ícone: `w-10 h-10 rounded-xl bg-bg-muted` (cor baseada em `category.color`)
- Valor negativo: `text-white`
- Valor positivo: `text-accent-lime`
- Separador de data: `text-xs text-text-muted py-2 border-b border-bg-muted`

---

## 🔍 Tela 5 — Category Detail (`/category/:slug`)

> **Totalmente genérica** — funciona para qualquer categoria retornada pelo backend  
> (Taxi, Food, Shopping, Travel, Groceries, Health, etc.)

### Header

```
← {category.name} expenses
```

- Título dinâmico via `params.slug` → lookup na lista de categorias

---

### AI Insight (texto dinâmico)

```
You spent ${totalAmount} on {category.name} in {period}.
```

- Container: `bg-card rounded-2xl p-4`
- Texto: `text-sm text-text-secondary`
- Valores destacados: `text-white font-semibold`
- Gerado pelo backend ou calculado no frontend com template string

---

### Line Chart — Evolução da Categoria

```
$250 │                              ╭──
$200 │         ╭──╮           ╭────╯
$150 │    ╭────╯  ╰──╮   ╭───╯
$100 │────╯          ╰───╯
 $50 │
     └───┬───┬───┬───┬───┬───┬──
        Jan Feb Mar Apr May Jun Jul
```

- Lib: `recharts AreaChart` com `fillOpacity` gradiente
- Cor da área: baseada em `category.color` + `opacity: 0.15`
- Cor da linha: `category.color`
- Eixo X: meses do período (dinâmico via dados do backend)

#### `CategoryChartData` Interface

```ts
interface CategoryChartPoint {
  month: string; // "Jan", "Feb"...
  amount: number;
}
```

---

### Lista de Transações Filtradas

```
{filteredTransactions
  .filter(tx => tx.categorySlug === params.slug)
  .groupBy('date')
  .map(group => (
    <DateGroup date={group.date}>
      {group.transactions.map(tx => <TransactionRow tx={tx} />)}
    </DateGroup>
  ))
}
```

- **Mesmo componente `TransactionRow`** reutilizado da Tela 4
- Exibe apenas transações da categoria selecionada
- Agrupadas por data, ordem decrescente

---

## 🧩 Componentes Reutilizáveis

| Componente           | Usado em     |
| -------------------- | ------------ |
| `<TransactionRow />` | Tela 1, 4, 5 |
| `<DateGroup />`      | Tela 4, 5    |
| `<CategoryRow />`    | Tela 2       |
| `<BottomNav />`      | Todas        |
| `<PageHeader />`     | Telas 2–5    |
| `<PeriodTabs />`     | Telas 2, 4   |
| `<DonutChart />`     | Tela 2       |
| `<AreaLineChart />`  | Telas 3, 5   |
| `<BarChart />`       | Tela 3       |
| `<ProgressBar />`    | Tela 3       |
| `<WalletCard />`     | Tela 1       |
| `<InsightCard />`    | Telas 1, 5   |

---

## 🔌 Contrato de API Esperado (Backend)

```ts
// GET /api/summary
{ balance, saved, wallets[], recentTransactions[] }

// GET /api/expenses?period=daily|weekly|monthly|yearly
{ categories: Category[] }

// GET /api/budget?period=monthly
{ limit, spent, chartData[], periodBars[] }

// GET /api/transactions?type=all|spending|income
{ transactions: Transaction[] }

// GET /api/category/:slug?period=...
{ category: Category, chartData: CategoryChartPoint[], transactions: Transaction[] }
```

---

## 📦 Dependências Sugeridas

```json
{
  "recharts": "^2.x", // todos os gráficos
  "lucide-react": "^0.x", // ícones
  "react-router-dom": "^6.x", // navegação
  "clsx": "^2.x", // classes condicionais
  "date-fns": "^3.x", // formatação de datas
  "syne": "Google Fonts — display",
  "dm-sans": "Google Fonts — body"
}
```

#### Categorias:

- essas serao as categorias que estaram "pre-selecionadas" para que o usuario classifique seus gastos:

Educacao, eletronicos, Transferencias para conta propria, Assinaturas digitais, Cartao de credito, Casa, Comida e bebida, Compras, contas e servicos, Emprestimos, Entretenimento, Esportes, Impostos, Investimento, Roupas, saques, saude e cuidados pessoais, servicos profissionais, supermecado, taxas, Transporte, viagens.

- opcao para adicionar as categorias de acordo com a rotina pessoal do cliente

---

Bases para o design:

- Painel principal, Insercao de Gasto, Insercao de Ganhos, Dashboard, Categorias (DESKTOP E MOBILE)
- Responsivo
- Garantir que seja acessivel tanto para celulares e PCs
- interface moderna com design intuitivo a nivel empresárial,
- foco em performance

#### 1.2.1 Cores

- Cores modernas, de design premium

---

### 1.3 Backend

Backend: NestJS  
Banco de dados: MongoDB Atlas  
ODM: Mongoose  
Autenticação: JWT + Refresh Token  
Arquitetura: Modular  
API REST  
Multi-tenant por usuário  
Compatível com Vercel (Serverless)

---

### 1.3.1 Regras

Área de Login

Campos:

- Usuário (email)
- Senha

Requisitos:

- verificação de email valido
- envio de confirmação por email (Resend/Nodemailer)
- JWT
- Refresh Token
- Hash de senha com bcrypt
- Controle de sessão
- Recuperação de senha atraves do email

---

Painel Principal

O painel principal deve possuir:

Cadastro de Usuário

Campos:

- Email
- Senha

Requisitos:

- email valido

---

### 1.3.2 Funcionalidades dos Itens (Backend Alinhado)

O backend deve suportar:

- CRUD completo de gastos e ganhos (Transaction)
- CRUD de categorias (default + personalizada)
- Controle de contas pendentes
- Controle de metas financeiras
- Dashboard com agregações por:
  - mês
  - ano
  - categoria
- Multi-tenant (dados isolados por usuário)
- Autenticação completa
- Filtros avançados

---

### 1.3.3 ROTAS NECESSÁRIAS

Além do CRUD padrão, criar modelagem para:

#### Auth

- login
- refresh-token
- logout
- forgot-password
- reset-password
- me
- register

---

#### Transactions (Gastos / Ganhos)

- POST /transactions
- GET /transactions
- GET /transactions/:id
- PATCH /transactions/:id
- DELETE /transactions/:id

---

#### Categories

- GET /categories
- POST /categories

---

#### Contas Pendentes

- POST /pending
- GET /pending
- PATCH /pending/:id
- DELETE /pending/:id

---

#### Metas

- POST /goals
- GET /goals
- PATCH /goals/:id
- DELETE /goals/:id

---

#### Dashboard

- GET /dashboard?month=&year=

---

### 1.3.4 REQUISITOS TÉCNICOS

Quero que você me entregue:

---

#### MODELAGEM DE ENTIDADES

User

- id
- email
- password
- emailVerified
- createdAt

Auth

- id
- userId
- refreshToken
- expiresAt

Transaction (Gastos / Ganhos)

- id
- userId
- type (EXPENSE | INCOME)
- value
- categoryId
- description
- date

Category

- id
- userId (null = padrão do sistema)
- name
- type

Contas (PendingAccount)

- id
- userId
- title
- value
- dueDate
- paid

Metas (Goal)

- id
- userId
- name
- targetValue
- currentValue
- deadline

---

#### SCHEMAS MONGOOSE

(necessário criar todos com timestamps e validações)

---

#### DTOs DO NESTJS

Criar:

- Create DTO
- Update DTO
- Response DTO

Para:

- User
- Auth
- Transaction
- Category
- Pending
- Goal

---

#### ESTRUTURA DE MÓDULOS

Sugestão profissional:

- auth
- users
- transactions
- categories
- pending
- goals
- dashboard

---

#### AUTENTICAÇÃO E SEGURANÇA

Quero:

- JWT access token
- Refresh token
- Guards (AuthGuard)
- Multi-tenant seguro (userId em todas queries)
- Criptografia com bcrypt
- Rate limit
- Helmet
- CORS configurável

---

#### ESTRUTURA DE PASTAS

Quero estrutura completa do backend NestJS.

---

### 2 Melhorias e Sustentações

- Exportação de relatórios
- Integração com APIs financeiras
- Notificações
- Inteligência para análise de gastos
- Cache para dashboard (Redis - opcional futuro)
