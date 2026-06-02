# ContaCerta — Prompts de Desenvolvimento Sequenciados

> **Leia antes de começar**
> - Os prompts de **Backend** são para o **Cursor** (geração do zero)
> - Os prompts de **Frontend** são para o **Lovable** (geração do zero) + **Codex** (continuação quando os tokens acabarem)
> - Cada etapa tem uma **checklist de validação** — só avance para a próxima após confirmar todos os itens
> - Nunca pule etapas; erros acumulados comprometem a integração

---

# ══════════════════════════════════
# 🖥️ BACKEND — CURSOR
# ══════════════════════════════════

---

## BACKEND — ETAPA 1: Scaffold e Configuração Base

```
Crie um projeto NestJS do zero com as seguintes características:

STACK:
- NestJS (versão mais recente estável)
- TypeScript strict mode
- MongoDB Atlas via Mongoose
- Compatível com deploy serverless na Vercel

CONFIGURAÇÃO INICIAL:
1. Inicie o projeto com `nest new contacerta-api` sem git init
2. Configure o tsconfig.json com strict: true, paths aliases (@/modules/*, @/common/*)
3. Instale e configure as dependências:
   - @nestjs/mongoose, mongoose
   - @nestjs/jwt, @nestjs/passport, passport, passport-jwt, passport-local
   - @nestjs/config (para variáveis de ambiente)
   - bcrypt, @types/bcrypt
   - class-validator, class-transformer
   - @nestjs/throttler (rate limiting)
   - helmet
   - @nestjs/swagger (documentação)
   - nodemailer (envio de email)

4. Crie o arquivo `.env.example` com as seguintes variáveis (sem valores reais):
   - MONGODB_URI=
   - JWT_SECRET=
   - JWT_REFRESH_SECRET=
   - JWT_EXPIRES_IN=15m
   - JWT_REFRESH_EXPIRES_IN=7d
   - EMAIL_HOST=
   - EMAIL_PORT=
   - EMAIL_USER=
   - EMAIL_PASS=
   - EMAIL_FROM=
   - FRONTEND_URL=
   - NODE_ENV=development

5. Configure o AppModule para carregar .env via ConfigModule.forRoot({ isGlobal: true })
6. Configure MongooseModule.forRootAsync usando ConfigService para ler MONGODB_URI do .env
7. Configure Helmet globalmente no main.ts
8. Configure CORS no main.ts aceitando origem do FRONTEND_URL do .env
9. Configure ValidationPipe globalmente com whitelist: true, forbidNonWhitelisted: true, transform: true
10. Configure ThrottlerModule: 100 requests por 60 segundos globalmente

ESTRUTURA DE PASTAS a criar:
src/
  modules/
    auth/
    users/
    transactions/
    categories/
    pending/
    goals/
    dashboard/
  common/
    guards/
    decorators/
    filters/
    interceptors/
  main.ts
  app.module.ts

VERCEL SERVERLESS:
- Crie o arquivo `api/index.ts` na raiz do projeto com adaptador NestJS para Vercel:

  import { NestFactory } from '@nestjs/core';
  import { AppModule } from '../src/app.module';
  import { ExpressAdapter } from '@nestjs/platform-express';
  import express from 'express';

  const server = express();
  let app: any;

  async function bootstrap() {
    if (!app) {
      app = await NestFactory.create(AppModule, new ExpressAdapter(server));
      app.setGlobalPrefix('api');
      await app.init();
    }
    return server;
  }

  export default async (req: any, res: any) => {
    const srv = await bootstrap();
    srv(req, res);
  };

- Crie o `vercel.json` na raiz:
  {
    "version": 2,
    "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
    "routes": [{ "src": "/api/(.*)", "dest": "api/index.ts" }]
  }

- Instale: express, @nestjs/platform-express

NÃO crie nenhum módulo de negócio ainda. Apenas o scaffold, configuração e estrutura de pastas.
```

### ✅ Checklist Etapa 1 — Backend
- [ ] Projeto compila sem erros (`npm run build`)
- [ ] `npm run start:dev` sobe sem erros
- [ ] `.env.example` criado com todas as variáveis
- [ ] `vercel.json` criado corretamente
- [ ] `api/index.ts` criado com adaptador serverless
- [ ] Estrutura de pastas `src/modules/` e `src/common/` criada

---

## BACKEND — ETAPA 2: Schemas Mongoose e Entidades

```
No projeto NestJS existente, crie todos os Schemas Mongoose e suas interfaces TypeScript.
NÃO crie módulos, services ou controllers ainda — apenas os schemas e DTOs.

SCHEMA 1 — User (src/modules/users/schemas/user.schema.ts):
- _id: ObjectId (gerado pelo Mongo)
- email: String, required, unique, lowercase, trim
- password: String, required (hash bcrypt — nunca retornar em queries)
- emailVerified: Boolean, default false
- emailVerificationToken: String (opcional, para confirmar email)
- passwordResetToken: String (opcional)
- passwordResetExpires: Date (opcional)
- timestamps: true (createdAt, updatedAt automáticos)

SCHEMA 2 — RefreshToken (src/modules/auth/schemas/refresh-token.schema.ts):
- userId: ObjectId, ref: 'User', required
- token: String, required (armazenar hash do token, não o token bruto)
- expiresAt: Date, required
- timestamps: true

SCHEMA 3 — Transaction (src/modules/transactions/schemas/transaction.schema.ts):
- userId: ObjectId, ref: 'User', required
- type: enum ['EXPENSE', 'INCOME'], required
- value: Number, required, min: 0.01
- categoryId: ObjectId, ref: 'Category', required se type=EXPENSE
- description: String, maxlength 500, optional
- date: Date, required
- timestamps: true
- INDEX: { userId: 1, date: -1 } para performance

SCHEMA 4 — Category (src/modules/categories/schemas/category.schema.ts):
- userId: ObjectId, ref: 'User', optional (null = categoria padrão do sistema)
- name: String, required, trim
- slug: String, required (gerado automaticamente do name em lowercase-kebab)
- icon: String, optional (nome do ícone Lucide)
- color: String, optional (hex)
- isDefault: Boolean, default false
- timestamps: true
- INDEX: { userId: 1 }

SCHEMA 5 — PendingAccount (src/modules/pending/schemas/pending-account.schema.ts):
- userId: ObjectId, ref: 'User', required
- title: String, required, maxlength 200
- value: Number, required, min: 0.01
- dueDate: Date, required
- paid: Boolean, default false
- paidAt: Date, optional
- description: String, optional, maxlength 500
- timestamps: true
- INDEX: { userId: 1, dueDate: 1 }

SCHEMA 6 — Goal (src/modules/goals/schemas/goal.schema.ts):
- userId: ObjectId, ref: 'User', required
- name: String, required, maxlength 200
- targetValue: Number, required, min: 1
- currentValue: Number, default 0, min: 0
- deadline: Date, optional
- completed: Boolean, default false
- timestamps: true

SEED DE CATEGORIAS PADRÃO:
Crie um arquivo src/modules/categories/data/default-categories.ts com array das categorias padrão:
[
  { name: 'Educação', slug: 'educacao', icon: 'GraduationCap', color: '#8B5CF6', isDefault: true },
  { name: 'Eletrônicos', slug: 'eletronicos', icon: 'Laptop', color: '#3B82F6', isDefault: true },
  { name: 'Transferência Conta Própria', slug: 'transferencia-conta-propria', icon: 'ArrowLeftRight', color: '#6B7280', isDefault: true },
  { name: 'Assinaturas Digitais', slug: 'assinaturas-digitais', icon: 'Repeat', color: '#EC4899', isDefault: true },
  { name: 'Cartão de Crédito', slug: 'cartao-credito', icon: 'CreditCard', color: '#F97316', isDefault: true },
  { name: 'Casa', slug: 'casa', icon: 'Home', color: '#14B8A6', isDefault: true },
  { name: 'Comida e Bebida', slug: 'comida-bebida', icon: 'UtensilsCrossed', color: '#F59E0B', isDefault: true },
  { name: 'Compras', slug: 'compras', icon: 'ShoppingBag', color: '#EF4444', isDefault: true },
  { name: 'Contas e Serviços', slug: 'contas-servicos', icon: 'FileText', color: '#64748B', isDefault: true },
  { name: 'Empréstimos', slug: 'emprestimos', icon: 'Banknote', color: '#DC2626', isDefault: true },
  { name: 'Entretenimento', slug: 'entretenimento', icon: 'Tv2', color: '#7C3AED', isDefault: true },
  { name: 'Esportes', slug: 'esportes', icon: 'Dumbbell', color: '#16A34A', isDefault: true },
  { name: 'Impostos', slug: 'impostos', icon: 'Receipt', color: '#9CA3AF', isDefault: true },
  { name: 'Investimento', slug: 'investimento', icon: 'TrendingUp', color: '#A3E635', isDefault: true },
  { name: 'Roupas', slug: 'roupas', icon: 'Shirt', color: '#F472B6', isDefault: true },
  { name: 'Saques', slug: 'saques', icon: 'Wallet', color: '#78716C', isDefault: true },
  { name: 'Saúde e Cuidados Pessoais', slug: 'saude', icon: 'HeartPulse', color: '#06B6D4', isDefault: true },
  { name: 'Serviços Profissionais', slug: 'servicos-profissionais', icon: 'Briefcase', color: '#0EA5E9', isDefault: true },
  { name: 'Supermercado', slug: 'supermercado', icon: 'ShoppingCart', color: '#22C55E', isDefault: true },
  { name: 'Taxas', slug: 'taxas', icon: 'Percent', color: '#A3A3A3', isDefault: true },
  { name: 'Transporte', slug: 'transporte', icon: 'Car', color: '#2563EB', isDefault: true },
  { name: 'Viagens', slug: 'viagens', icon: 'Plane', color: '#0891B2', isDefault: true },
]

Todos os schemas devem usar SchemaFactory.createForFeature() do Mongoose com NestJS.
```

### ✅ Checklist Etapa 2 — Backend
- [ ] Todos os 6 schemas criados sem erros TypeScript
- [ ] Indexes definidos nos schemas de Transaction, Category e PendingAccount
- [ ] Array de categorias padrão criado em `default-categories.ts`
- [ ] `npm run build` compila sem erros

---

## BACKEND — ETAPA 3: Módulo de Autenticação

```
Crie o módulo de autenticação completo no NestJS.
Implemente apenas auth e users — sem tocar nos outros módulos ainda.

MÓDULO USERS (src/modules/users/):
- users.module.ts: registra UserSchema no Mongoose, exporta UsersService
- users.service.ts com métodos:
  - create(dto): cria usuário, hash a senha com bcrypt (saltRounds: 12), gera emailVerificationToken aleatório (crypto.randomBytes(32).toString('hex')), salva emailVerified: false
  - findByEmail(email): busca por email, retorna documento completo (com senha para comparação interna)
  - findById(id): busca por _id, retorna sem o campo password
  - markEmailVerified(userId): seta emailVerified true, limpa emailVerificationToken
  - setPasswordResetToken(email): gera token, define expiração em 1 hora, salva
  - resetPassword(token, newPassword): verifica token e expiração, hash nova senha, limpa campos de reset

MÓDULO AUTH (src/modules/auth/):
- Arquivo de estratégia JWT: src/modules/auth/strategies/jwt.strategy.ts
  - Extrai token do header Authorization Bearer
  - Valida usando JWT_SECRET do .env
  - Payload contém: { sub: userId, email }
  - Retorna user parcial para injetar em req.user
- Arquivo de estratégia Local: src/modules/auth/strategies/local.strategy.ts
  - Valida email + senha usando UsersService + bcrypt.compare
  - Lança UnauthorizedException se credenciais inválidas ou email não verificado

- auth.service.ts com métodos:
  - register(dto): chama users.create(), envia email de verificação via Nodemailer/Resend
  - verifyEmail(token): chama users.markEmailVerified()
  - login(user): gera accessToken (JWT_SECRET, 15min), gera refreshToken (JWT_REFRESH_SECRET, 7d), salva HASH do refreshToken no schema RefreshToken (bcrypt hash com salt 10)
  - refresh(userId, rawRefreshToken): busca RefreshTokens do userId, compara bcrypt com cada hash, se válido gera novo par de tokens (rotate refresh token: apaga o antigo, cria novo)
  - logout(userId, refreshToken): remove o refreshToken do banco
  - forgotPassword(email): chama users.setPasswordResetToken(), envia email com link de reset
  - resetPassword(token, newPassword): chama users.resetPassword()
  - me(userId): retorna dados do usuário sem senha

- auth.controller.ts com rotas:
  - POST /api/auth/register — body: { email, password }
  - GET /api/auth/verify-email?token= — verifica email
  - POST /api/auth/login — body: { email, password } — usa LocalAuthGuard
  - POST /api/auth/refresh — body: { refreshToken } — não usa JwtAuthGuard (token pode estar expirado)
  - POST /api/auth/logout — protegido com JwtAuthGuard — body: { refreshToken }
  - POST /api/auth/forgot-password — body: { email }
  - POST /api/auth/reset-password — body: { token, newPassword }
  - GET /api/auth/me — protegido com JwtAuthGuard

- DTOs com class-validator:
  - RegisterDto: email (IsEmail), password (MinLength 8, tem letra maiúscula e número — use @Matches)
  - LoginDto: email, password
  - RefreshTokenDto: refreshToken (IsString, IsNotEmpty)
  - ForgotPasswordDto: email
  - ResetPasswordDto: token, newPassword (mesmas regras de RegisterDto)

GUARD REUTILIZÁVEL:
- Crie src/common/guards/jwt-auth.guard.ts que estende AuthGuard('jwt') do Passport
- Crie decorator src/common/decorators/current-user.decorator.ts para extrair req.user

SEGURANÇA:
- NUNCA retorne o campo password em nenhuma resposta
- NUNCA armazene o refreshToken em texto puro — sempre hash bcrypt
- O emailVerificationToken e passwordResetToken também não devem ser retornados em respostas de API

EMAIL SERVICE:
- Crie src/common/services/email.service.ts
- Use Nodemailer com configuração via ConfigService (.env)
- Métodos: sendVerificationEmail(to, token), sendPasswordResetEmail(to, token)
- Links usam FRONTEND_URL do .env: ex: `${FRONTEND_URL}/verify-email?token=${token}`
- Envolva os envios em try/catch para não quebrar o fluxo em caso de falha de email
```

### ✅ Checklist Etapa 3 — Backend
- [ ] `POST /api/auth/register` cria usuário e retorna 201
- [ ] Senha está sendo hashada com bcrypt (verificar no MongoDB Compass)
- [ ] `POST /api/auth/login` retorna accessToken + refreshToken
- [ ] RefreshToken está salvo como HASH no banco (não texto puro)
- [ ] `GET /api/auth/me` com Bearer token retorna dados do usuário sem senha
- [ ] `POST /api/auth/refresh` gera novo par de tokens
- [ ] `POST /api/auth/logout` remove refreshToken do banco
- [ ] EmailService não quebra a aplicação se o servidor de email não estiver configurado
- [ ] `npm run build` sem erros

---

## BACKEND — ETAPA 4: Módulos de Negócio (Transactions, Categories, Pending, Goals)

```
Crie os quatro módulos de negócio. Todos devem ser multi-tenant:
REGRA OBRIGATÓRIA: em toda query ao banco, SEMPRE filtrar por userId extraído do JWT (req.user.sub).
Nunca confiar em userId vindo do body da request.

MÓDULO CATEGORIES (src/modules/categories/):
- Ao registrar o módulo, no onModuleInit do service, verificar se já existem categorias padrão no banco (isDefault: true). Se não existirem, fazer seed das 22 categorias padrão (import do arquivo criado na etapa 2).
- GET /api/categories — retorna categorias padrão (userId: null) + categorias do usuário autenticado
- POST /api/categories — cria categoria personalizada com userId do token
  - CreateCategoryDto: name (required, max 100), icon (optional), color (optional, hex válido via @Matches(/#[0-9A-Fa-f]{6}/))
  - Gerar slug automaticamente: name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')
- Todas as rotas protegidas com JwtAuthGuard

MÓDULO TRANSACTIONS (src/modules/transactions/):
- POST /api/transactions
  - CreateTransactionDto: type (EXPENSE|INCOME), value (positive number), categoryId (required se EXPENSE), description (optional, max 500), date (ISO date string)
  - Validar que categoryId existe e pertence ao usuário ou é padrão do sistema
- GET /api/transactions com query params:
  - type?: 'EXPENSE' | 'INCOME' | 'all'
  - categoryId?: string
  - month?: number (1-12)
  - year?: number
  - page?: number (default 1)
  - limit?: number (default 20, max 100)
  - Ordenação: date desc
  - Retornar: { data: Transaction[], total, page, limit }
- GET /api/transactions/:id — verifica que transaction.userId === req.user.sub
- PATCH /api/transactions/:id — UpdateTransactionDto (todos campos opcionais) — verifica userId
- DELETE /api/transactions/:id — verifica userId
- Todas as rotas protegidas com JwtAuthGuard

MÓDULO PENDING (src/modules/pending/):
- POST /api/pending — CreatePendingDto: title (required, max 200), value (positive), dueDate (ISO date), description (optional)
- GET /api/pending — query: paid? (boolean filter), ordenar por dueDate asc
- PATCH /api/pending/:id — UpdatePendingDto: todos campos opcionais, inclui paid (boolean). Se paid=true, setar paidAt = new Date()
- DELETE /api/pending/:id
- Todas as rotas protegidas com JwtAuthGuard, verificação de userId em cada operação

MÓDULO GOALS (src/modules/goals/):
- POST /api/goals — CreateGoalDto: name (required, max 200), targetValue (min 1), currentValue (optional, default 0), deadline (optional ISO date)
- GET /api/goals — retorna todas as metas do usuário, incluir campo calculado: percentComplete = Math.round((currentValue/targetValue)*100)
- PATCH /api/goals/:id — UpdateGoalDto: todos opcionais. Se currentValue >= targetValue após update, setar completed: true automaticamente
- DELETE /api/goals/:id
- Todas as rotas protegidas com JwtAuthGuard, verificação de userId

PADRÃO DE RESPOSTA DE ERRO:
Em todos os módulos, usar exceções padrão do NestJS:
- NotFoundException (404) quando recurso não encontrado ou não pertence ao usuário
- BadRequestException (400) para dados inválidos
- ForbiddenException (403) para acesso negado (não vazar que o recurso existe — usar 404)
```

### ✅ Checklist Etapa 4 — Backend
- [ ] Seed de categorias padrão executado automaticamente na primeira inicialização
- [ ] GET /api/categories retorna categorias padrão + do usuário (autenticado)
- [ ] POST /api/transactions cria transação vinculada ao userId do token
- [ ] GET /api/transactions sem token retorna 401
- [ ] Tentar acessar transaction de outro usuário retorna 404 (não 403 — não vazar existência)
- [ ] Paginação funcionando em GET /api/transactions
- [ ] PATCH /api/pending/:id com paid:true seta paidAt automaticamente
- [ ] PATCH /api/goals/:id: currentValue >= targetValue seta completed: true
- [ ] `npm run build` sem erros

---

## BACKEND — ETAPA 5: Dashboard e Configuração Final

```
Implemente o módulo de dashboard com agregações MongoDB e finalize a configuração para deploy.

MÓDULO DASHBOARD (src/modules/dashboard/):
- GET /api/dashboard?month=&year= — protegido com JwtAuthGuard

Implemente as seguintes agregações com userId obrigatório em todos os $match:

1. totalIncome: soma de todas as transactions type=INCOME do mês/ano
2. totalExpenses: soma de todas as transactions type=EXPENSE do mês/ano
3. balance: totalIncome - totalExpenses
4. expensesByCategory: array com { categoryId, categoryName, categoryColor, categoryIcon, total, percentage }
   - Usar $lookup para enriquecer com dados da Category
   - Ordenar por total desc
5. monthlyEvolution: para o ano inteiro (independente do filtro de mês), retornar array de 12 meses:
   [{ month: 1, income: 0, expenses: 0 }, ...]
6. pendingAccounts: contas com paid=false e dueDate até fim do mês atual, com total em aberto
7. goalsSummary: todas as metas do usuário com percentComplete
8. savingsRate: (totalIncome > 0) ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0

Resposta do endpoint:
{
  month, year,
  totalIncome, totalExpenses, balance, savingsRate,
  expensesByCategory: [...],
  monthlyEvolution: [...],
  pendingAccounts: { items: [...], totalPending },
  goalsSummary: [...]
}

SWAGGER DOCUMENTATION:
- Configure SwaggerModule no main.ts apenas em NODE_ENV !== 'production'
- Rota: /api/docs
- Título: ContaCerta API
- Adicione @ApiTags e @ApiBearerAuth nos controllers principais

RATE LIMITING ESPECÍFICO:
- Auth endpoints (login, register, forgot-password): 5 requests por minuto por IP
  Use @Throttle({ default: { limit: 5, ttl: 60000 } }) no controller de auth

VALIDAÇÃO FINAL E SANITIZAÇÃO:
- Confirme que ValidationPipe está com transform: true e transformOptions: { enableImplicitConversion: true }
- Adicione @Transform(() => sanitizeHtml(value)) nos campos de description e title
  (instale sanitize-html e @types/sanitize-html)

VARIÁVEIS DE AMBIENTE — revisão final:
Confirme que TODAS as conexões com MongoDB, JWT secrets e configurações de email usam ConfigService e NUNCA têm valores hardcoded no código.

Gere o README.md do backend com:
- Instruções de setup local (clonar, instalar dependências, configurar .env, rodar)
- Lista de todas as variáveis de ambiente com descrição
- Como fazer deploy na Vercel (vercel.json já configurado)
- Endpoints disponíveis (resumo)
```

### ✅ Checklist Etapa 5 — Backend
- [ ] GET /api/dashboard?month=6&year=2025 retorna todos os campos esperados
- [ ] Aggregations usam userId em todos os $match
- [ ] Swagger disponível em /api/docs (ambiente dev)
- [ ] Nenhum valor hardcoded de secret ou connection string no código-fonte
- [ ] README.md gerado com instruções completas
- [ ] `npm run build` limpo
- [ ] Deploy de teste na Vercel funcionando (ou simulado com `vercel dev`)

---

# ══════════════════════════════════
# 🎨 FRONTEND — LOVABLE (Etapas 1–4) + CODEX (Etapas 5–7)
# ══════════════════════════════════

> **Atenção**: As etapas 1 a 4 são para o **Lovable**. Quando os tokens acabarem,
> exporte o projeto do Lovable, configure localmente e continue com **Codex** nas etapas 5 a 7.

---

## FRONTEND — ETAPA 1: Scaffold, Design System e Autenticação (Lovable)

```
Crie um projeto React do zero com Vite + TypeScript + Tailwind CSS para um app de finanças pessoais chamado ContaCerta.

STACK:
- React 18 + TypeScript (strict)
- Vite
- Tailwind CSS
- react-router-dom v6
- lucide-react (ícones)
- recharts (gráficos)
- date-fns (datas)
- clsx (classes condicionais)
- axios (requisições HTTP)
- react-hook-form + zod (formulários e validação)
- @tanstack/react-query (cache e estado servidor)

DESIGN SYSTEM — configure o tailwind.config.ts exatamente assim:
colors: {
  bg: {
    base:    '#0A0A0A',
    card:    '#141414',
    muted:   '#1C1C1C',
    overlay: '#232323',
  },
  accent: {
    lime:   '#A3E635',
    orange: '#F97316',
    red:    '#EF4444',
    yellow: '#EAB308',
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
},
borderRadius: { card: '16px', pill: '9999px', icon: '12px' },
fontFamily: {
  sans:  ['Syne', 'sans-serif'],
  body:  ['DM Sans', 'sans-serif'],
}
Importe as fontes Syne e DM Sans do Google Fonts no index.html.

VARIÁVEIS DE AMBIENTE:
- Crie .env.example com: VITE_API_URL=http://localhost:3000
- Crie src/lib/api.ts com instância do axios configurada para usar VITE_API_URL como baseURL
- Adicione interceptor de request para injetar Authorization: Bearer {accessToken} do localStorage
- Adicione interceptor de response para, em caso de 401, tentar refresh automático do token, e se falhar redirecionar para /login

GERENCIAMENTO DE AUTH (src/lib/auth.ts):
- Funções: getAccessToken(), setTokens(access, refresh), clearTokens()
- Armazenar accessToken em memória (variável de módulo) e refreshToken no localStorage
  IMPORTANTE: accessToken NUNCA no localStorage (vulnerável a XSS)
- Função refreshAccessToken() que chama POST /api/auth/refresh

ESTRUTURA DE ROTAS (src/App.tsx):
- / → redirect para /dashboard se autenticado, senão /login
- /login
- /register
- /verify-email
- /forgot-password
- /reset-password
- /dashboard (protegido)
- /expenses (protegido)
- /transactions (protegido)
- /budget (protegido)
- /goals (protegido)
- /pending (protegido)
Criar PrivateRoute component que redireciona para /login se não autenticado.

TELA DE LOGIN (src/pages/LoginPage.tsx):
Layout centralizado, fundo bg-base, card bg-card rounded-2xl shadow-xl max-w-sm mx-auto mt-20 p-8
- Logo/nome "ContaCerta" no topo com ícone de moeda (lucide: Coins) em accent-lime
- Título: "Bem-vindo de volta" (fonte Syne, text-2xl, text-white)
- Subtítulo: "Gerencie suas finanças com inteligência" (text-secondary, text-sm)
- Campo Email: input estilizado com borda bg-muted, foco em accent-lime, ícone Mail à esquerda
- Campo Senha: input com toggle de visibilidade (Eye/EyeOff), ícone Lock à esquerda
- Link "Esqueci minha senha" alinhado à direita em accent-lime
- Botão "Entrar": bg-accent-lime text-black font-semibold rounded-pill w-full py-3 hover:brightness-110
- Spinner de loading no botão durante submissão
- Link "Criar conta" no rodapé
- Validação com zod: email válido, senha mínimo 8 caracteres
- Exibir erro da API em toast/alert abaixo do formulário
- Em sucesso: salvar tokens, redirecionar para /dashboard

TELA DE CADASTRO (src/pages/RegisterPage.tsx):
- Mesma estrutura do login
- Campos: Email, Senha, Confirmar Senha
- Validação: email válido, senha min 8 + 1 maiúscula + 1 número, confirmação igual
- Em sucesso: mostrar mensagem "Verifique seu email para confirmar o cadastro"

TELA DE VERIFICAÇÃO DE EMAIL (src/pages/VerifyEmailPage.tsx):
- Lê query param ?token= da URL
- Faz GET /api/auth/verify-email?token= automaticamente ao montar
- Loading state, success state, error state com mensagens claras

TELA ESQUECI SENHA (src/pages/ForgotPasswordPage.tsx):
- Campo email + botão enviar
- Sucesso: "Se este email estiver cadastrado, você receberá as instruções"

TELA RESET SENHA (src/pages/ResetPasswordPage.tsx):
- Lê ?token= da URL
- Campos: nova senha + confirmação
- Chama POST /api/auth/reset-password
```

### ✅ Checklist Etapa 1 — Frontend
- [ ] Tailwind configurado com todas as cores e fontes do design system
- [ ] Google Fonts (Syne + DM Sans) carregando
- [ ] Axios configurado com interceptors de auth
- [ ] accessToken em memória, refreshToken no localStorage apenas
- [ ] Login funciona e redireciona para /dashboard
- [ ] Cadastro mostra mensagem de verificação de email
- [ ] PrivateRoute redireciona para /login sem token
- [ ] Erros da API exibidos ao usuário
- [ ] Loading states em todos os botões de submit

---

## FRONTEND — ETAPA 2: Layout Global e Dashboard (Lovable)

```
Implemente o layout principal do app autenticado e a tela de Dashboard.

LAYOUT PRINCIPAL (src/components/layout/AppLayout.tsx):
Wrapper para todas as páginas protegidas com:

SIDEBAR (desktop, lg:flex hidden):
- Largura fixa w-64, fundo bg-card, altura full, fixed à esquerda
- Logo "ContaCerta" + ícone Coins em accent-lime no topo (padding p-6)
- Menu de navegação com itens:
  - Dashboard (LayoutDashboard icon) → /dashboard
  - Gastos (TrendingDown icon) → /expenses
  - Ganhos (TrendingUp icon) → /transactions?type=INCOME
  - Transações (List icon) → /transactions
  - Contas Pendentes (Clock icon) → /pending
  - Metas Financeiras (Target icon) → /goals
- Item ativo: bg-bg-muted rounded-xl text-white, ícone em accent-lime
- Item inativo: text-text-secondary hover:text-white hover:bg-bg-overlay transition
- Rodapé da sidebar: avatar do usuário + email + botão logout

BOTTOM NAVIGATION (mobile, lg:hidden):
- Fixed bottom-0, w-full, bg-card, border-t border-bg-muted
- Ícones: Home, BarChart2, botão central "+", Clock, Target
- Botão central "+": bg-accent-lime rounded-full w-12 h-12 -mt-6 shadow shadow-lime-500/20
- Ao clicar no "+": abrir modal de escolha entre "Adicionar Gasto" ou "Adicionar Ganho"
- Item ativo: text-accent-lime, inativo: text-text-muted

HEADER MOBILE (mobile, lg:hidden):
- bg-card border-b border-bg-muted px-5 py-3
- Nome da página atual à esquerda
- Avatar + menu dropdown à direita (logout, tema)

CONTEÚDO PRINCIPAL:
- lg:ml-64, min-h-screen, bg-bg-base, p-5 pb-24 (espaço para bottom nav no mobile)

TELA DASHBOARD (src/pages/DashboardPage.tsx):
Usar useQuery do @tanstack/react-query para buscar GET /api/dashboard?month=&year=

SELETOR DE PERÍODO no topo:
- Dois selects lado a lado: mês (Jan-Dez) + ano (últimos 3 anos + atual)
- Estilizados com bg-bg-card border border-bg-muted rounded-xl text-white

HERO BALANCE:
- Label "Saldo" em text-secondary uppercase tracking-widest text-sm
- Valor formatado em BRL (Intl.NumberFormat 'pt-BR', style: 'currency')
- Valor: text-5xl font-extrabold text-accent-lime (fonte Syne)
- Abaixo: "Entradas: R$ X" (text-accent-lime) e "Saídas: R$ Y" (text-accent-red) em linha

CARDS DE RESUMO (grid 2 colunas mobile, 4 colunas desktop):
- Card Entradas: ícone TrendingUp accent-lime, valor, label
- Card Saídas: ícone TrendingDown accent-red, valor, label
- Card Contas Pendentes: ícone Clock accent-yellow, valor total pendente, link para /pending
- Card Taxa de Poupança: ícone PiggyBank accent-lime, percentual%
- Cada card: bg-card rounded-2xl p-4

GRÁFICO DE EVOLUÇÃO MENSAL (AreaLineChart):
- recharts ResponsiveContainer + AreaChart
- Duas áreas: Entradas (stroke accent-lime, fill com gradiente lime/10%) e Saídas (stroke accent-orange, fill gradiente orange/10%)
- Eixo X: meses abreviados, eixo Y: valores em K (ex: 2.5K)
- Tooltip customizado: fundo bg-card, texto white, rounded-xl
- Legenda simples: dois pontos coloridos + labels

GASTOS POR CATEGORIA (seção):
- Título "Gastos por Categoria"
- Grid de cards de categoria: ícone (cor da categoria), nome, valor, barra de progresso proporcional ao maior gasto
- Dinâmico: renderizar apenas as categorias retornadas pela API
- Máximo 6 categorias exibidas, link "Ver todas" para /expenses

TRANSAÇÕES RECENTES:
- Título "Últimas Transações" + link "Ver todas" → /transactions
- Lista das últimas 5 transactions
- Cada item: ícone da categoria com bg da cor, nome da categoria, descrição (se houver), data formatada (dd/MM), valor (vermelho se EXPENSE, lime se INCOME)

LOADING STATE:
- Skeleton loaders para cada seção enquanto carrega (retângulos animados com pulse bg-bg-muted)

EMPTY STATE:
- Se nenhuma transaction no período: ilustração simples (SVG inline de carteira vazia) + texto "Nenhuma movimentação este mês" + botão "Adicionar primeiro gasto"
```

### ✅ Checklist Etapa 2 — Frontend
- [ ] Sidebar visível no desktop, oculta no mobile
- [ ] Bottom nav visível no mobile, oculta no desktop
- [ ] Dashboard busca dados da API com mês/ano corretos
- [ ] Saldo exibido em formato BRL
- [ ] Gráfico de evolução mensal renderizando
- [ ] Skeleton loaders durante carregamento
- [ ] Empty state quando sem dados
- [ ] Responsivo: testar em 375px e 1280px

---

## FRONTEND — ETAPA 3: Transações, Gastos e Formulários (Lovable)

```
Implemente as telas de Transações e Gastos, e os modais de adição.

MODAL DE ADICIONAR GASTO (src/components/modals/AddExpenseModal.tsx):
- Dialog/Modal com fundo backdrop-blur
- Título "Novo Gasto" com ícone TrendingDown accent-red
- Campos com react-hook-form + zod:
  - Valor: input numérico grande e centralizado (texto accent-lime text-3xl), prefixo "R$"
  - Categoria: grid de botões visuais (ícone + nome), um por categoria disponível, seleção ativa destaca com borda accent-lime
    - Buscar categorias de GET /api/categories
    - Scroll vertical se muitas categorias (max-h-48 overflow-y-auto)
  - Data: date input, default hoje, estilizado
  - Descrição: textarea opcional, max 500 chars, contador de caracteres
- Botão "Salvar Gasto": bg-accent-lime, chama POST /api/transactions com type: EXPENSE
- Loading spinner, erro inline, sucesso fecha modal e invalida query do dashboard

MODAL DE ADICIONAR GANHO (src/components/modals/AddIncomeModal.tsx):
- Mesma estrutura do modal de gasto
- Título "Novo Ganho" com ícone TrendingUp accent-lime
- SEM campo de categoria (income não categorizado)
- Campos: Valor, Data, Descrição (opcional)
- Chama POST /api/transactions com type: INCOME

COMPONENTE TransactionRow (src/components/TransactionRow.tsx):
Reutilizável, props: transaction (com dados da categoria enriquecidos pelo backend)
- Container: flex items-center gap-3 py-3 border-b border-bg-muted
- Ícone: w-10 h-10 rounded-xl bg-[category.color]/20, ícone Lucide da categoria em [category.color]
  (use DynamicIcon component que resolve nome string → componente Lucide)
- Coluna central: nome da categoria (text-white text-sm font-medium), descrição (text-secondary text-xs), data (text-muted text-xs)
- Valor: text-sm font-semibold, negativo (vermelho) com "-R$X", positivo (lime) com "+R$X"
- Menu de ações ao long press/hover: ícones Edit2 e Trash2 (abrir modais de edição/confirmação de exclusão)

TELA TRANSAÇÕES (src/pages/TransactionsPage.tsx):
- Header: título + botão "+" (abre modal)
- Tabs: [Todos] [Gastos] [Ganhos] — filtram type na query
- Filtros colapsáveis: por categoria (select), por mês/ano
- Lista agrupada por data (dd 'de' MMMM — ex: "15 de junho"):
  - Cada grupo: label da data em text-muted uppercase, seguido de TransactionRows
- Paginação: botão "Carregar mais" (não paginação numérica)
- Estado vazio: "Nenhuma transação encontrada"
- EDIÇÃO: ao clicar em editar, abrir modal preenchido com dados da transaction (PATCH /api/transactions/:id)
- EXCLUSÃO: dialog de confirmação "Tem certeza? Esta ação não pode ser desfeita" antes de DELETE

TELA GASTOS POR CATEGORIA (src/pages/ExpensesPage.tsx):
- Tabs de período: [Semanal] [Mensal] [Anual]
- Donut Chart (recharts PieChart): categorias com cores, centro mostra categoria de maior gasto
- Legenda à direita do chart: lista de categorias com bolinha colorida + nome + valor
- Lista de CategoryRows abaixo do chart:
  - Ícone colorido, nome, valor total no período, % de variação vs período anterior (↑ vermelho se aumentou, ↓ lime se reduziu)
  - Clicável: filtra /transactions?categoryId=X

MODAL DE EDIÇÃO (src/components/modals/EditTransactionModal.tsx):
- Igual ao modal de criação porém pré-preenchido
- Chama PATCH /api/transactions/:id
- Mesmo esquema de validação zod
```

### ✅ Checklist Etapa 3 — Frontend
- [ ] Modal de gasto abre e fecha corretamente
- [ ] Categorias carregam dinamicamente no modal
- [ ] POST /api/transactions funciona e atualiza a lista
- [ ] TransactionRow exibe ícone da categoria corretamente
- [ ] Edição pré-preenche os campos
- [ ] Exclusão pede confirmação antes de deletar
- [ ] Tabs de tipo (Todos/Gastos/Ganhos) filtram a lista
- [ ] Donut chart exibindo no ExpensesPage

---

## FRONTEND — ETAPA 4: Contas Pendentes, Metas e Perfil (Lovable)

```
Implemente as últimas telas do app.

TELA CONTAS PENDENTES (src/pages/PendingPage.tsx):
- Header: "Contas Pendentes" + botão "+"
- Resumo no topo: total em aberto (accent-red) e total pago no mês (accent-lime)
- Lista de contas ordenada por dueDate ASC:
  - Card por conta: título, valor, data de vencimento formatada
  - Cor do card: se vencida (dueDate < hoje e paid=false): borda border-accent-red/50; se vence hoje: borda accent-yellow/50; se paga: opacity-50
  - Badge de status: "Vencida" (bg-red/20 text-red), "Vence hoje" (bg-yellow/20 text-yellow), "Pendente" (bg-muted), "Pago" (bg-lime/20 text-lime)
  - Botão "Marcar como pago" (check verde) — chama PATCH /api/pending/:id { paid: true }
  - Botões editar e excluir
- Modal de adicionar conta: title, value, dueDate, description (opcional)
- Modal de editar conta: pré-preenchido

TELA METAS FINANCEIRAS (src/pages/GoalsPage.tsx):
- Header: "Metas Financeiras" + botão "+"
- Grid de cards de meta (1 coluna mobile, 2 colunas desktop):
  - Nome da meta (text-white font-semibold)
  - Barra de progresso circular (SVG stroke-dasharray/dashoffset) com percentual no centro
    - Cor: verde se < 70%, amarelo se 70-90%, lima se >= 100% (concluída)
  - Valores: "R$ currentValue de R$ targetValue"
  - Deadline formatado: "Meta: 31/12/2025" ou "Sem prazo"
  - Se completed: badge "Concluída 🎉" + card com borda accent-lime/30
  - Botão "Atualizar valor" (abre modal simples com input numérico para incrementar currentValue)
  - Botões editar e excluir
- Modal "Nova Meta": name, targetValue, currentValue (opcional, default 0), deadline (opcional)

PERFIL / CONFIGURAÇÕES (src/components/layout/UserMenu.tsx — dropdown):
- Já integrado no AppLayout
- Itens: "Meu Perfil", toggle Tema (apenas visual por ora), "Sair"
- "Sair": chama POST /api/auth/logout, clearTokens(), redireciona /login

TEMA DARK/LIGHT (opcional, implementar estrutura):
- Criar ThemeContext com dark (default) e light
- Light theme: inverter cores base (branco, cinza claro) mantendo accent-lime
- Salvar preferência no localStorage sob key 'theme'
- Aplicar classe 'dark' ou 'light' no <html>

FEEDBACK GLOBAL (src/components/ui/Toast.tsx):
- Toast notifications para: sucesso em operações CRUD, erros de API, expiração de sessão
- Posição: top-right desktop, bottom-center mobile
- Variants: success (borda lime), error (borda red), warning (borda yellow)
- Auto-dismiss em 4 segundos
- Implementar como context + hook: useToast()
```

### ✅ Checklist Etapa 4 — Frontend
- [ ] Contas pendentes exibindo com cores de status corretas
- [ ] "Marcar como pago" funciona e atualiza status na UI
- [ ] Barras de progresso circulares das metas renderizando
- [ ] Meta concluída automaticamente ao atingir 100%
- [ ] Toast notifications para todas as operações
- [ ] Logout limpa tokens e redireciona para /login
- [ ] App totalmente navegável no mobile (testar no DevTools 375px)

---

> ⚠️ PONTO DE TRANSIÇÃO: a partir daqui, use o **Codex** com o código exportado do Lovable.
> Configure o projeto localmente, instale dependências, verifique se compila.
> Então continue com as etapas abaixo.

---

## FRONTEND — ETAPA 5: Integração Real com Backend (Codex)

```
O projeto React foi gerado no Lovable. Agora preciso:

1. CONFIGURAR VARIÁVEIS DE AMBIENTE:
   - Criar/verificar .env com VITE_API_URL apontando para a URL do backend no Vercel
   - Confirmar que src/lib/api.ts usa import.meta.env.VITE_API_URL

2. REVISAR TODOS OS ENDPOINTS:
   Auditar cada chamada de API no projeto e garantir que os paths batem com os do backend:
   - Auth: /api/auth/login, /api/auth/register, /api/auth/refresh, /api/auth/logout, /api/auth/me
   - Transactions: /api/transactions (com query params corretos)
   - Categories: /api/categories
   - Dashboard: /api/dashboard?month=X&year=Y
   - Pending: /api/pending
   - Goals: /api/goals

3. TIPOS TYPESCRIPT:
   Criar src/types/api.ts com interfaces que espelham exatamente os responses do backend:
   - User, AuthTokens, Transaction, Category, PendingAccount, Goal, DashboardResponse
   Tipar todos os useQuery e useMutation do @tanstack/react-query

4. TRATAMENTO DE ERROS:
   - Erros de validação do backend vêm como { message: string[] } (array do class-validator)
   - Exibir cada mensagem de erro individualmente nos formulários
   - Erro 401: limpar tokens e redirecionar /login
   - Erros 500: toast genérico "Algo deu errado. Tente novamente."

5. REFRESH TOKEN FLOW:
   Verificar e corrigir se necessário o interceptor do axios:
   - Em resposta 401, tentar POST /api/auth/refresh com o refreshToken do localStorage
   - Se sucesso: atualizar accessToken em memória, repetir request original
   - Se falha: clearTokens(), redirecionar /login
   - Usar fila de requests pendentes durante o refresh para não fazer múltiplos refreshes simultâneos

6. REACT QUERY CONFIGURATION:
   - Configurar QueryClient com: staleTime: 1000 * 60 * 2 (2 min), retry: 1
   - Invalidar queries relacionadas após mutações (ex: criar transaction → invalidar 'transactions' e 'dashboard')
   - Usar queryKeys consistentes: ['dashboard', month, year], ['transactions', filters], etc.

7. TESTAR FLUXO COMPLETO:
   - Registrar novo usuário → verificar email → fazer login → criar gasto → ver no dashboard
   - Confirmar que os dados do backend aparecem corretamente formatados na UI
```

### ✅ Checklist Etapa 5 — Frontend
- [ ] VITE_API_URL configurado para URL do backend em produção
- [ ] Todos os endpoints batem com as rotas do backend
- [ ] Tipos TypeScript criados e usados nas queries
- [ ] Fluxo de refresh token funcionando (testar expirando o accessToken manualmente)
- [ ] Erros de validação exibidos por campo nos formulários
- [ ] Fluxo completo register → verify → login → usar app funcionando

---

## FRONTEND — ETAPA 6: Performance, Acessibilidade e PWA (Codex)

```
Finalize o frontend com qualidade de produção.

PERFORMANCE:
1. Code splitting por rota — garantir que React.lazy e Suspense envolvem cada page component
   Exemplo: const DashboardPage = lazy(() => import('./pages/DashboardPage'))
2. Verificar que imagens (se houver) usam loading="lazy"
3. Memoizar componentes pesados: TransactionRow com React.memo
4. Evitar re-renders desnecessários: verificar que os queryKeys são estáveis

ACESSIBILIDADE:
1. Todos os inputs com label associado (<label htmlFor> ou aria-label)
2. Botões de ícone apenas: adicionar aria-label descritivo
3. Modais: foco armadilhado dentro do modal enquanto aberto (usar um lib como @radix-ui/react-dialog se não já usado)
4. Cores: verificar contraste (accent-lime #A3E635 sobre bg-base #0A0A0A = ratio ~9:1 ✓)
5. Navegação por teclado: Tab, Enter, Escape funcionando em modais e dropdowns

FORMATAÇÃO DE DADOS:
1. Todos os valores monetários: Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
2. Datas: date-fns/locale ptBR — importar e usar em todos os format() calls
3. Percentuais: número.toFixed(1) + '%'

VERCEL DEPLOY DO FRONTEND:
1. Criar vercel.json na raiz do projeto frontend:
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   (necessário para react-router funcionar no Vercel)
2. Garantir que o build script é: "build": "tsc && vite build"
3. Variáveis de ambiente no painel Vercel: VITE_API_URL = URL do backend

SEGURANÇA DO FRONTEND:
1. Confirmar: accessToken APENAS em memória (módulo JS), NUNCA em localStorage/cookie
2. refreshToken no localStorage (aceitável, pois rotacionado a cada uso)
3. Não logar tokens em console.log
4. Dependências: rodar `npm audit` e corrigir vulnerabilidades críticas

README.md do frontend:
- Setup local
- Variáveis de ambiente necessárias
- Como fazer deploy no Vercel
- Estrutura de pastas
```

### ✅ Checklist Etapa 6 — Frontend
- [ ] Code splitting implementado (verificar Network tab — chunks separados por rota)
- [ ] Todos os inputs com labels acessíveis
- [ ] Modais com foco armadilhado e fecha com Escape
- [ ] Datas em pt-BR em toda a aplicação
- [ ] vercel.json com rewrite para SPA
- [ ] Deploy no Vercel funcionando
- [ ] `npm audit` sem vulnerabilidades críticas
- [ ] accessToken não aparece no localStorage (inspecionar Application no DevTools)

---

## FRONTEND — ETAPA 7: Testes de Integração Final (Codex)

```
Realize os testes de integração ponta a ponta entre frontend e backend em produção.

CHECKLIST DE FLUXOS CRÍTICOS:

AUTH:
- [ ] Cadastro com email inválido mostra erro correto
- [ ] Cadastro com senha fraca mostra erro correto
- [ ] Email de verificação enviado após cadastro
- [ ] Verificação de email via link funciona
- [ ] Login com credenciais erradas mostra "Credenciais inválidas"
- [ ] Login com email não verificado mostra aviso adequado
- [ ] Recuperação de senha envia email
- [ ] Reset de senha com token expirado mostra erro
- [ ] Logout limpa tokens e redireciona

TRANSACTIONS:
- [ ] Criar gasto com categoria aparece no dashboard
- [ ] Criar ganho aparece no dashboard
- [ ] Editar transaction atualiza na lista
- [ ] Deletar transaction remove da lista e atualiza dashboard
- [ ] Filtro por tipo (gasto/ganho) funciona
- [ ] Paginação "carregar mais" funciona

DASHBOARD:
- [ ] Mudar mês/ano atualiza todos os dados
- [ ] Saldo = total ganhos - total gastos do período
- [ ] Gráfico de evolução mensal reflete o ano atual
- [ ] Gastos por categoria somam corretamente

PENDING:
- [ ] Criar conta pendente aparece na lista
- [ ] Marcar como pago atualiza badge e resumo
- [ ] Conta vencida exibe badge vermelho

GOALS:
- [ ] Criar meta com targetValue aparece com 0%
- [ ] Atualizar valor incrementa barra de progresso
- [ ] Atingir 100% marca como concluída

SEGURANÇA:
- [ ] Acessar /dashboard sem token redireciona para /login
- [ ] Token expirado: refresh automático ocorre sem logout do usuário
- [ ] Tentar acessar dados de outro usuário retorna 404 (testar via DevTools / Postman)

Se algum item falhar, descreva o erro e o que precisa ser corrigido no backend ou frontend.
```

---

# 📋 ORDEM DE EXECUÇÃO RECOMENDADA

```
1. Backend Etapa 1 → validar → Backend Etapa 2 → validar
2. Backend Etapa 3 → validar (login funcionando com Postman/Insomnia)
3. Backend Etapa 4 → validar (CRUD completo testado)
4. Backend Etapa 5 → validar → deploy backend no Vercel

5. Frontend Etapa 1 (Lovable) → validar (telas de auth)
6. Frontend Etapa 2 (Lovable) → validar (dashboard com mock data)
7. Frontend Etapa 3 (Lovable) → validar
8. Frontend Etapa 4 (Lovable) → validar → exportar projeto do Lovable

9. Frontend Etapa 5 (Codex) → integrar com backend real → validar
10. Frontend Etapa 6 (Codex) → deploy frontend no Vercel
11. Frontend Etapa 7 (Codex) → testes finais ponta a ponta
```

---

# 🔐 Variáveis de Ambiente — Referência Rápida

| Variável | Onde | Descrição |
|---|---|---|
| `MONGODB_URI` | Backend | String de conexão do MongoDB Atlas |
| `JWT_SECRET` | Backend | Secret do access token (mín. 32 chars aleatórios) |
| `JWT_REFRESH_SECRET` | Backend | Secret do refresh token (diferente do access) |
| `JWT_EXPIRES_IN` | Backend | Expiração do access token (ex: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Backend | Expiração do refresh token (ex: `7d`) |
| `EMAIL_HOST` | Backend | Host SMTP |
| `EMAIL_PORT` | Backend | Porta SMTP |
| `EMAIL_USER` | Backend | Usuário SMTP |
| `EMAIL_PASS` | Backend | Senha SMTP |
| `EMAIL_FROM` | Backend | Remetente dos emails |
| `FRONTEND_URL` | Backend | URL do frontend (para links nos emails e CORS) |
| `NODE_ENV` | Backend | `development` ou `production` |
| `VITE_API_URL` | Frontend | URL base do backend |

> ⚠️ **NUNCA commitar o arquivo `.env` no Git.** Adicionar ao `.gitignore` desde a Etapa 1.
