# Fase 7: privacidade das calculadoras

**Decisão aprovada:** resultados de calculadoras exclusivas do médico não aparecem para o paciente por padrão. Só podem ser compartilhados com o paciente quando houver uma autorização explícita, específica para aquele resultado.

## Regras para a implementação

- Compartilhar a evolução com um profissional não compartilha automaticamente resultados privados de calculadoras médicas.
- Cada resultado médico começa privado e permanece acessível somente ao profissional que o calculou; outro profissional autorizado ao prontuário não recebe automaticamente esse cálculo.
- A autorização de compartilhamento é por resultado, separada do compartilhamento geral e da ativação de módulos clínicos, e pode ser revogada.
- Revogar remove o resultado das consultas e relatórios futuros no app; não apaga cópias que já tenham sido exportadas ou obtidas por outra pessoa.
- Relatórios, exportações, telas de evolução e APIs do paciente omitem resultados médicos não compartilhados.
- O banco deve negar leituras diretas do paciente a resultados privados; a autorização explícita precisa ser verificada no servidor.
- Resultados de calculadoras autoaplicáveis pelo paciente seguem a regra prevista na Fase 7: ficam no histórico do paciente e disponíveis a profissionais com autorização ativa.

## Escopo atual

A primeira calculadora em preparação é o FIB-4, somente para médicos com CRM e dentro do prontuário que o paciente autorizou. O resultado profissional começa privado; o paciente recebe apenas o resultado e a data do exame depois de compartilhamento explícito por resultado. AST, ALT, plaquetas e idade informada não aparecem na consulta do paciente. O paciente pode ocultar novamente o resultado.

A idade é conferida no servidor contra o nascimento registrado quando disponível. A prévia avisa que não se deve interpretar o índice durante doença aguda, tem menor precisão abaixo de 35 anos e não é diagnóstico. Os limites de entrada, os pontos de corte e a adequação clínica da implementação ainda exigem revisão antes de qualquer publicação oficial.

O esquema desta primeira calculadora foi aplicado e verificado no Supabase Endo + Homologação, sem dados de pacientes; não houve alteração no banco nem no site de produção. A interface está sendo enviada para uma prévia isolada. Outras calculadoras da Fase 7 continuam fora deste escopo.

Referências usadas para a fórmula e interpretação inicial: [Sterling et al., 2006](https://doi.org/10.1002/hep.21178) e [AASLD Practice Guidance, 2023](https://doi.org/10.1097/HEP.0000000000000323).
