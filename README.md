# SapoConnect

<p align="center">
  <img src="https://raw.githubusercontent.com/lucaversa/sapoconnect/main/public/sapo.png" alt="SapoConnect Logo" width="120" />
</p>

Interface alternativa para o sistema acadêmico TOTVS EduConnect, desenvolvida através de engenharia reversa.

**GitHub:** [lucaversa/sapoconnect](https://github.com/lucaversa/sapoconnect)

## Sobre o Projeto

O SapoConnect é um "braço" de navegação para o sistema da faculdade. Não possui banco de dados próprio nem armazena credenciais de forma insegura - toda a autenticação e dados são gerenciados através de cookies criptografados na sessão do navegador.

**Aviso:** Este aplicativo depende completamente do sistema EduConnect da faculdade. Qualquer alteração nos endpoints ou na estrutura de autenticação do sistema oficial pode impactar o funcionamento deste projeto.

## Gerenciamento de Sessão Inteligente

O SapoConnect usa um Session Manager centralizado para manter o usuário logado, reduzir falhas de autenticação e evitar telas "sem dados" quando a sessão expira.

### Problema no App Original

O aplicativo oficial EduConnect sofre com problemas de performance e estabilidade:
- **Travamentos frequentes** - App fica congelado e precisa ser fechado/aberto
- **Carregamento lento** - Demora muito para exibir a tela de seleção de módulos
- **Sessão expira silenciosamente** - Quando volta ao app após um tempo, precisa fazer login novamente
- **Sem recuperação automática** - Erros de rede exigem intervenção manual

### Solução SapoConnect

| Recurso | App Original | SapoConnect |
|---------|--------------|-------------|
| Refresh automático | Não | Sim (401 -> refresh) |
| Reconnect ao voltar | Não | Sim (visibility + check) |
| TTL de sessão | Opaco | 20 min (server) |
| Refresh preventivo | Não | Sim (5 min antes do TTL) |
| Retry adaptativo | Não | Sim (até 3 tentativas) |
| Cache de sessão | Não | Sim (10s para checks) |
| Cache de dados | Não | Sim (React Query + persistência local) |
| Offline TOTVS | Não | Sim (mantém login + banner + cache) |

### Fluxo de Recuperação de Sessão

1. **Usuário navega** -> apiFetch faz requisição
2. **Recebe 401** -> SessionManager inicia refresh em background
3. **Em paralelo** -> Outras requisições 401 aguardam (dedupe)
4. **Refresh completo** -> Cookies propagados (delay adaptativo)
5. **Retry automático** -> Requisição original é repetida (até 3x)
6. **Em 5xx/TOTVS_OFFLINE** -> Mantém usuário logado e exibe dados em cache

### Cache de Dados e Resiliência

- React Query com persistência local (`localStorage`) via hydrate/dehydrate.
- Cache mantido por até 24h (gcTime) para fallback offline.
- Ao abrir uma tela, dados em cache aparecem imediatamente; o refetch em background mostra "Atualizando dados..." e "Atualizado há ...".
- Se a TOTVS estiver fora do ar (5xx/503), a UI exibe banner de indisponibilidade e mantém o cache.
- Se a resposta vier vazia onde deveria ter conteúdo (ex.: horários), tratamos como `SESSION_EXPIRED` para forçar reautenticação.

## Engenharia Reversa

O aplicativo foi desenvolvido analisando o tráfego de rede do aplicativo móvel EduConnect para identificar:
- Endpoints de autenticação (`LoginExternoApp`)
- Endpoints de dados (`GetNotasAvaliacao`, `EduAvisos`, `GetHorario`, etc.)
- Estrutura de cookies de sessão (`ASP.NET_SessionId`, `.ASPXAUTH`, `EduTipoUser`, `RedirectUrlContexto`)
- Contexto e seleção automática de período (`ensureTotvsContext` / `GetContextoAluno`)

## Segurança

### Criptografia
- Credenciais de login (RA e senha) são criptografadas usando AES-256-GCM antes de serem armazenadas
- Chave de criptografia derivada de `SESSION_ENCRYPTION_KEY` (variável de ambiente)
- Em produção, **defina** `SESSION_ENCRYPTION_KEY` ou as credenciais usarão uma chave padrão (menos seguro)

### Sem Banco de Dados
- Nenhum dado persistido em servidor
- Sessão armazenada em cookie httpOnly criptografado no navegador
- Cookies do TOTVS são reutilizados em cada requisição

### Arquitetura de Sessão
```
Login → Credenciais criptografadas (IndexedDB)
      ↓
LoginExternoApp → Recebe cookies TOTVS
      ↓
Sessão criptografada (httpOnly cookie)
      ↓
Requisições usam cookies TOTVS armazenados
```

## Arquitetura

### Frontend (Next.js 14)
- App Router
- React Client Components
- React Query (cache + persistencia local)
- Tailwind CSS
- shadcn/ui

### Backend (API Routes)
- `/api/auth/login` - Autenticação com TOTVS
- `/api/auth/refresh` - Renovação automática de sessão
- `/api/auth/session` - Valida sessão (TTL 20 min)
- `/api/avaliacoes` - Lista disciplinas
- `/api/avaliacoes/notas` - Notas de avaliações
- `/api/faltas/completo` - Frequência enriquecida
- `/api/calendario/horario` - Grade horária
- `/api/historico` - Histórico acadêmico

### Bibliotecas Principais
- `lib/session-manager.ts` - Gerenciamento centralizado de sessão (TTL 20 min, refresh/reconnect)
- `lib/session.ts` - Operações de sessão no servidor
- `lib/external-auth.ts` - Autenticação TOTVS
- `lib/totvs-context.ts` - Garante contexto e seleção automática de período
- `lib/totvs-api.ts` - Wrappers de chamadas TOTVS
- `lib/fetch-client.ts` - Fetch com retry e refresh automático
- `lib/api-response-error.ts` - Normalização de erros e códigos
- `lib/query-client.ts` - Políticas de cache e retry
- `lib/auth-client.ts` - Cliente de autenticação
- `lib/crypto.ts` - Criptografia AES-GCM
- `lib/storage.ts` - IndexedDB para credenciais

## Fluxo de Dados

### Autenticação
1. Usuário insere RA e senha
2. Credenciais criptografadas e salvas no IndexedDB
3. POST para `LoginExternoApp` com credenciais
4. Cookies da resposta extraídos (`ASP.NET_SessionId`, `.ASPXAUTH`, etc.)
5. Cookies armazenados em sessão criptografada

### Requisições de Dados
1. Cliente faz request via `apiFetch`
2. Se recebe 401, SessionManager renova sessão automaticamente
3. API extrai cookies TOTVS da sessão
4. `ensureTotvsContext` valida contexto e seleciona o período mais novo quando necessário
5. GET/POST para endpoint específico
6. HTML response parseado para JSON
7. Em 5xx/503, retorna `TOTVS_OFFLINE` e UI mantém cache

### Contexto TOTVS (período)
```
Request -> ensureTotvsContext (seleciona período se necessário)
        v
        Endpoint específico
        v
        HTML response (não JSON)
        v
        Parsing -> Estrutura JSON
```

## Códigos de Erro e Resiliência

- `SESSION_MISSING` (401) - Sessão local ausente.
- `SESSION_EXPIRED` (401) - Sessão expirada; tenta reautenticar e, se falhar, solicita login.
- `INVALID_CREDENTIALS` (401) - Credenciais inválidas.
- `TOTVS_OFFLINE` (503) - TOTVS possivelmente fora do ar; mantém usuário logado e exibe cache.
- `UPSTREAM_ERROR` (502) - Erro inesperado no upstream.
- `INTERNAL_ERROR` (500) - Erro interno na API.

## Padrões de Parsing

Os endpoints TOTVS retornam HTML, não JSON. Cada endpoint tem um parser específico:

**Exemplo - Avaliações:**
- Regex extrai `<ul data-role="listview">`
- Split por `<li data-role="list-divider">` separa categorias
- Regex por `<li style="padding-bottom:1px">` extrai avaliações
- `<span class="ui-li-count">` contém nota

## Variáveis de Ambiente

```env
SESSION_ENCRYPTION_KEY=sua-chave-secreta-aqui-32-bytes
NODE_ENV=production
```

## Instalação

```bash
npm install
npm run dev
```

## Build para Produção

```bash
npm run build
npm start
```

## Limitações

- Depende da disponibilidade do sistema TOTVS
- Alterações na estrutura HTML podem quebrar parsers
- Funcional apenas para instituição específica (codificado)

## Aviso Legal

Este projeto é para uso pessoal e educacional. O autor não é responsável por uso indevido. O aplicativo não armazena credenciais em formato plaintext e não possui banco de dados.
