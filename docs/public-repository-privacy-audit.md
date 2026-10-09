# Limpeza de privacidade do Git e preservação da produção

Data: 08/10/2026 (America/Sao_Paulo).

## Incidente confirmado

A versão publicada mais recente foi enviada pela CLI da Vercel, com alterações locais ainda não
commitadas (`gitDirty=1`). Sua referência Git era `5544088`, mas o conteúdo publicado incluía
funcionalidades posteriores ao snapshot desse commit. A `main` pública continha o código antigo.

A limpeza anterior incorporou o PR #1 e reescreveu/publicou a `main` enquanto os deploys por Git
estavam ativos. A Vercel construiu a árvore antiga da branch e substituiu a versão que havia sido
publicada pela CLI. A restauração da `main` para `5544088` desfez a limpeza do histórico, mas não
recuperou a produção por si só. O rollback realizado pelo mantenedor recuperou o deploy correto.

## Correção

- Substituição dos identificadores acadêmicos nos blobs e mensagens do histórico por dados sintéticos.
- Remoção de `output/` de todos os commits, incluindo o PDF acadêmico.
- Fixtures atuais de matrícula, nome pessoal e exportação usam exemplos sintéticos.
- `.gitignore` exclui exportações e arquivos de ambiente, mantendo `.env.example`.
- Teste de privacidade bloqueia novos identificadores institucionais nas fixtures.
- `lib/lite-targets.ts` permanece com lista vazia; os testes preservam acesso completo.
- O código executável do snapshot público foi preservado. As funcionalidades locais posteriores
  não foram incorporadas nem sobrescritas por esta limpeza.

## Proteção da produção

O deploy restaurado é `dpl_34pPEXt6wgVgE6pChDEvRCZHYsSz`, publicado pela CLI.
O rollback deixou `autoAssignCustomDomains=false`; esse estado deve ser preservado.
`vercel.json` bloqueia deploys por Git para `main` e `fix/public-fixture-privacy`, evitando que
uma manutenção do repositório publique o snapshot antigo. Deploys manuais continuam disponíveis.
Só reative os deploys por Git depois de reconciliar a branch com a versão desejada e validar o release.

Nenhum deploy, promote, rollback, alteração de domínio, banco ou segredo faz parte desta limpeza.

## Verificação

A árvore pública passou em 399 testes. Lint e tipos aprovados.
As fixtures locais afetadas passaram em 217 testes.
Gitleaks não encontrou segredos no histórico examinado. A comparação das árvores confirmou
zero alterações em arquivos executáveis do snapshot público. SHAs e evidências adicionais
ficam no relatório local privado da execução.
A validação inclui testes, lint, tipos, inspeção dos blobs históricos, Gitleaks com saída redigida,
comparação do código executável com o snapshot original e comparação dos aliases da Vercel.
Os dados removidos não são reproduzidos neste documento.

## Limite externo

Branches e tags reescritas não apagam as referências somente de leitura de PRs, caches por SHA,
clones ou cópias já obtidas. O PR #1 já foi incorporado e sua referência antiga é mantida pelo
GitHub. Solicite ao GitHub Support a remoção da referência e a coleta de objetos/caches afetados.
Não crie uma nova branch ou merge a partir do histórico antigo: isso pode reintroduzir os dados.
Backups privados deste trabalho ficam dentro de `.git/` e não devem ser publicados.

Referências:
- [GitHub: remoção de dados sensíveis](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Vercel: Instant Rollback](https://vercel.com/docs/instant-rollback)
- [Vercel: controle dos deploys por Git](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled)
