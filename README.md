# SOMA Mobile Prototype

Protótipo navegável mobile-first da SOMA, plataforma de medicina metabólica longitudinal, criado com React, Vite, Tailwind CSS e Framer Motion.
Toda a experiência usa dados simulados; não há backend ou autenticação real.

## Telas e fluxo

- `Splash` apresenta a marca e direciona para o login.
- `Login` aceita os dados demonstrativos e leva para a Home.
- `Home` conecta evolução metabólica, hábitos e um insight clínico discreto.
- `Evolução` exibe tendência longitudinal, indicadores de cuidado e timeline.
- `Hábitos` acompanha sono, alimentação, movimento e saúde emocional.
- `Educação` filtra vídeos e artigos metabólicos confiáveis.
- `Perfil` reúne objetivos metabólicos, preferências e saída da conta.

Após o login, uma bottom navigation fixa conecta os cinco destinos principais.

## Componentes-chave

- `MetabolicCard`, `HabitRing`, `AIInsightCard` e `EvolutionGraph`.
- Paleta premium com Deep Medical Teal, Midnight Navy e Soft Clinical White.
- Transições discretas entre telas, voltadas a uma experiência calma e respirável.

## Executar

Pré-requisitos: Node.js 18+ e npm.

```bash
npm ci
npm run dev
```

Para gerar a versão de produção:

```bash
npm run build
npm run preview
```

O projeto usa Rollup WebAssembly no pipeline do Vite para manter a build compatível
com ambientes macOS que restringem o carregamento de módulos nativos.

## Estrutura

```text
src/
  components/  Componentes de interface e navegação
  data/        Conteúdo demonstrativo
  screens/     Splash, Login, Home, Evolution, Habits, Education e Profile
  App.jsx      Rotas da aplicação
  index.css    Tema Tailwind e estilos globais
```
