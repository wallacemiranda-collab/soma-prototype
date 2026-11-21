# Fase 2: prévia clínica

Esta entrega é uma simulação para revisão, não uma fase liberada para pacientes.
Não foi aplicada nenhuma migração, alterada nenhuma configuração de produção ou
conectado um novo formulário ao Supabase. A versão oficial permanece na Fase 1.

Em 21/11/2026, o responsável confirmou a revisão clínica dos campos e limites,
inclusive doses e intervalos, e a conferência em iPhone/Safari e Android/Chrome.
Essa confirmação foi informada pelo responsável, não comprovada pelos testes
automatizados. A preparação da integração foi autorizada, mas a publicação
oficial continua exigindo outra autorização. Mudanças clínicas exigem nova revisão.
O trabalho de integração está em [PHASE2_INTEGRATION.md](PHASE2_INTEGRATION.md).

## Como abrir

```bash
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= VITE_GOOGLE_AUTH_ENABLED=false VITE_CLINICAL_PREVIEW_ENABLED=true pnpm dev
```

Abra `/login`, escolha **Explorar demonstração** e **Conhecer os módulos clínicos**.
Use apenas dados fictícios. A prévia usa o armazenamento da aba, com limite de
1.000 registros, esquema validado e limpeza ao sair ou autenticar uma conta real.
Se o navegador bloquear o armazenamento, funciona somente em memória.

1. Na perspectiva do paciente, marque a autorização de ativação de um médico fictício.
2. Abra **Simular perspectiva do médico** e ative os módulos desejados.
3. Para Diabetes, a faixa é opcional. Para GLP-1, preencha medicamento, dose,
   intervalo e primeira data do esquema, todos fictícios. Não há prescrição sugerida.
4. Volte ao paciente, abra um módulo e registre valores ou adicione exemplos.
5. Recarregue a URL e confira o histórico. Revogue a ativação e confirme o bloqueio
   de novos registros sem apagar os antigos. Renovar a autorização não reativa o módulo.
6. Autorize o segundo médico: ele não pode sobrescrever o módulo do primeiro.
   Encerre o módulo como paciente antes de trocar o responsável.
7. Saia da demonstração: as permissões e os registros clínicos fictícios são limpos.

## Incluído

- Glicemia capilar em cinco contextos, episódio de hipoglicemia informado e HbA1c datada.
- Gráfico de pontos com eixo temporal e filtro de contexto; percentual de amostras
  na faixa inclusiva configurada pelo médico. Nunca apresentado como tempo na faixa.
- Semaglutida/tirzepatida, dose em mg, intervalo explícito, aplicações e regiões.
- Náusea, vômito, constipação, diarreia e refluxo: 0 ausente, 1 leve, 2 moderado, 3 intenso.
- Previsão por dias de calendário a partir da aplicação da versão atual, ou da primeira
  data prevista. Datas vencidas não viram orientação para compensar doses.
- Mudanças de esquema criam versões; aplicações antigas conservam a dose registrada.
  Não se aceita aplicação anterior à primeira data da versão atual.
- Levotiroxina: data/hora e jejum sim/não/não sei. Sem inferir adesão ou adequação.
- Pressão sistólica, diastólica e frequência cardíaca opcional com data/hora.
- Visão médica fictícia do histórico, sem controles de edição dos registros.

## Limites e revisão obrigatória

Os intervalos abaixo são barreiras provisórias de digitação, não faixas de
normalidade nem uma lista de doses permitidas. Foram apresentados ao responsável
na revisão acima; isso não transforma os limites em recomendações de dose.
Nenhum deles gera diagnóstico ou alerta terapêutico. Qualquer alteração futura
precisa de nova validação antes de conectar contas reais.

| Campo | Limite provisório |
| --- | --- |
| Glicemia e limites de faixa | 10 a 1.000 mg/dL |
| HbA1c | 1 a 30% |
| Dose do esquema injetável | 0,01 a 100 mg |
| Intervalo explicitamente cadastrado | 1 a 90 dias inteiros |
| Pressão sistólica/diastólica | 40 a 300 / 20 a 200 mmHg; sistólica maior |
| Frequência cardíaca | 20 a 250 bpm, opcional |

Rever em particular dose/unidade por apresentação, intervalo por medicamento,
correção de aplicações antigas e orientações de segurança para hipoglicemia e
sintomas intensos. O rodízio nesta entrega é um lembrete com a última região,
não um algoritmo que escolhe onde aplicar. A prévia não é canal de urgência.

O horário é local, sem fuso persistido, somente nesta simulação. A integração
real deverá guardar instante e fuso/offset, como descrito no desenho do banco.
Os médicos da prévia são atores fixos fictícios, não contas nem CRMs verificados.
As permissões desta simulação nunca autorizam consultas ou escritas reais.

## Verificação

```bash
pnpm test
pnpm test:clinical
pnpm test:e2e -- --trace=off --global-timeout=240000
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= VITE_CLINICAL_PREVIEW_ENABLED=true pnpm build
```

Os testes usam exemplos aritméticos sintéticos para proporção e datas, sem
chamá-los de validação clínica. Não há nova fórmula diagnóstica nesta fase.
Testes em Chrome não substituem revisão em iPhone/Safari e Android/Chrome.

## Referências

- [Consenso internacional de métricas de monitorização contínua, Diabetes Care 2019](https://diabetesjournals.org/care/article/42/8/1593/36184/Clinical-Targets-for-Continuous-Glucose).
- [Bula de Wegovy para o paciente, Novo Nordisk](https://www.novonordisk.com.br/content/dam/nncorp/br/pt/pdfs/bulas/patient/Wegovy_Bula_Paciente.pdf).
- [Bulas e instruções de uso de Mounjaro, Lilly Brasil](https://www.lilly.com/br/medicamentos/disponiveis).

As referências não validam os limites técnicos acima. Não são copiadas instruções
de dose, manejo de efeitos adversos ou compensação de aplicações.

O desenho futuro do banco está em [supabase/PHASE2_SCHEMA.md](supabase/PHASE2_SCHEMA.md).
Publicação oficial e integração real exigem aprovação separada, implementação
e testes de acesso no banco; os testes da simulação não demonstram RLS real.
