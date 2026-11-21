# Fase 2: integração preparada, não publicada

Em 21/11/2026, o responsável confirmou a revisão clínica dos campos/limites,
doses/intervalos e a conferência em iPhone/Safari e Android/Chrome. Autorizou
preparar a integração, mantendo uma autorização separada para publicação oficial.
Essa validação foi informada pelo responsável; testes automatizados não a substituem.
Ela se refere à prévia revisada. As novas telas de integração ainda precisam de
conferência nos aparelhos antes de uma eventual publicação.

Nenhuma migração foi aplicada ao Supabase remoto, nenhum endereço oficial foi
atualizado e nenhuma configuração da Vercel foi alterada nesta preparação.
Não são criadas contas reais, enviados e-mails ou gravados dados de pacientes.

## Implementação

- `supabase/phase2-clinical.sql`: dez tabelas tipadas, RLS de leitura e gravações
  somente por RPCs restritas. É incremental; não reaplicar `schema.sql` na produção.
- Autorizações de ativação separadas, versionadas e sem ampliação automática
  das concessões antigas de leitura. Somente Medicina/CRM pode configurar;
  a identidade profissional continua declarada, não automaticamente verificada.
- Um responsável por módulo. Paciente encerra o módulo antes da troca.
- Mudança/revogação/renovação do compartilhamento invalida a ativação antiga,
  inclusive quando as operações têm o mesmo instante de transação.
- Leitura profissional revalidada; profissionais não editam registros clínicos.
- Versões imutáveis do esquema preservam medicamento/dose das aplicações antigas.
  Remover a conta profissional não apaga o histórico do paciente.
- Gravações com UUID de tentativa e versão esperada; repetição do envio não duplica
  registros. Alterar o conteúdo com o mesmo UUID é rejeitado.
- Confirmação do ator autenticado evita concluir uma operação após troca de conta.
- Instante UTC e fuso IANA nos registros; HbA1c usa data de calendário e fuso.
- `/cuidados`: registros, histórico, autorização de ativação e encerramento pelo paciente.
- `/profissional/pacientes/:patientId/cuidados`: configuração autorizada e histórico
  somente leitura; profissionais não médicos não recebem controles de configuração.
- Evolução da conta inclui histórico clínico e métricas dos módulos. As telas
  compartilham os componentes da prévia, sem usar seu armazenamento fictício.
- O modo demo continua isolado e nunca chama a integração real.

## Ativação em desenvolvimento

Por padrão, `VITE_CLINICAL_INTEGRATION_ENABLED=false`. Mesmo um cliente Supabase
configurado não libera o repositório sem essa opção. Esse controle só limita a
interface: a autorização real sempre depende das verificações do servidor/RLS.
Não ativar essa opção no site oficial antes da migração, homologação e aprovação.

Use somente um projeto Supabase de homologação, sem dados ou contas de pacientes.
Não reutilize as credenciais/URLs de produção para testar os novos formulários.
Nunca use chave privada ou `service_role` em variáveis `VITE_*`.

```text
VITE_CLINICAL_PREVIEW_ENABLED=false
VITE_CLINICAL_INTEGRATION_ENABLED=true
```

O exemplo acima é apenas para homologação. Os testes de interface configuram
`https://endo-tests.invalid` e interceptam as chamadas; não exigem Supabase real.

## Verificação local

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:database
pnpm test:integration
pnpm test:clinical
pnpm test:e2e -- --trace=off --global-timeout=240000
pnpm build
```

O teste de banco usa `@electric-sql/pglite@0.5.17`, apenas no desenvolvimento.
Executa PostgreSQL 18.7 local em memória, com papéis e contas sintéticas. Aplica
os scripts anteriores e a nova estrutura, verifica RLS/RPCs e descarta os dados.
Inclui o contrato completo repositório → argumentos nomeados de RPC → SQL.
As restrições adiáveis são conferidas antes de reverter cada cenário.

Conferência desta preparação: 76 testes de regras/contratos, 17 cenários de banco
(18 itens no relatório, incluindo o agrupador), 30 fluxos anteriores, seis da
prévia e cinco da integração simulada passaram. O lockfile congelado e as
compilações com a integração desligada/ligada também passaram. Permanece o aviso
de tamanho do bundle, que não é falha de compilação.

Os testes cobrem os sete tipos de registro, paginação, recarga, falha/repetição,
IDs forjados, profissões, consentimento, revogação, expiração, renovação,
troca de responsável, comparação de versões, dose histórica e isolamento.

## Limites antes de publicar

Esta verificação não usa Supabase Auth/PostgREST reais nem múltiplas conexões
PostgreSQL concorrentes. Os locks e índices foram preparados, mas os cenários
concorrentes e o contrato pela Data API devem ser homologados em um projeto
isolado na versão PostgreSQL do serviço antes de publicação.
O projeto oficial foi conferido somente por metadados e segue saudável em
PostgreSQL 17.6.1.166; o teste local em 18.7 não comprova equivalência nessa versão.

Ainda falta implementar correção auditável dos registros clínicos; esta versão
inicial não permite sobrescrever nem apagar episódios pela API. O fluxo deve
preservar o registro original e o motivo da correção, principalmente em aplicações.
Não apresentar esta preparação como produto comercial concluído.

Também permanecem as pendências gerais de privacidade/consentimento, verificação
profissional e proteção de senhas documentadas no projeto. Nenhum plano pago ou
integração de cobrança foi contratado. A próxima publicação exige nova autorização.
