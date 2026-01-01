# Relatorio Tecnico - Flow Index (TAC 5)

## 1. Capa
**Projeto:** Flow Index - Otimizador de Produtividade

**Codigo do Grupo:** TAC 5

**Elementos:**
- Antonio Oliveira (A044409)
- Joao Gomes (A045235)

## 2. Resumo (150-250 palavras)
O projeto Flow Index responde ao desafio de monitorizacao de conforto e bem-estar em ambientes interiores, com foco em open space empresarial. Partindo de dados reais de 7 dispositivos IoT multi-sensores, a solucao integra uma camada de ingestao, uma base de dados relacional, uma API de suporte e um dashboard web. A plataforma recolhe dados de CO2, ruido, temperatura e luminosidade, calcula um indice de produtividade (Flow Index) e apresenta alertas e recomendacoes acionaveis para gestores de facilities e RH. O MVP permite visualizar o estado em tempo real por zona, consultar historico e aplicar acao corretiva com base em fatores criticos. A arquitetura foi desenhada para funcionar com a API Human Experience fornecida pela UC, garantindo autenticacao, ingestao periodica e armazenamento de historico. O resultado e um prototipo funcional que traduz dados sensoriais complexos numa leitura simples e operacional, permitindo detetar problemas de ventilacao, excesso de ruido ou desconforto termico, e sugerindo medidas para melhorar o ambiente de trabalho.

## 3. Problema, persona e contexto
**Problema:** A produtividade e o bem-estar em open space sao fortemente influenciados por fatores ambientais, mas raramente sao monitorizados de forma consistente. Sem dados objetivos, os gestores reagem apenas a queixas pontuais e nao conseguem otimizar o ambiente de forma proativa.

**Persona:** Gestores de Facilities e Gestores de Pessoas (RH), responsaveis por garantir condicoes adequadas e reduzir impacto em desempenho.

**Contexto de uso:** Dashboard web consultado diariamente para avaliar zonas do open space, identificar alertas e aplicar medidas corretivas (ventilacao, ajuste de temperatura, controlo de ruido, iluminacao).

## 4. Objetivos do projeto
**Produto:** Criar um prototipo digital que transforme dados IoT em um indice simples de produtividade, com alertas e recomendacoes orientadas ao contexto empresarial.

**Tecnicos:** Integrar API externa, ingestao de dados, base de dados local, API backend e frontend, garantindo persistencia e visualizacao historica.

## 5. Arquitetura da solucao
- **API Human Experience:** autentica via /login e fornece dispositivos e classificacoes.
- **Ingestao:** script Node.js (Ingestion.js) que recolhe dados periodicamente e grava na BD.
- **Base de Dados:** MySQL local, tabelas `sensors` e `leituras`.
- **Backend:** Express + Sequelize, endpoints para tempo real e historico.
- **Frontend:** React (Vite) com dashboard e graficos interativos.

## 6. Implementacao e decisoes tecnicas
- **Sequelize + MySQL:** modelacao simples com `Sensor` e `Leitura`.
- **Ingestao periodica:** executa no arranque e a cada 10 minutos.
- **Flow Index:** combinacao ponderada de CO2, ruido e temperatura; luminosidade mostrada no dashboard.
- **Alertas:** gerados por thresholds para CO2, ruido, temperatura e luz.

## 7. Funcionalidades principais do MVP
- **Dashboard por zonas:** Norte, Sul e Centro (3 dispositivos selecionados).
- **Tempo real e historico:** ultima leitura por sensor e historico de 24h.
- **Alertas e acoes corretivas:** recomendações por zona, com base nos sensores criticos.
- **Visualizacao avançada:** grafico multi-metrica com legenda interativa e limites de referencia.

## 8. Limitacoes e trabalho futuro
- Dependencia de conectividade com a API externa.
- Necessidade de calibracao mais fina dos thresholds por contexto.
- Futuro: adicionar integracao com sistemas de HVAC e automatizar alertas.

## 9. Uso de IA generativa e codigo de terceiros
**Ferramentas utilizadas:** ChatGPT/Codex.

**Tarefas:** ideacao inicial, suporte ao desenvolvimento, sugestoes de refactoring.

**Validacao humana:** todos os membros testaram o codigo, ajustaram thresholds e validaram resultados no dashboard.

## 10. Referencias
- API Human Experience (documentacao fornecida pela UC)
- jsthermalcomfort (https://federicotartarini.github.io/jsthermalcomfort/)
- Literatura de conforto termico e qualidade do ar interior.
