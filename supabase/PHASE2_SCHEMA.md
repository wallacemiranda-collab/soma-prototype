# Desenho do banco da Fase 2, ainda não aplicado

Este documento descreve a integração futura. A prévia atual não cria tabelas,
não usa RPCs clínicas e não grava no Supabase. Não executar o esquema inicial
do projeto para implantar esta fase. Criar migração incremental somente após
aprovar os campos e as regras, e testá-la primeiro fora da produção.

A implementação incremental foi preparada em `supabase/phase2-clinical.sql`,
sem aplicação ao projeto remoto. A revisão clínica e dos aparelhos foi confirmada
pelo responsável em 21/11/2026. Os testes locais usam PostgreSQL embarcado e
contas sintéticas; não equivalem à homologação do Supabase Auth/Data API.

## Estrutura proposta

| Tabela | Campos principais e invariantes |
| --- | --- |
| `patient_module_permissions` | paciente, médico, versão da concessão, data/versão do consentimento, revogação; ativação separada da leitura existente |
| `clinical_module_settings` | paciente, chave do módulo, médico responsável, concessão vinculada, ativo; uma configuração responsável por módulo/paciente |
| `clinical_module_versions` | configuração, revisão imutável, autor, instante, limites glicêmicos ou esquema injetável tipado; não sobrescrever versões antigas |
| `glucose_readings` | paciente, instante, fuso/offset, valor em mg/dL, contexto enumerado |
| `hypoglycemia_events` | paciente, instante, glicemia opcional, sintomas e ação informada com limites de texto |
| `hba1c_results` | paciente, data do exame e percentual; não confundir com hora da coleta |
| `injection_logs` | paciente, instante, local enumerado, referência à versão imutável do esquema, medicamento/dose/unidade históricos |
| `gi_symptom_logs` | paciente, instante, cinco intensidades inteiras de 0 a 3 |
| `thyroid_intakes` | paciente, instante e jejum explicitamente sim/não/não informado |
| `blood_pressure_readings` | paciente, instante, sistólica, diastólica e pulso opcional |

Cada registro tem UUID, chave de idempotência por paciente/tipo para repetição de
envio, data de criação e referência à versão imutável do módulo. Nesta integração
inicial, registros inseridos são imutáveis pela API: a correção auditável ainda
precisa de implementação antes de ampliar o piloto. Configurações usam comparação
da versão esperada para impedir sobrescrita concorrente.
Índices por `(patient_id, occurred_at desc, id)` ou data do exame servirão à
paginação do histórico. Configurações usarão unicidade paciente/módulo;
versões terão unicidade configuração/revisão. Campos clínicos serão tipados,
com unidades explícitas, não um depósito genérico de JSON sem validação.

## Acesso e consentimento

- RLS em todas as novas tabelas expostas, sem privilégios de `anon`.
- Paciente autenticado lê seus próprios dados. Grava somente seus registros de
  módulos ativos. Identidade sempre obtida do usuário autenticado no servidor.
- Autorização de ativação é opt-in separado. Concessões antigas de leitura
  não são ampliadas e não criam permissões de configuração por migração.
- Médico só configura módulo se tiver cadastro de Medicina/CRM, leitura vigente
  concedida pelo paciente e autorização de ativação vigente. Cadastro declarado
  não equivale a CRM verificado: definir a verificação operacional antes de ampliar uso.
- Configurar não permite editar medidas, episódios, aplicações ou exames.
  Outros profissionais continuam somente com leitura autorizada.
- Uma configuração pertence a um responsável. Outro médico não sobrescreve
  o esquema; o paciente encerra/autoriza a troca explicitamente.
- Revogação ou expiração da leitura bloqueia leitura e configuração imediatamente
  no servidor; revogar só a ativação bloqueia configuração e novos registros do
  módulo, sem ampliar ou revogar por acidente o consentimento de leitura.
- Cada configuração referencia a concessão exata, não só o UUID do médico.
  Renovar uma autorização não reativa automaticamente módulos anteriores.
- O paciente conserva acesso ao histórico próprio mesmo com módulo encerrado.
  Médicos só leem históricos com o consentimento de leitura ainda vigente.
- Atualizações usam `USING` e `WITH CHECK`, além de privilégios por coluna.
  Não autorizar por `user_metadata`, preferência de navegação ou cache da demo.
- Confirmar consentimento e gravar configuração em operação atômica, com lock
  nas concessões/configurações para não concorrer com revogação ou troca de autor.
  Helpers privilegiados, se indispensáveis, ficam no esquema privado, com
  `search_path` fixo, chamadas autenticadas e sem execução pública.

## Antes da integração real

1. Validar clinicamente unidades, limites, esquema e comportamento em datas antigas.
2. Revisar o consentimento e a transparência de acesso profissional.
3. Implementar migração aditiva e testes transacionais com contas sintéticas.
4. Provar isolamento, negação anônima, profissão, revogação, expiração, renovação,
   concorrência, não alteração do histórico e limites de colunas via API.
5. Implementar repositório autenticado e testes de sessão/troca de conta/falhas.
6. Revisar segurança e testar nos aparelhos antes de pedir autorização de publicação.

Nenhum desses testes de banco é substituído pelos testes do armazenamento fictício.
