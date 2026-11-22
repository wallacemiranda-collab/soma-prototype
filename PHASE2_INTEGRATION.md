# Fase 2: integração preparada, não publicada

Em 21/11/2026, o responsável confirmou a revisão clínica dos campos/limites,
doses/intervalos e a conferência em iPhone/Safari e Android/Chrome. Autorizou
preparar a integração, mantendo uma autorização separada para publicação oficial.
Essa validação foi informada pelo responsável; testes automatizados não a substituem.
Ela se refere à prévia revisada. As novas telas de integração ainda precisam de
conferência nos aparelhos antes de uma eventual publicação.

A integração foi conferida em um Supabase separado, criado gratuitamente com
autorização do responsável. As migrações da Fase 2 foram aplicadas somente nessa
homologação. Nenhum endereço oficial, banco de produção ou configuração global da Vercel
foi alterado. Foram usadas cinco contas fictícias, removidas após os testes, sem
envio de e-mails nem uso de dados de pacientes. Veja [PHASE2_HOMOLOGATION.md](PHASE2_HOMOLOGATION.md).

Uma prévia protegida com contas fictícias dedicadas está disponível para a revisão
humana. Essas contas permanecem somente durante a revisão, separadas das contas já
removidas das suítes anteriores. Veja [PHASE2_MOBILE_REVIEW.md](PHASE2_MOBILE_REVIEW.md).

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
- Conflitos determinísticos retornam `PT409`, sem o ciclo de repetição automática
  que `40001` pode provocar no PostgREST. Instalações anteriores da Fase 2 usam
  `supabase/phase2-conflict-response.sql`; a instalação nova já inclui a correção.
- Confirmação do ator autenticado evita concluir uma operação após troca de conta.
- Instante UTC e fuso IANA nos registros; HbA1c usa data de calendário e fuso.
- `/cuidados`: registros, histórico, autorização de ativação e encerramento pelo paciente.
- `/profissional/pacientes/:patientId/cuidados`: configuração autorizada e histórico
  somente leitura; profissionais não médicos não recebem controles de configuração.
- Evolução da conta inclui histórico clínico e métricas dos módulos. As telas
  compartilham os componentes da prévia, sem usar seu armazenamento fictício.
- O modo demo continua isolado e nunca chama a integração real.
- `supabase/phase2-corrections.sql`: correções e desconsiderações somente pelo
  paciente, com motivo, ator e instante definidos no servidor. O original permanece
  imutável; os resumos usam apenas a versão válida. Consulte [PHASE2_CORRECTIONS.md](PHASE2_CORRECTIONS.md).

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
pnpm test:e2e --workers=1 --trace=off --global-timeout=240000
pnpm build
```

O teste de banco usa `@electric-sql/pglite@0.5.17`, apenas no desenvolvimento.
Executa PostgreSQL 18.7 local em memória, com papéis e contas sintéticas. Aplica
os scripts anteriores e a nova estrutura, verifica RLS/RPCs e descarta os dados.
Inclui o contrato completo repositório → argumentos nomeados de RPC → SQL.
As restrições adiáveis são conferidas antes de reverter cada cenário.

Conferência atual: 83 testes de regras/contratos, 22 cenários de banco (23 itens
incluindo o agrupador), 30 fluxos anteriores, seis da prévia, sete da integração
simulada e quatro fluxos de navegador com Auth/Data API reais. Na homologação,
12 cenários de API passaram (13 itens incluindo o agrupador), inclusive chamadas
HTTP simultâneas e revogação concorrente. Compilações com a integração desligada
e ligada passaram. Permanece o aviso de tamanho do bundle, não uma falha de build.

Os testes cobrem os sete tipos de registro, paginação, recarga, falha/repetição,
IDs forjados, profissões, consentimento, revogação, expiração, renovação,
troca de responsável, comparação de versões, dose histórica e isolamento.

## Limites antes de publicar

Auth/PostgREST e requisições HTTP simultâneas foram conferidos na homologação
PostgreSQL 17.12.0.000. Isso não é teste de carga nem comprovação de equivalência
com a instância oficial, que foi consultada somente por metadados e segue saudável
em PostgreSQL 17.6.1.166. A diferença de versões deve ser considerada na liberação.
Os testes de navegador usaram Chrome local com tela estreita; não substituem a
conferência das novas telas integradas em iPhone/Safari e Android/Chrome.

As correções auditáveis foram implementadas e testadas somente na homologação.
Ainda precisam de revisão do responsável e dos aparelhos. Não é possível editar
o esquema/dose histórica pelo formulário de correção. Desconsiderar não apaga o
original e exige confirmação; não há restauração direta nesta etapa.
Não apresentar esta preparação como produto comercial concluído.

Também permanecem as pendências gerais de privacidade/consentimento, verificação
profissional e proteção de senhas documentadas no projeto. Nenhum plano pago ou
integração de cobrança foi contratado. A próxima publicação exige nova autorização.
