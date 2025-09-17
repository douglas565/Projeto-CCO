# Diário de Planejamento e Acompanhamento Operacional

## Funcionalidades

### 1. Planejamento Diário
- Registro de data, turno, equipe e colaboradores
- Definição de veículo e região de atuação
- Validação automática de dados obrigatórios

### 2. Triagem de Ordens de Serviço (OS)
- Contabilização de protocolos no prazo e vencidos
- Cálculo automático do total de protocolos
- Registro de comentários sobre atendimento
- Alertas automáticos para alto percentual de protocolos vencidos

### 3. Execução
- Registro de itens atendidos, impossibilidades e não executados
- Cálculo automático de eficiência
- Comentários detalhados sobre a execução
- Indicadores visuais de status

### 4. Supervisão
- Comentários do supervisor
- Análise de sentimento automática via IA
- Identificação de pontos de atenção
- Indicadores de status geral, eficiência e problemas

### 5. Relatórios
- Resumo consolidado do dia
- Exportação de dados em JSON
- Envio automático de relatórios por email
- Opção de nova entrada

### Frontend
- **HTML5**: Estrutura semântica e acessível
- **CSS3**: Design responsivo com paleta azul e verde?
- **JavaScript**: Funcionalidades interativas e validações
- **Responsive Design**: Compatível com desktop e mobile 

### Automação (n8n)
- **Webhooks**: Integração entre frontend e workflows
- **Validação de Dados**: Verificação automática de campos obrigatórios
- **Análise de IA**: Processamento de sentimento via OpenAI
- **Notificações**: Alertas por email para situações críticas
- **Persistência**: Armazenamento em banco PostgreSQL ( Verificar Hostinguer 50G NvMe)


## Fluxo de Trabalho

1. **Planejamento** → Dados básicos da operação
2. **Triagem** → Análise de protocolos e OS
3. **Execução** → Registro de atividades realizadas
4. **Supervisão** → Avaliação e feedback
5. **Relatórios** → Consolidação e envio

## Integração com n8n

O sistema está preparado para integração com n8n através de webhooks. Cada etapa do fluxo envia dados para workflows específicos que:

- Validam informações
- Calculam métricas automaticamente
- Enviam notificações
- Armazenam dados no banco
- Geram relatórios automáticos

### Webhooks Configurados

- `/webhook/planejamento` - Processa dados do planejamento
- `/webhook/triagem` - Analisa protocolos e gera alertas
- `/webhook/execucao` - Calcula eficiência e métricas
- `/webhook/supervisao` - Análise de sentimento via IA
- `/webhook/relatorios` - Gera relatório final consolidado

## Banco de Dados

### Tabela: diario_planejamento
Armazena todos os dados do fluxo de trabalho diário.

### Tabela: relatorios_diarios
Armazena relatórios consolidados em formato JSON.

## Características do Design

### Paleta de Cores
- **Azul claro**: #e0f7fa (fundo)
- **Verde escuro**: #00796b (cabeçalho)
- **Verde médio**: #26a69a (botões)
- **Verde muito escuro**: #004d40 (rodapé)

### Interface
- Design intuitivo e responsivo
- Navegação por abas com indicadores visuais
- Animações suaves entre etapas
- Notificações em tempo real
- Formulários com validação automática


## Benefícios

- **Otimização de Tempo**: Fluxo estruturado e automático
- **Redução de Erros**: Validações e cálculos automáticos
- **Visibilidade**: Indicadores visuais de status e progresso
- **Automação**: Integração com n8n para processos automáticos
- **Relatórios**: Geração automática de relatórios consolidados
- **Alertas**: Notificações proativas para situações críticas

## Futuras Melhorias

- Integração com APIs externas
- Dashboard analítico
- Relatórios avançados com gráficos
- Aplicativo mobile nativo (pode não acontecer)
- Integração com sistemas Gestão deestoque simplificado
- Machine Learning  (guido)



