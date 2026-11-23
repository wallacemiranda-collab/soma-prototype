# Fase 7: privacidade das calculadoras

**Decisão aprovada:** resultados de calculadoras exclusivas do médico não aparecem para o paciente por padrão. Só podem ser compartilhados com o paciente quando houver uma autorização explícita, específica para aquele resultado.

## Regras para a implementação

- Compartilhar a evolução com um profissional não compartilha automaticamente resultados privados de calculadoras médicas.
- Cada resultado médico começa privado e permanece acessível ao profissional responsável; qualquer regra adicional de acesso profissional será definida sem ampliar a visibilidade do paciente.
- A autorização de compartilhamento é por resultado, separada do compartilhamento geral e da ativação de módulos clínicos, e pode ser revogada.
- Revogar remove o resultado das consultas e relatórios futuros no app; não apaga cópias que já tenham sido exportadas ou obtidas por outra pessoa.
- Relatórios, exportações, telas de evolução e APIs do paciente omitem resultados médicos não compartilhados.
- O banco deve negar leituras diretas do paciente a resultados privados; a autorização explícita precisa ser verificada no servidor.
- Resultados de calculadoras autoaplicáveis pelo paciente seguem a regra prevista na Fase 7: ficam no histórico do paciente e disponíveis a profissionais com autorização ativa.

## Escopo atual

O Endo + ainda não tem as calculadoras da Fase 7 nem uma tabela de resultados. Este arquivo registra o limite de privacidade aprovado para orientar o desenho do banco e dos testes quando essa fase começar; não libera nenhuma calculadora nem altera o banco.
