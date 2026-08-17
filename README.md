# SapoConnect

<p align="center">
  <img src="./public/brand/sapoconnect-icon-192.png" alt="Logo atual do SapoConnect" width="120" />
</p>

Interface alternativa para o sistema acadêmico TOTVS EduConnect, desenvolvida através de engenharia reversa.

**GitHub:** [lucaversa/sapoconnect](https://github.com/lucaversa/sapoconnect)

## Comunidade

O SapoConnect é um projeto independente criado e mantido por Luca Janini. O aplicativo publica somente métricas agregadas e anônimas do Web Analytics, com cache de 6 horas para evitar consumo desnecessário de infraestrutura.

- [Sugerir uma melhoria](https://github.com/lucaversa/sapoconnect/issues/new?template=feature_request.yml)
- [Relatar um problema](https://github.com/lucaversa/sapoconnect/issues/new?template=bug_report.yml)
- [Como participar](CONTRIBUTING.md)

Nunca publique RA, senha, notas ou outros dados acadêmicos pessoais nas Issues.

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
| Retry adaptativo | Não | Sim (no máximo 1 repetição idempotente) |
| Cache de sessão | Não | Sim (10s para checks) |
| Cache de dados | Não | Sim (React Query + persistência local) |
| Offline TOTVS | Não | Sim (mantém login + banner + cache) |

### Fluxo de Recuperação de Sessão

1. **Usuário navega** -> apiFetch faz requisição
2. **Recebe 401** -> SessionManager inicia refresh em background
3. **Em paralelo** -> Outras requisições 401 aguardam (dedupe)
4. **Refresh completo** -> Cookies propagados (delay adaptativo)
5. **Retry automático** -> Requisição original é repetida uma única vez após o refresh
6. **Em 5xx/TOTVS_OFFLINE** -> Mantém usuário logado e exibe dados em cache

### Cache de Dados e Resiliência

- React Query com persistência em IndexedDB, isolada por um identificador opaco de usuário (`cacheScope`).
- Consultas acadêmicas concluídas com sucesso são persistidas em até 750 ms e mantidas até o logout explícito, uma migração incompatível ou a limpeza do armazenamento pelo navegador/sistema operacional.
- Um indicador offline separado guarda somente RA e `cacheScope`, sem expiração artificial; senha, token e cookies de sessão não fazem parte desse registro.
- Ao abrir uma tela já visitada, os dados persistidos aparecem imediatamente e a atualização acontece em segundo plano.
- Se a TOTVS ou a internet estiver indisponível, a UI mantém o último snapshot válido e informa que ele pode estar desatualizado.
- Se um módulo nunca tiver sido carregado com sucesso, a tela exibe "Sem dados salvos" em vez de permanecer em carregamento infinito.
- O logout explícito remove o cache do usuário atual. Uma indisponibilidade temporária da sessão não apaga o snapshot persistido.
- O app solicita o modo persistente da Storage API e registra um Service Worker que mantém o shell, as rotas acadêmicas e os assets estáticos disponíveis para reabertura offline.
- Safari e o Web App instalado no iOS podem usar contêineres de armazenamento separados. Cada contexto mantém o próprio snapshot depois de ser aberto online; sincronização entre navegadores ou dispositivos exigiria armazenamento no servidor.
- Se a resposta vier vazia onde deveria ter conteúdo (ex.: horários), tratamos como `SESSION_EXPIRED` para forçar reautenticação.

### Atualizações acadêmicas

- A área **Atualizações** compara snapshots semânticos de horários, faltas, avaliações e histórico e destaca somente mudanças relevantes.
- A primeira resposta válida de cada módulo estabelece a referência e não gera notificações retroativas.
- Respostas servidas do cache antigo, vazias ou parcialmente falhas não geram alertas; dados válidos anteriores são preservados.
- Os snapshots e o estado de leitura ficam somente no IndexedDB do próprio dispositivo, isolados por `cacheScope`, e são removidos no logout explícito.
- Na abertura do app, horários têm prioridade. No máximo um módulo acadêmico adicional é verificado a cada janela de 6 horas; histórico só entra nessa rotação após 24 horas.
- **Verificar** consulta os quatro módulos em sequência. O badge do cabeçalho mostra o total de alterações ainda não lidas.
- O feed exibe 20 alterações por lote e permite carregar mais. O aparelho conserva no máximo 200 alterações dos últimos 90 dias.
- O detalhe informa o antes e o agora e leva ao módulo correspondente. O app não força links para um card específico porque os identificadores fornecidos pela TOTVS não são estáveis em todos os módulos.

## Engenharia Reversa

O aplicativo foi desenvolvido analisando o tráfego de rede do aplicativo móvel EduConnect para identificar:
- Endpoints de autenticação (`LoginExternoApp`)
- Endpoints de dados (`GetNotasAvaliacao`, `EduAvisos`, `GetHorario`, etc.)
- Estrutura de cookies de sessão (`ASP.NET_SessionId`, `.ASPXAUTH`, `EduTipoUser`, `RedirectUrlContexto`)
- Contexto e seleção automática de período (`ensureTotvsContext` / `GetContextoAluno`)

## Segurança

### Criptografia
- A reconexão usa um cookie criptografado, `httpOnly`, `sameSite=lax` e restrito às rotas de autenticação; o JavaScript do aplicativo não lê a senha persistida.
- Uma cópia antiga no IndexedDB só é aceita durante a janela explícita de migração e é removida após a confirmação do novo cookie ou o fim da janela de compatibilidade.
- A chave de criptografia vem de `SESSION_ENCRYPTION_KEY` ou do keyring `SESSION_ENCRYPTION_KEYS`.
- O servidor falha de forma segura quando nenhuma chave válida está configurada; não existe chave padrão em produção.

### Sem Banco de Dados
- Nenhum dado persistido em servidor
- Sessão armazenada em cookie httpOnly criptografado no navegador
- Cookies do TOTVS são reutilizados em cada requisição

### Arquitetura de Sessão
```
Login → LoginExternoApp → Recebe cookies TOTVS
                         ↓
       Sessão + reconexão em cookies criptografados e httpOnly
                         ↓
       Requisições reutilizam a sessão externa
```

## Arquitetura

### Frontend (Next.js 16)
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
- `lib/academic-updates.ts` - Normalização e comparação semântica dos snapshots
- `lib/academic-updates-provider.tsx` - Sincronização progressiva e feed local de mudanças
- `lib/auth-client.ts` - Cliente de autenticação
- `lib/crypto.ts` - Criptografia AES-GCM
- `lib/storage.ts` - IndexedDB para cache acadêmico e migração legada

## Fluxo de Dados

### Autenticação
1. Usuário insere RA e senha
2. O backend envia as credenciais ao `LoginExternoApp` por HTTPS
3. Cookies da resposta são extraídos (`ASP.NET_SessionId`, `.ASPXAUTH`, etc.)
4. Sessão externa e dados de reconexão ficam em cookies criptografados e `httpOnly`
5. O IndexedDB mantém apenas caches acadêmicos e, durante a migração, pode conter a cópia legada já criptografada

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
SESSION_ENCRYPTION_KEY=<64-caracteres-hexadecimais-gerados-com-seguranca>
ALLOW_INSECURE_SESSION_KEY=false
TOTVS_TIMEOUT_MS=12000
VERCEL_ANALYTICS_TOKEN=<token-servidor-dedicado>
VERCEL_ANALYTICS_TEAM_ID=<team_id>
NODE_ENV=production
```

Na Vercel, configure `SESSION_ENCRYPTION_KEY` nos ambientes Production, Preview e
Development antes de publicar. Gere a chave com:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
```

Ao trocar a chave, mantenha a anterior conforme as opções documentadas em
`.env.example` para não invalidar imediatamente as sessões existentes.

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
