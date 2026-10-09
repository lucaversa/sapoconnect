# Auditoria de privacidade do repositório público

Data: 08/10/2026 (America/Sao_Paulo). Base inspecionada: `5544088`.

## Escopo e método

- Clone completo: 89 commits e 1.691 objetos alcançáveis; a consulta remota retornou somente `main`, sem outras branches ou tags.
- Busca em blobs históricos por matrículas, e-mails, CPF, URLs com credenciais, atribuições de segredos, chaves privadas, JWT e padrões de tokens de provedores. Revisão dos resultados, configuração de ambiente, fixtures HTML e arquivos atuais.
- Gitleaks 8.24.3: `gitleaks git --redact --log-opts=--all`, 89 commits, zero achados. A ausência de achados não comprova ausência absoluta de segredos, especialmente em formatos desconhecidos.
- Extração do texto do PDF versionado e revisão visual de cinco capturas históricas do tutorial iOS. As capturas apresentam a tela de login sem credenciais e menus de instalação.
- As consultas do plugin GitHub não retornaram issues nem PRs anteriores. Não foram examinados caches internos do GitHub, clones de terceiros, forks, artefatos externos, logs de implantação ou o estado da aplicação em produção.

## Achados e correções

| Achado | Avaliação | Correção |
| --- | --- | --- |
| Três identificadores usados anteriormente pelo Lite e exemplos próximos nos testes | Podem identificar alunos; origem real/sintética não comprovada. O histórico também associa dois deles a um antigo modo por conta. | Substituição por `SYNTH-*` nos testes. Nenhum identificador original foi copiado para este relatório. |
| Outro identificador em testes de sessão e exportação | Potencial dado pessoal, com associação a uma exportação acadêmica. | Substituição por fixture sintética. |
| PDF em `output/pdf/sapoconnect-horarios-preview.pdf` | Associa matrícula, turma e horários; não deve integrar o código público. | Remoção da versão atual e exclusão de `/output/` no `.gitignore`. |
| Nome completo em teste de normalização | Exemplo de identidade desnecessário ao comportamento testado. | Substituição por nome explicitamente sintético. |
| Turma, subturma, sala e disciplina na fixture de exportação | Dados de contexto desnecessários para testar layout. | Substituição dos valores da fixture por exemplos sintéticos. |
| Arquivos de ambiente | `.env.example` contém variáveis vazias e instruções, sem segredos operacionais. | `.gitignore` passa a ignorar `.env*`, mantendo somente `.env.example` como exemplo versionável. |

Os placeholders locais de senha/cookies/tokens e as chaves repetidas de teste são inventados e usados com mocks. Não foram usados em serviços externos. URLs institucionais e nomes de disciplinas isolados não são credenciais; foram preservados onde representam integração ou formato de parser. A atribuição pública ao mantenedor e o e-mail de exemplo de um template antigo não foram tratados como vazamento de credencial.

A documentação de fixtures orienta o uso de dados inventados e mínimos. `public-fixtures-privacy.test.ts` bloqueia a introdução de identificadores numéricos no formato institucional nas fixtures de teste, exceto o placeholder de zeros. Essa verificação não detecta todas as classes de dados pessoais.

## Garantia do acesso completo

`lib/lite-targets.ts` permanece sem alterações, com `LITE_TARGET_RAS = []`. Os testes que simulam restrições usam somente mocks locais; isso não configura contas em produção. Os testes sem mock preservam o acesso completo na política, leitura de cookies, proxy e resposta de login, inclusive com ledger esgotado, ausente ou inválido. O teste de login também envia a mesma fixture sintética que a sessão simulada retorna.

## Validação

- `npm ci --ignore-scripts`: concluído.
- `npm test`: 50 arquivos, 399 testes aprovados.
- `npm run lint`: aprovado, sem warnings do ESLint.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado; build de produção compilado e rotas geradas.
- `git diff --check`: aprovado.
- Gitleaks na nova árvore pública (arquivos versionados e novos arquivos não ignorados): zero achados. A varredura indiscriminada do diretório local também detectou seis chaves geradas pelo Next.js em `.next/`; são artefatos locais ignorados, não publicados no Git.
- Gitleaks no histórico: zero achados. Varredura adicional por padrões não encontrou chaves privadas, tokens de provedores, JWT, CPF ou URLs com credenciais; atribuições longas encontradas eram tokens claramente sintéticos de teste.

## Risco residual e tratamento

As alterações limpam a nova árvore, mas não removem dados dos commits anteriores. Matrículas permanecem em versões antigas de testes, `lib/lite-policy.ts` e `lib/own3d-target.ts`; o PDF também permanece no histórico. Diffs de PR e referências por SHA podem continuar expondo versões antigas. Metadados de autoria do Git também permanecem públicos.

1. Verificar a origem dos identificadores de forma privada, sem tentar autenticar as contas nem publicar sua associação a pessoas. Até a confirmação, tratá-los como potencialmente pessoais.
2. Se forem reais, planejar a remoção do PDF e a substituição dos identificadores em todos os caminhos históricos com `git-filter-repo`, somente após autorização explícita. Incluir versões sem pontuação e as antigas implementações por conta no inventário privado. Essa operação altera SHAs e exige coordenação com colaboradores.
3. Após uma eventual limpeza autorizada, verificar branches, tags, refs de PR e forks; orientar novos clones para evitar reintrodução. Se necessário, solicitar ao GitHub Support a remoção de caches/referências que ainda contenham dados sensíveis, conforme os critérios do serviço.
4. Se qualquer credencial real for identificada posteriormente, revogá-la/rotacioná-la imediatamente; apagar o texto do Git não invalida uma credencial.
5. Manter exportações e arquivos de ambiente fora do Git, revisar anexos antes de publicar e usar proteção contra push de segredos e varredura de segredo em futuras contribuições.

Nenhum histórico foi reescrito, nenhum force push foi executado e nenhuma configuração de produção foi modificada.

Referência: [GitHub — Removing sensitive data from a repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
