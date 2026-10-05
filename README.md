# Projeto-CCO

Painel OPE (Overall Production Effectiveness) para a operação de Iluminação Pública CWB / ENGIE.

## Correções recentes

- **Casamento de paradas × equipes com sufixo de empresa variável**  
  O vínculo entre parada e execução passou a ignorar qualquer sufixo do tipo `" | EMPRESA"` (ex.: `" | ENGIE"`, `" | ENGE"`, etc.). Antes o código removia apenas `" | ENGIE"`, então paradas registradas como `"Man-IP-05 | ENGE"` não eram descontadas da disponibilidade da equipe `"Man-IP-05 | ENGIE"`, fazendo o OPE ignorar eventos como paradas por chuva.
