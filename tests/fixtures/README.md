# Fixtures públicas

Todos os identificadores `SYNTH-*` são inventados para testes locais e não seguem o formato de matrícula institucional. `000000.00000` é um placeholder sintético. Não os use para autenticação em serviços reais.

Os alvos Lite são configurados somente por `vi.mock` dentro dos testes da política; a configuração de produção permanece vazia. Os testes sem mock em `lite-disabled.test.ts` e `login-route.test.ts` preservam o acesso completo.

Senhas, chaves repetidas, cookies e tokens de exemplo são fixtures locais sem validade operacional. Nunca copie credenciais de produção, HTML autenticado bruto, nomes de alunos, notas, matrículas, prints ou PDFs pessoais para o Git. Crie dados mínimos sintéticos para reproduzir o comportamento.
