# Fase 11 — piloto de glicose importada

## Escopo desta prévia

- O fluxo padrão da Fase 11A é anexar o relatório PDF AGP do LibreView. O PDF.js lê somente texto da primeira página no navegador; não há OCR nem envio a serviço de IA. Os layouts reconhecidos em português e inglês salvam apenas período, tempo ativo, faixas, glicose média, GMI, CV e dispositivo.
- O PDF original é guardado em bucket privado, sob consentimento próprio para PDF. Nome, data de nascimento, telefone e clínica não são copiados para as métricas nem para o caminho do arquivo. O paciente pode conferir o PDF ao lado dos valores extraídos, revogar o acesso profissional e excluir anexos e métricas.
- Layouts não reconhecidos são guardados apenas como anexo, sem valores estimados. Uso do sensor abaixo de 70% mantém as métricas visíveis com aviso de cautela.
- O CSV continua opcional e avançado para leituras individuais. O arquivo original é lido no navegador e não é persistido; o banco recebe apenas leituras normalizadas, com horário, fuso, valor e tipo de leitura. Séries individuais, curvas e sobreposição com refeições ou GLP-1 não são produzidas pelo PDF.
- A tela não oferece monitoramento em tempo real, alarmes, interpretação clínica ou recomendação de tratamento. Bombas e outros fabricantes não estão incluídos.
- A consulta médica exige, ao mesmo tempo, compartilhamento vigente do paciente, autorização clínica vigente para aquele profissional e módulo Diabetes ativo. A leitura ocorre por RPC paginada e auditada; o médico não lê diretamente as tabelas.
- O paciente pode revogar a autorização de origem e excluir as leituras. Revogar bloqueia novas importações e consultas profissionais, mas não apaga os dados do paciente.
- O histórico total é limitado a 25.000 leituras por paciente para manter carregamento e exclusão previsíveis; novas importações acima do limite são recusadas sem salvar parcialmente o lote.

## Ambiente e proteção

- A estrutura de CSV e PDF foi aplicada somente ao projeto Supabase `ctcsolobseerqnddahun` (Endo + Homologação). O bucket PDF é privado e não tem leitura direta pelo navegador; abertura de arquivo usa uma Edge Function autenticada, que registra cada acesso antes de ler com segredo do servidor. Nenhuma tabela ou configuração do projeto oficial foi alterada.
- A homologação continua aceitando apenas contas sintéticas; não use credenciais reais nem convide pacientes para esta prévia.
- A ativação de interface está limitada à branch `codex/cgm-patient-pilot`, com URL e chave pública da homologação. Produção, outros previews, lembretes, Google, GLP-1 e importação genérica de dispositivos permanecem desativados.
- Não há relatórios PDF nem leituras CGM de pacientes no banco após a aplicação do esquema.

## Verificações feitas

- Testes automatizados do parser com PDFs sintéticos em português e inglês, layout não reconhecido, métricas incompletas e uso do sensor abaixo de 70%.
- Testes automatizados de consentimento independente PDF/CSV, upload privado, campos permitidos, RLS, compartilhamento médico, auditoria de metadados/arquivo e exclusão.
- Os testes de aplicação passaram localmente com dados sintéticos.
- As cinco tabelas de CGM na homologação estão com RLS e políticas de acesso.
- Os avisos de segurança da homologação não aumentaram com esta fase. Os avisos preexistentes de funções SECURITY DEFINER de lembretes, configuração de proteção contra senhas vazadas desativada e alguns índices de fases anteriores permanecem fora desta mudança.

## Antes de qualquer teste com pacientes

1. Criar um fluxo de acesso restrito a participantes convidados. A homologação atual bloqueia contas reais; não contornar essa proteção. Definir se o piloto ocorrerá em ambiente isolado próprio ou em produção com controles de liberação individual.
2. Validar clinicamente as métricas extraídas com relatório sem identificação e conferir a experiência em cada versão/região do LibreView usada pelos participantes. A estrutura AGP do PDF anexado foi reconhecida localmente, mas não substitui a validação clínica dos valores.
3. Aprovar texto de consentimento, aviso de privacidade, finalidade, prazo de retenção, canal de suporte e procedimento para incidentes/exclusão com o responsável clínico e a assessoria aplicável.
4. Rever as funções públicas SECURITY DEFINER sinalizadas pelo Supabase e habilitar a proteção contra senhas vazadas no ambiente que aceitará participantes.
5. Fazer conferência visual e funcional em iPhone/Safari e Android/Chrome, incluindo login convidado, consentimento, importação, autorização e revogação médica, troca de conta e exclusão.
6. Só então habilitar um grupo pequeno, com acompanhamento humano e sem usar este recurso para decisões urgentes ou automáticas.

Esta fase prepara e testa o fluxo técnico. Não constitui liberação para uso com pacientes reais nem para publicação no site oficial.
