# ContaCerta — Correção do Toggle de Tema Dark/Light

> **Leia antes de começar**
> - Este prompt é para o **Codex** (correção de código existente)
> - O botão de tema já existe visualmente no `UserMenu` (dropdown do header/sidebar), mas **não funciona ao clicar**
> - A estrutura do `ThemeContext` pode ter sido gerada pelo Lovable de forma incompleta
> - Cada etapa é independente — leia a anterior antes de executar a próxima
> - **Não altere lógica de autenticação, chamadas de API ou estado de transações**
> - Ao final de cada etapa, **verifique o checklist antes de avançar**

---

# ══════════════════════════════════
# 🎨 TEMA DARK/LIGHT — CODEX
# ══════════════════════════════════

---

## TEMA — ETAPA 1: Diagnóstico — Mapear o que foi gerado

```
No projeto ContaCerta (React + TypeScript + Vite + TailwindCSS), faça um diagnóstico
completo do sistema de tema atual. NÃO altere nenhum arquivo nesta etapa.

TAREFA — apenas leia e reporte:

1. Verifique se existe src/contexts/ThemeContext.tsx (ou caminho similar):
   - O contexto foi criado?
   - Ele exporta um ThemeProvider e um hook useTheme?
   - O estado inicial é 'dark' ou lê do localStorage?
   - A função toggleTheme (ou setTheme) está implementada?
   - Ela aplica a classe 'dark' no elemento <html> via document.documentElement?

2. Verifique o src/main.tsx (ou src/index.tsx):
   - O <ThemeProvider> envolve o <App>?

3. Verifique o tailwind.config.ts:
   - Existe a propriedade `darkMode`?
   - Se sim, qual é o valor: 'class', 'media', ou outro?
   - Se não existe, o Tailwind está usando 'media' (padrão do SO) — isso impede o toggle manual.

4. Verifique o src/index.css (ou arquivo CSS global):
   - Existem as variáveis CSS de tema definidas em :root e .dark?
   - Ou as cores estão apenas como valores fixos no tailwind.config.ts?

5. Verifique o UserMenu (componente no header mobile e/ou sidebar desktop):
   - O botão de tema chama toggleTheme do useTheme?
   - Ou está sem handler (onClick vazio / sem onClick)?

Reporte o resultado de cada item acima antes de qualquer mudança.
```

### ✅ Checklist Etapa 1 — Diagnóstico
- [ ] Localização do ThemeContext identificada (ou confirmada ausência)
- [ ] Status do `darkMode` no tailwind.config.ts identificado
- [ ] Status das variáveis CSS em index.css identificado
- [ ] Problema principal isolado: contexto incompleto / provider ausente / handler faltando / tailwind sem `darkMode: 'class'` / CSS variables ausentes

---

## TEMA — ETAPA 2: CSS Variables — Definir a paleta nos dois temas

```
No projeto ContaCerta, defina as variáveis CSS de tema no arquivo de estilos global.

ARQUIVO: src/index.css (ou src/styles/global.css — use o arquivo CSS raiz do projeto)

TAREFA:
Adicione os seguintes blocos no topo do arquivo, antes de qualquer outra regra:

/* ── Tema claro (padrão) ── */
:root {
  --bg-base:        #F5F5F5;
  --bg-card:        #FFFFFF;
  --bg-muted:       #EBEBEB;
  --bg-overlay:     #E2E2E2;
  --text-primary:   #111111;
  --text-secondary: #555B6A;
  --text-muted:     #9CA3AF;
  --border-default: #E4E4E7;
  --border-strong:  #D1D1D6;
}

/* ── Tema escuro ── */
.dark {
  --bg-base:        #0A0A0A;
  --bg-card:        #141414;
  --bg-muted:       #1C1C1C;
  --bg-overlay:     #232323;
  --text-primary:   #FFFFFF;
  --text-secondary: #9CA3AF;
  --text-muted:     #4B5563;
  --border-default: #2A2A2A;
  --border-strong:  #3A3A3A;
}

IMPORTANTE:
- NÃO remova nenhuma regra CSS já existente no arquivo
- Adicione apenas esses dois blocos no topo
- As variáveis de accent (lime, orange, red, yellow) e category NÃO precisam de variante
  de tema — seus valores são idênticos nos dois modos e permanecem no tailwind.config.ts
- Não altere nenhum componente nesta etapa
```

### ✅ Checklist Etapa 2 — CSS Variables
- [ ] Bloco `:root` com 9 variáveis adicionado ao CSS global
- [ ] Bloco `.dark` com 9 variáveis adicionado logo abaixo
- [ ] `npm run dev` compila sem erros
- [ ] Nenhuma regra existente foi removida ou alterada

---

## TEMA — ETAPA 3: Tailwind — Ativar modo por classe e mapear variáveis

```
No projeto ContaCerta, atualize o tailwind.config.ts para usar CSS variables e
ativar troca de tema via classe.

ARQUIVO: tailwind.config.ts

TAREFA — substitua a seção colors e adicione darkMode:

darkMode: 'class',

colors: {
  bg: {
    base:    'var(--bg-base)',
    card:    'var(--bg-card)',
    muted:   'var(--bg-muted)',
    overlay: 'var(--bg-overlay)',
  },
  accent: {
    lime:   '#A3E635',
    orange: '#F97316',
    red:    '#EF4444',
    yellow: '#EAB308',
  },
  text: {
    primary:   'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted:     'var(--text-muted)',
  },
  border: {
    default: 'var(--border-default)',
    strong:  'var(--border-strong)',
  },
  category: {
    shopping:  '#EF4444',
    food:      '#F97316',
    groceries: '#22C55E',
    health:    '#06B6D4',
    travel:    '#8B5CF6',
    taxi:      '#3B82F6',
    other:     '#6B7280',
  },
},

POR QUE ISSO FUNCIONA:
- darkMode: 'class' faz o Tailwind ativar o tema escuro quando o elemento <html>
  tiver a classe 'dark'
- As cores agora apontam para variáveis CSS (var(--bg-base) etc.)
- Quando a classe 'dark' está no <html>, o bloco .dark do CSS global substitui
  os valores das variáveis automaticamente
- Resultado: todos os componentes que usam bg-bg-base, text-text-primary etc.
  mudam de cor sem precisar de classes condicionais dark: em cada um

NÃO altere: content, plugins, borderRadius, fontFamily ou qualquer outra propriedade.
```

### ✅ Checklist Etapa 3 — Tailwind
- [ ] `darkMode: 'class'` presente no nível raiz do config
- [ ] Seção `colors.bg` usando `var(--bg-base)` etc. (não mais hex fixos)
- [ ] Novo grupo `colors.border` adicionado
- [ ] `npm run dev` compila sem erros
- [ ] Nenhuma outra seção do config foi alterada

---

## TEMA — ETAPA 4: ThemeContext — Criar ou corrigir o contexto

```
No projeto ContaCerta, crie (ou reescreva completamente) o ThemeContext.

ARQUIVO: src/contexts/ThemeContext.tsx
(Se já existir, substitua o conteúdo inteiro. Se não existir, crie o arquivo.)

CONTEÚDO COMPLETO DO ARQUIVO:

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
    return 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  }
  return context
}

COMO FUNCIONA:
- Estado inicial: lê 'theme' do localStorage. Se não existir, padrão é 'dark'
- useEffect: a cada mudança de tema, adiciona ou remove a classe 'dark' do <html>
  e salva a preferência no localStorage
- toggleTheme: alterna entre 'dark' e 'light'
- A classe 'dark' no <html> ativa o bloco .dark do CSS global (Etapa 2),
  que substitui todas as variáveis CSS — e o Tailwind lê essas variáveis (Etapa 3)

Não altere nenhum outro arquivo nesta etapa.
```

### ✅ Checklist Etapa 4 — ThemeContext
- [ ] Arquivo ThemeContext.tsx criado/substituído com o conteúdo acima
- [ ] ThemeProvider e useTheme exportados
- [ ] `npm run dev` compila sem erros TypeScript

---

## TEMA — ETAPA 5: Registrar o Provider no main.tsx

```
No projeto ContaCerta, envolva a aplicação com o ThemeProvider.

ARQUIVO: src/main.tsx (ou src/index.tsx — use o arquivo raiz do React)

TAREFA:

1. Adicione o import no topo:
   import { ThemeProvider } from './contexts/ThemeContext'

2. Envolva toda a aplicação com ThemeProvider. Ordem correta dos providers:

   <StrictMode>
     <ThemeProvider>
       <QueryClientProvider client={queryClient}>
         <App />
       </QueryClientProvider>
     </ThemeProvider>
   </StrictMode>

   ThemeProvider deve ser o mais externo (exceto StrictMode) pois:
   - Não depende de dados da API
   - Não depende de rotas
   - Precisa estar disponível em toda a árvore de componentes desde o início

3. Não altere mais nada neste arquivo.
```

### ✅ Checklist Etapa 5 — Provider
- [ ] ThemeProvider importado no main.tsx
- [ ] ThemeProvider envolve QueryClientProvider e App
- [ ] `npm run dev` sobe sem erros
- [ ] Console sem erros de "useTheme deve ser usado dentro de ThemeProvider"

---

## TEMA — ETAPA 6: Conectar o botão de toggle no UserMenu

```
No projeto ContaCerta, conecte o botão de tema ao ThemeContext.

ARQUIVOS A EDITAR:
- src/components/layout/UserMenu.tsx (dropdown no header mobile)
- src/components/layout/Sidebar.tsx (se tiver item de tema no desktop)

TAREFA:

1. Importe o hook useTheme e os ícones:
   import { useTheme } from '../../contexts/ThemeContext'
   import { Sun, Moon } from 'lucide-react'
   (ajuste o caminho relativo conforme a estrutura real do projeto)

2. Dentro do componente, extraia theme e toggleTheme:
   const { theme, toggleTheme } = useTheme()

3. Localize o botão/item de tema existente e:
   - Adicione onClick={toggleTheme}
   - Atualize o ícone: Sun quando tema === 'dark' (clicando vai para claro),
     Moon quando tema === 'light' (clicando vai para escuro)
   - Atualize o texto: "Tema Claro" quando dark, "Tema Escuro" quando light

   Implementação do botão:
   <button
     onClick={toggleTheme}
     className="flex items-center gap-2 w-full px-3 py-2 text-sm
                text-text-secondary hover:text-text-primary
                hover:bg-bg-muted rounded-lg transition-colors"
   >
     {theme === 'dark'
       ? <><Sun size={16} /> Tema Claro</>
       : <><Moon size={16} /> Tema Escuro</>
     }
   </button>

4. Não altere outros itens do menu (Meu Perfil, Sair, etc.)
5. Se a Sidebar desktop tiver um toggle separado, aplique a mesma lógica lá.
```

### ✅ Checklist Etapa 6 — Botão
- [ ] Clicar no botão alterna o tema instantaneamente (sem reload)
- [ ] Fundo da aplicação muda visivelmente: escuro ↔ claro
- [ ] Ícone e texto do botão refletem o tema atual
- [ ] Ao recarregar o browser, o tema salvo no localStorage é restaurado
- [ ] Console sem erros

---

## TEMA — ETAPA 7: Verificação visual — Layout e componentes principais

```
No projeto ContaCerta, verifique se os componentes de layout respondem corretamente
à troca de tema. Como as cores agora usam CSS variables via Tailwind (Etapa 3),
a maioria dos componentes já deve funcionar automaticamente.

VERIFICAR (não alterar se já estiver correto):

1. AppLayout.tsx, Sidebar.tsx, BottomNav.tsx, Header.tsx:
   - As classes de fundo usam bg-bg-base, bg-bg-card, bg-bg-muted?
   - Se sim: já funcionam automaticamente com as CSS variables
   - Se usam hex fixos (#0A0A0A, #141414 etc.): substituir pelas classes Tailwind

2. Textos de navegação:
   - Usam text-text-primary, text-text-secondary, text-text-muted?
   - Se não: substituir pelos tokens do design system

3. Bordas e divisores:
   - Substituir border-bg-muted por border-border-default
   - Isso usa a variável --border-default que já tem valor para os dois temas

4. Cores de accent (lime, orange, red, yellow) e category:
   NÃO precisam de ajuste — são idênticas nos dois temas

REGRA GERAL:
Se um componente usa classes como bg-[#141414] ou text-[#9CA3AF] com hex fixo,
substitua pelo token equivalente:
  bg-[#0A0A0A]  → bg-bg-base
  bg-[#141414]  → bg-bg-card
  bg-[#1C1C1C]  → bg-bg-muted
  text-[#FFFFFF] → text-text-primary
  text-[#9CA3AF] → text-text-secondary
  text-[#4B5563] → text-text-muted

NÃO altere: lógica de navegação, handlers, chamadas de API, estrutura JSX
```

### ✅ Checklist Etapa 7 — Visual
- [ ] Alternar tema muda o fundo de toda a aplicação (base, card, sidebar, bottom nav)
- [ ] Textos legíveis nos dois temas (contraste adequado)
- [ ] Accent lime (#A3E635) aparece igual nos dois temas
- [ ] Nenhum hex fixo de fundo ou texto restante nos componentes de layout
- [ ] Sem quebra de layout ou overflow ao alternar

---

# 📋 ORDEM DE EXECUÇÃO

```
1. Etapa 1 (Diagnóstico)      → identificar problema → NÃO commitar
2. Etapa 2 (CSS Variables)    → validar checklist → commit
3. Etapa 3 (Tailwind config)  → validar checklist → commit
4. Etapa 4 (ThemeContext)     → validar checklist → commit
5. Etapa 5 (Provider)         → validar checklist → commit
6. Etapa 6 (Botão)            → validar checklist → commit  ← tema funciona aqui
7. Etapa 7 (Visual)           → validar checklist → commit final
```

> ⚠️ **A etapa 1 é obrigatória.** O diagnóstico define qual etapa é crítica no seu projeto.
> Se as CSS variables já existem no index.css, pule a Etapa 2.
> Se o ThemeContext já está correto, pule a Etapa 4.
> Execute sempre na ordem e valide o checklist antes de avançar.
