# Estrutura uSolutions

_Estrutura de projeto._

---

## Visão geral

Sistema web para controle de gastos mostrando o quanto que o usuario esta gastando, que possa abranger diversas categorias as quais inclui custos diversos.
Com compatibilidade para desktop e mobile.

## Pontos Principais

- Ambiente
- Melhorias e Sustentações

---

## 1 Tecnologias

- React
- express
- Node.js
- Mongo DB Atlas

### 1.1 Hospedagem

- vercel

### 1.2 Frontend Interface

- Area de login
  > - Usuario
  > - Senha
- Painel principal
  > - (topo da direita) menu que contenha opcoes de usuarios, como: logout, mudar do tema (dark ou white) ;
  > - A esquerda um menu de opcoes para que fique em formato de hambuguer de acordo com a responsividade, nesse menu: gastos; ganhos; dashboard; contas pendentes, metas financeiras;
  > - Quadro para visualizar previa do dashboard
- Insercao de Gastos:
  > - Valor do Gasto
  > - Categoria (qual o tipo de gasto)
  > - data do gasto
- Insercao de Ganhos:
  > - Valor
  > - data
- Dashboard:
  > - Dados relacionado a ganhos, Gastos, saldo e contas pendentes
  > - Filto por mes e ano
  > - especificar a categoria e o valor
- Categorias:
  > - essas serao as categorias que estaram "pre-selecionadas" para que o usuario classifique seus gastos: Educacao, eletronicos, Transferencias para conta propria, Assinaturas digitais, Cartao de credito, Casa, Comida e bebida, Compras, contas e servicos, Emprestimos, Entretenimento, Esportes, Impostos, Investimento, Roupas, saques, saude e cuidados pessoais, servicos profissionais, supermecado, taxas, Transporte, viagens.
  > - opcao para adicionar as categorias de acordo com a rotina pessoal do cliente

Bases para o design:

- Painel principal, Insercao de Gasto, Insercao de Ganhos, Dashboard, Categorias (DESKTOP E MOBILE)
- Responsivo

Garantir que seja acessivel tanto para celulares e PCs
interface moderna com design intuitivo a nivel empresárial, garantindo uma boa visualização.

trazendo em evidência a performance antes de qualquer coisa

### 1.2.1 Cores

Cores modernas, de design premium

### 1.3 Backend

Backend: express
Banco de dados: MongoDB Atlas
ODM: Mongoose
Autenticação: JWT + Refresh Token
Arquitetura: Modular
API REST
Multi-tenant por transportadora
Certificado digital A1

### 1.3.1 Regras

Área de Login

Campos:

Usuário
Senha

Requisitos:

- JWT
  > - Refresh Token
  > - Hash de senha com bcrypt
  >   -Controle de sessão
  >   -Recuperação de senha

> IMPORTANTE: _O sistema inicialmente NÃO terá múltiplos usuários_

---

O sistema possuirá apenas:

- 1 usuário administrador (seed-user)
  criado automaticamente via backend/script seed
  Não incluir gerenciamento de usuários na sidebar
  Não criar módulo complexo de RBAC inicialmente
  Estruturar apenas de forma preparada para expansão futura

- Painel Principal

  O painel principal deve possuir:

  > Lista horizontal fixa no topo contendo transportadoras
  > Área Kanban para MDF-e pendentes
  > Área para MDF-e emitidos
  > CRUD completo de MDF-e
  > Status do MDF-e

- Ações:

  Integrar com a sefaz para emitir as MDFe conforma a api disponibilizada para a emissão integrada

  Emitir
  Editar
  Excluir
  Visualizar
  Download XML
  Download PDF/DAMDFE

- Após emissão:

  MDF-e deve ser marcado como emitido
  Deve possuir data de emissão
  Deve armazenar:

  número MDF-e
  chave MDF-e
  protocolo SEFAZ
  status da emissão
  histórico de emissão

> IMPORTANTE: _XML e PDF NÃO devem ser armazenados no banco
> Apenas os metadados da emissão_

- O banco deve armazenar somente:

  URLs
  paths
  hash
  metadata
  status

- Cadastro de Transportadora
  - Campos:

    > - Nome da transportadora
    > - CNPJ
    > - Certificado Digital A1
    > - Senha do certificado
    > - Chave/API interna
    > - Status
    > - Ambiente SEFAZ:
    > - homologação
    > - produção

Requisitos:

Guardar de maneira segura o certificado
Criptografia de dados sensíveis
Multi-tenant
Quadros da Transportadora

- Cada transportadora terá:

  > - Quadro de emissão
  > - Quadro de emitidos
  > - Visualização estilo KANBAN
  > - Lista e cards
  > - Renomear quadro
  > - Adicionar itens
  > - Ordenação por drag and drop futuramente

- Cadastro de MDF-e / Itens
- Cada item representa um MDF-e.

- Campos:
  - Dados da carga

  > - CNPJ do contratante
  > - Peso da carga
  > - Valor da carga
  > - Valor do imposto
  > - Chave de acesso da NF-e
  > - Observações
  - Destino

  > - UF
  > - Cidade
  - Motorista

  > - Nome
  > - CPF
  > - CNH
  - Veículo principal

  > - Placa
  > - RENAVAM
  > - CRLV
  - Reboques

  > - Máximo 2 reboques
  > - Cada reboque possui:

  > - placa
  > - renavam
  > - CRLV

_Regra: Caminhões menores podem não possuir reboque_

### 1.3.2 Funcionalidades dos Itens

Cada MDF-e deve permitir:

Emitir MDF-e
Cancelar MDF-e
Editar
Excluir
Visualizar detalhes
Download XML
Download PDF/DAMDFE
Reprocessar emissão

Visualização:

Card
Modal
Lista

Sidebar

Itens:

Nome da transportadora selecionada
Painel principal
Cadastro de transportadora
Configurações
Logout na parte inferior

IMPORTANTE:

Não incluir menu de usuários

### 1.3.3 ROTAS NECESSÁRIAS

Além do CRUD padrão, criar modelagem para:

Auth

login
refresh-token
logout
forgot-password
reset-password
me

Transportadoras

CRUD
atualizar ambiente SEFAZ

MDF-e

criar
editar
deletar
listar
detalhar
emitir
cancelar
reemitir
consultar status
download XML
download PDF/DAMDFE

guardar no banco em forma de String/Numeros (NÂO VAI SER ARMAZENADO ARQUIVO CNH )

CNH
CRLV
certificado

### 1.3.4 REQUISITOS TÉCNICOS

Quero que você me entregue:

1. MODELAGEM DE ENTIDADES

Liste todas entidades necessárias:
Exemplo:

AdminUser
Transportadora
MDFe
Veiculo
Reboque
Documento
Motorista
RefreshToken
EmissaoLog
etc

2. SCHEMAS MONGOOSE

Para cada entidade:

Nome da collection
Campos
Tipos
Required
Defaults
Indexes
Unique
Enums
Timestamps
Soft delete
Auditoria

Exemplo esperado:

@Schema({ timestamps: true })
export class Transportadora {
  @Prop({ required: true })
  nome: string;
}

3. DTOs DO NESTJS

Criar:

Create DTO
Update DTO
Response DTO

Utilizar:

class-validator
class-transformer

4. ESTRUTURA DE MÓDULOS

Exemplo:

src/
modules/
auth/
admin/
transportadoras/
mdfe/
sefaz/
common/

Quero sugestão profissional e escalável.

5. AUTENTICAÇÃO E SEGURANÇA

Quero:

JWT access token
Refresh token
Guards
Seed admin
Multi-tenant seguro
Criptografia
Rate limit
Helmet
CORS
Validação de certificado A1

6. PARA SEFAZ

que tenha integração com a sefaz para a emissão de notas

7. MODELAGEM DO FLUXO MDF-e

Sugira status possíveis

8. ESTRUTURA DE PASTAS

Quero estrutura completa do backend NestJS.

9. DOWNLOADS
   downloads das dos arquivos geradas pela SEFAZ

IMPORTANTE:

XML/PDF NÃO devem ser persistidos diretamente no MongoDB
Apenas referências e metadados

## 2 Melhorias e Sustentações

- Dashboard de Relatórios
