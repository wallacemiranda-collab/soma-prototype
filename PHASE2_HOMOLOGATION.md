# Endo +: homologação da Fase 2

Atualização em 22/11/2026: a revisão foi concluída e a Fase 2 foi publicada com
autorização. O texto abaixo registra a etapa anterior. Estado final em
[PHASE2_RELEASE.md](PHASE2_RELEASE.md).

Registro de 21/11/2026. Esta etapa não é uma publicação oficial nem uma liberação comercial.

## Ambiente separado

- Projeto: **Endo + Homologacao**, `ctcsolobseerqnddahun`.
- Organização autorizada: `wallacemiranda-collab's Org` (`ybthhqoertjifapadqpp`).
- [Painel da homologação](https://supabase.com/dashboard/project/ctcsolobseerqnddahun).
- Região: São Paulo (`sa-east-1`); PostgreSQL 17.12.0.000.
- Criação aprovada pelo provedor a US$ 0/mês; nenhum plano ou adicional pago contratado.
- Produção `trlwhngxqfgksiponpzk` não recebeu migrações da Fase 2. Nenhuma configuração,
  variável ou publicação na Vercel foi alterada.

Migrações aplicadas somente na homologação:

1. `initialize_endoplus_test_base`: estrutura básica, compartilhamento, códigos e profissões.
2. `phase2_clinical_modules`: módulos, consentimentos, versões e sete tipos de registro.
3. `synthetic_environment_marker`: confirmação constante do ambiente de testes.
4. `phase2_non_retryable_business_conflicts`: resposta imediata de conflito, sem repetição automática.
5. `phase2_audited_record_corrections`: correção e desconsideração pelo paciente, preservando originais e motivos.

O marcador não autentica usuários, não concede permissões e não deve ser instalado
na produção. Não reaplicar `schema.sql` em bancos existentes.

## Problema encontrado e corrigido

Conflitos de versão ou reutilização indevida de uma tentativa levantavam `40001`.
No serviço testado, isso provocava repetições e esperas longas, embora não duplicasse
os registros. A correção usa `PT409`: o usuário recebe a orientação de recarregar.
Uma tentativa repetida com o mesmo conteúdo continua retornando o mesmo registro.

A causa e o código adequado foram conferidos na
[orientação oficial do Supabase](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
`supabase/phase2-conflict-response.sql` repara instalações anteriores sem alterar dados,
assinaturas ou permissões. O teste local reproduz a versão antiga, aplica a correção
duas vezes e verifica a preservação das permissões. A instalação nova de
`phase2-clinical.sql` já usa o código corrigido.

## Evidências

- 83 testes de regras e contratos passaram.
- 22 cenários de banco passaram em PostgreSQL 18.7/PGlite 0.5.17, incluindo a correção
  idempotente (23 itens contando o agrupador).
- 12 cenários com Auth/Data API reais passaram na homologação (13 itens com o agrupador).
  Cobrem login, isolamento, sete tipos de registro, consentimento separado, profissões,
  troca de responsável, dose histórica, revogação e renovação.
- As requisições de concorrência usam tokens emitidos pelo Auth, somente em memória,
  e chamadas HTTP simultâneas: mesma tentativa sem duplicação, configurações concorrentes
  com um vencedor e revogação concorrente deixando o módulo inativo.
- Quatro fluxos de navegador com o serviço real: paciente grava, corrige e recarrega em
  largura de 320 px; médico consulta e altera uma configuração autorizada; outra conta
  não consegue abrir os dados; desconsideração preserva o histórico. Nenhuma chamada à produção ou envio de e-mail foi permitido.
- Seis fluxos da prévia, sete de integração simulada e 30 fluxos anteriores passaram. O novo caso de
  conflito preserva o valor digitado e não repete automaticamente o envio.
- As compilações com a integração desligada e ligada passaram. O aviso de bundle
  acima de 500 kB permanece; não impediu os builds.
- A instalação com lockfile congelado passou, sem alterações nas dependências.

O auditor de segurança retornou o aviso informativo esperado sobre a tabela
privada de reserva de códigos, com RLS sem políticas e acesso direto revogado
([explicação do auditor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).
As 16 tabelas públicas têm RLS habilitado. Nenhum alerta de saúde foi retornado na
conferência inicial. Após o uso do Auth, o auditor também retornou proteção contra
senhas vazadas desativada; permanece pendente, sem mudança de plano ou configuração
([orientação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

## Segurança e limpeza

Foram geradas cinco contas: dois pacientes, dois médicos e uma nutricionista,
todas com endereços `@example.invalid`. Não houve envio de e-mails, cópia de dados
oficiais, consulta a registros de pacientes nem uso de chaves privadas.

O arquivo temporário `.endo-homologation.local` é ignorado pelo Git, usa permissão
0600 e não configura o Vite automaticamente. As gravações exigem o ID exato da
homologação e a confirmação do marcador no servidor. Os testes recusam produção,
projetos desconhecidos, chaves privadas e identidades não sintéticas. Traces,
vídeos e capturas de tela foram desativados nos testes com credenciais.

Ao final, a limpeza limitada aos UUIDs e ao prefixo desta execução foi confirmada:
zero contas, sessões, perfis, consentimentos, módulos, versões, códigos de teste
e registros clínicos, incluindo suas auditorias. A estrutura do ambiente permanece disponível para novos
testes; o arquivo de senhas temporárias foi removido após a limpeza confirmada.

Posteriormente foram preparadas contas fictícias dedicadas à revisão humana em
uma prévia protegida, mantidas somente para essa finalidade. Estado e instruções
de encerramento em [PHASE2_MOBILE_REVIEW.md](PHASE2_MOBILE_REVIEW.md).

## Repetir a conferência

Após preparar exclusivamente novas contas sintéticas na homologação:

```bash
ENDO_STAGING_CONFIG=/caminho/privado/.endo-homologation.local pnpm test:staging:api
ENDO_STAGING_CONFIG=/caminho/privado/.endo-homologation.local pnpm test:staging:browser
```

`tests/staging/provision.mjs` gera credenciais locais e o SQL de criação/limpeza.
As ações `seed-sql` e `cleanup-sql` destinam-se à execução administrativa controlada
somente na homologação. A saída de `seed-sql` contém senhas fictícias: nunca a
registrar em logs, capturas ou commits. Limpar sessões, contas e dados após cada
execução, antes de remover o arquivo privado. Não automatizar esses testes contra
a produção nem habilitá-los em uma publicação por mera presença da chave pública.
Executar os testes de navegador sequencialmente; a homologação tem uma pasta de
resultados separada para não ser apagada pela inicialização de outra suíte.

## Antes da liberação

As correções auditáveis estão descritas em [PHASE2_CORRECTIONS.md](PHASE2_CORRECTIONS.md).
Faltam revisão do novo fluxo, conferência das telas integradas em iPhone/Safari e
Android/Chrome e autorização específica de publicação. A versão
do banco oficial difere da homologação; estes testes não são teste de carga ou
garantia de equivalência entre versões. Permanecem os requisitos de privacidade,
verificação profissional, segurança operacional e cobrança descritos no projeto.
