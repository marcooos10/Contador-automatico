# Contador automático — RU UFAC

> **Exclusivo para o site E-ticket da UFAC** (`https://sistemas.ufac.br/eticket/*`) e destinado aos **bolsistas do Restaurante Universitário (RU) com acesso autorizado à tela de validação**.

Este projeto é uma ferramenta auxiliar e não oficial. Não funciona fora do domínio do E-ticket, não concede credenciais ou permissões, não dispensa autenticação e não substitui os procedimentos institucionais.

## Funcionalidades — v1.6.0

- Conta +1 quando `#message-box` exibe uma mensagem `alert-success` reconhecida:
  - `Refeição validada com sucesso!`
  - `Usuário gratuito, refeição validada sem desconto de crédito.`
  - `Ticket validado com sucesso!`
- Outros avisos geram ❌ sem acréscimo.
- Exibe total e horário da última validação; correção manual +1, −1 e Zerar com confirmação.
- Cinco temas (escuro, branco, azul, rosa e vermelho) e decoração 🎄🎅 opcional.
- Armazena os dados localmente, sem sincronização online.

## Instalação

1. No navegador do computador autorizado do RU, instale/habilite o Tampermonkey.
2. Importe ou copie o conteúdo de `contador-ru.user.js` no Tampermonkey.
3. Acesse `https://sistemas.ufac.br/eticket/` com sua conta autorizada e confira a operação.

O userscript está configurado com `@match https://sistemas.ufac.br/eticket/*` e **não atua em outros sites**.

## Observações importantes

Este script apenas observa as notificações da página. **Não faz validações de refeições, não envia solicitações ao servidor e não substitui o registro oficial**. Se uma refeição for registrada mas o E-ticket exibir apenas erro, a contagem auxiliar poderá precisar de ajuste manual. O total não zera automaticamente a cada dia.

Projeto independente, sem vínculo ou endosso oficial da UFAC.
