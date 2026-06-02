## Estrutura uSolutions
 
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
