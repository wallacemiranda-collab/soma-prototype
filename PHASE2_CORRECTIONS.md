# Fase 2: correções com histórico preservado

Implementação e conferência em 21/11/2026, somente na homologação `ctcsolobseerqnddahun`.
Não houve publicação na Vercel nem mudança no banco oficial. Nenhum serviço pago contratado.

## Comportamento

- Em `/cuidados`, o paciente pode **Corrigir registro** ou **Desconsiderar registro**.
  O motivo é obrigatório (3 a 500 caracteres); desconsiderar exige confirmação adicional.
- A correção insere outro registro tipado e uma ligação de auditoria. Não altera nem
  apaga o original. A auditoria identifica o paciente, instante do servidor e motivo.
- O histórico mostra o valor válido e permite abrir o original e cada alteração.
  Registros desconsiderados continuam identificados, mas não entram nos gráficos,
  proporções ou previsão de aplicação.
- Médico e demais profissionais continuam somente com leitura autorizada, inclusive
  dos motivos. Revogar a leitura também bloqueia a consulta à auditoria.
- O paciente pode corrigir sua anotação histórica mesmo após o encerramento do módulo
  ou revogação da ativação. Isso não reativa o módulo nem permite criar novas anotações nele.
- Aplicações corrigidas conservam a versão original do esquema e sua dose; o formulário
  não permite trocar medicamento, dose, paciente, autor ou plano. Não altera tratamento.
- Editar apenas o valor conserva o instante original, inclusive segundos, e seu fuso.
  Se a data/hora for modificada, utiliza o horário local e o fuso atual do aparelho.
- Duas correções concorrentes do mesmo registro não se sobrescrevem. Uma é aceita;
  a outra recebe `PT409` e pede atualização. Repetir a mesma tentativa não duplica o dado.
- Falha no envio mantém os valores e o motivo digitados. O modo de demonstração anterior
  permanece isolado: estes controles pertencem às contas de homologação, não ao cache da demo.

## Banco e leitura

`supabase/phase2-corrections.sql` é incremental e exige a estrutura da Fase 2. Foi
aplicado como `phase2_audited_record_corrections` apenas na homologação. A tabela
`clinical_record_corrections` tem RLS e permite apenas SELECT autorizado pela API.
As correções passam pelo RPC `endo_correct_clinical_record`; o ator é confrontado
com `auth.uid()`. Helpers privilegiados permanecem privados, com `search_path` fixo.

A gravação reutiliza a mesma validação de campos e as restrições tipadas das sete
tabelas. A inserção da versão corrigida e da auditoria é atômica. A serialização
das correções é limitada ao perfil do paciente, sem travar outros pacientes.

O repositório pagina os registros e depois a auditoria, reconfirma a identidade e
o acesso profissional e resolve as cadeias antes de calcular métricas. Cadeias
incompletas, ciclos, bifurcações ou troca de versão de plano falham de modo fechado,
pedindo atualização em vez de contar original e correção como duas medições.

## Conferência

- 83 testes de regras/contratos e 22 cenários de banco local passaram (23 itens com agrupador).
- 12 cenários com Auth/Data API reais passaram (13 itens com agrupador), incluindo
  correções dos sete tipos, repetição, concorrência, motivos, leitura revogada e atores forjados.
- Sete fluxos de integração simulada cobrem também falha de conexão, preservação do
  formulário, recarga e desconsideração confirmada.
- Quatro fluxos de navegador com o serviço real verificam gravação/correção em 320 px,
  original e motivo após recarga, consulta médica sem edição, persistência da configuração,
  acesso indevido bloqueado e desconsideração preservando a cadeia.
- Os 30 fluxos anteriores e os seis da prévia passaram. Compilações com a opção
  desligada e ligada passaram; o aviso de bundle grande permanece.

Os testes usam somente contas `@example.invalid`, sem e-mails ou dados de pacientes.
Traces, vídeos e capturas automáticas com credenciais ficam desativados. As contas,
sessões, registros e auditorias sintéticas são removidos ao fim da execução.

## Como revisar

Em uma prévia controlada com contas fictícias:

1. Registre uma anotação, corrija um valor e preencha o motivo.
2. Recarregue e abra **Ver original e alterações**; confira original, correção e motivo.
3. Confira que o resumo considera uma única medição, não original e correção.
4. Entre como profissional autorizado e confira o histórico sem controles de edição.
5. Desconsidere a anotação, confirme e confira que ela continua no histórico, fora do resumo.

## Limites

Ainda é necessária a revisão do novo fluxo pelo responsável e em iPhone/Safari e
Android/Chrome físicos. Os testes de Chrome em largura estreita não substituem isso.
Não há restauração direta de um registro desconsiderado nesta etapa: nova anotação
depende de módulo ativo. A trilha não é certificação de prontuário nem prova criptográfica
contra alterações administrativas; alterações privilegiadas no banco exigem controles operacionais.

A auditoria do Supabase registrou proteção contra senhas vazadas desativada
([orientação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).
Nenhuma configuração ou plano foi alterado para resolver isso. Permanecem as
pendências gerais de privacidade, verificação profissional, segurança e liberação
comercial documentadas no projeto. Publicação oficial exige autorização separada.
