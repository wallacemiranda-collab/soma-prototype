# Endo + · Fase 9 (prévia isolada)

## Implementado nesta etapa

- Diário manual de demonstração, disponível somente no modo fictício.
- Busca sem distinção de acentos, quantidade em gramas, tipo e horário da refeição, fome, saciedade, sintomas e observação limitada a 500 caracteres.
- Repetição e remoção de refeições durante a sessão. Nenhum dado é persistido, enviado ou compartilhado.
- Quatro alimentos de amostra com valores por 100 g atribuídos à TACO 4ª edição: arroz tipo 1 cozido, feijão carioca cozido, banana-prata crua e cuscuz de milho cozido com sal.
- Cálculo de calorias e carboidrato total ou disponível, com total como padrão provisório. O paciente começa sem visualizar os dois números; a prévia profissional pode liberá-los separadamente, e calorias ficam desligadas por padrão.
- Visão demonstrativa de nutricionista com refeições fictícias, resumo simples e controles locais de visualização.
- Links para as fontes oficiais. Nenhum valor ou trecho da tabela da SBD é reproduzido.

## Fora de escopo e bloqueado para uso real

- Nenhuma integração com contas de paciente/profissional, Supabase, autorização granular, RLS, registro de acesso, exportação ou exclusão de dados.
- Nenhuma foto, fornecedor de IA, envio de imagem, PDF ou plano alimentar.
- A prévia não é orientação nutricional, não define metas e não calcula nem sugere dose de insulina.
- O modo de carboidratos continua provisoriamente em total até revisão clínica.
- O conjunto de quatro alimentos não é uma tabela completa; medidas caseiras e sinônimos sem correspondência comprovada não são inventados.
- O uso de conteúdo SBD permanece apenas por link, até autorização escrita. A página oficial da SBD informa reserva de direitos autorais.
- A página oficial da NEPA/UNICAMP descreve os dados TACO como disponibilizados publicamente. Ela não apresenta, na página consultada, uma licença específica de redistribuição comercial. Confirmar esse ponto com a instituição/assessoria jurídica antes de ampliar a base ou ativar o recurso para usuários reais.

## Revisão antes da próxima fase

1. Conferir clinicamente os quatro alimentos e o modo inicial de carboidratos.
2. Definir fonte e revisar medidas caseiras antes de incluí-las.
3. Obter autorização da SBD antes de qualquer uso de dados/tabela do manual.
4. Definir autorização independente do paciente, escopo do acesso profissional, retenção e exclusão antes de schema e integração reais.
5. Selecionar serviço de visão e validar contrato/privacidade antes de qualquer recurso com fotos.
6. Revisar textos ao paciente antes de ativação fora do modo demonstrativo.

## Como testar

- Entrar em modo de demonstração e abrir Hábitos > Diário alimentar.
- Conferir os registros fictícios, inserir outro alimento em gramas, repetir ou remover uma refeição e alternar total/disponível na prévia da nutricionista.
- Os números só aparecem após liberação simulada pela profissional. Ative calorias e carboidratos separadamente para conferir a ocultação pelo paciente.
- Recarregar ou encerrar a sessão: os registros de teste não devem permanecer.
