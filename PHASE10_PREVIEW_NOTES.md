# Endo + — Fases 10 e 11A: estado da prévia

Esta branch é uma prévia isolada de interface e lógica local. Ela não contém conexão com Supabase, não grava arquivos nem dados clínicos, não envia lembretes e não altera a implantação oficial. Os arquivos CSV/PDF selecionados permanecem somente na memória da aba.

## Implementado para revisão

- Curso fictício GLP-1 com titulação, manutenção, redução registrada, suspensão, fases inferidas, eventos de dose e seis meses de seguimento.
- Métricas puras para perda, nadir, recuperação sem limite superior, faixas, manutenção de 80%, respostas na semana 12/20 e TR50; pesos só são associados a datas dentro de ±7 dias.
- Relato de suspensão pelo paciente separado da confirmação profissional. O relato pendente não abre seguimento; a confirmação no cenário de demonstração inicia um período de 12 meses.
- Sinais de atenção somente na perspectiva profissional. A perspectiva do paciente não recebe os sinais nem referências dos ensaios.
- Exportação fictícia de CSV, consentimento separado por fonte, conversão mg/dL/mmol/L, separadores vírgula/ponto e vírgula, datas ISO e brasileiras, deduplicação entre arquivos, fuso informado, faixa personalizável e resumo somente com pelo menos 70% de leituras automáticas estimadas.
- Visão diária/semanal do paciente, percentis AGP para o profissional e eventos contextuais inteiramente fictícios de refeição, aplicação, peso e sintoma.
- PDF de AGP ou bomba como anexo apenas, sem extrair números ou doses.
- Acesso de demonstração por uma única tela, alternando as perspectivas fictícias de paciente e profissional.

## Limites deliberados

- O formato CSV está marcado como experimental. A exportação oficial da Abbott confirma o caminho LibreView > Glucose History > Download Glucose Data, mas o parser precisa ser validado com uma amostra real anonimizada antes de afirmar compatibilidade completa com todas as versões/idiomas.
- O cálculo local de uso do sensor usa leituras automáticas distintas dividido pelo número esperado de leituras, segundo o intervalo escolhido. É uma estimativa de protótipo; a amostra fictícia não substitui validação clínica nem o método do dispositivo.
- O consentimento, log de acesso e exclusão são simulados em memória. Ainda não existe upload para bucket privado, RLS de CGM, sincronização de autorizações com banco, exportação de dados da conta ou exclusão remota.
- Lembretes são configuração visual. Não acionam notificações do sistema.
- Curvas numéricas do STEP 1/4 e SURMOUNT-4 estão desativadas até revisão e aprovação dos valores pelo responsável clínico. Nenhuma recomendação de dose, suspensão, retomada ou redução é produzida.
- A trilha de 4–6 vídeos está preparada, mas a lista de IDs está vazia até o Dr. Wallace escolher os vídeos.
- Consentimento de pesquisa e exportação anonimizada permanecem desativados (`RESEARCH_EXPORT_ENABLED = false`). Não usar para pesquisa antes do protocolo e aprovação ética aplicável.
- A comparação comercial da Fase 11C não autoriza contratação ou integração. Brasil, disponibilidade por modelo, hospedagem, DPA/LGPD e preço por usuário precisam de confirmação contratual escrita.

## Para revisar antes de qualquer ativação real

- Validar clinicamente métricas, cortes dos sinais, lembretes, idioma dos cabeçalhos e a faixa padrão de glicose.
- Fornecer um CSV LibreView anonimizado e conferir os cabeçalhos, o fuso e leituras automáticas/escaneadas.
- Definir fornecedor, aprovação do fabricante, região de hospedagem, contrato de tratamento, retenção, exclusão e plano de resposta a incidentes.
- Implementar esquema e políticas RLS/bucket privado e testá-los com paciente, profissional autorizado, profissional sem autorização e revogação.
- Revisar privacidade, ANVISA, LGPD, App Store e Google Play antes de produto com dados reais.
