## Sistema de Controle de Remessas — Plano

Aplicação para você gerenciar tudo: cadastros, envio de tapetes para costureiras, e controle de retornos (totais ou parciais).

### Backend (Lovable Cloud)

Vou ativar o Lovable Cloud para guardar seus dados com segurança. Estrutura de tabelas:

- **costureiras** — nome, telefone, endereço, observações
- **tipos_de_tapete** — nome, número de peças, descrição (ex: "Kit Banheiro 3 peças")
- **tapetes** — código/SKU, nome, tipo de tapete, cor/modelo
- **insumos** — nome, unidade (m, un, kg), observações
- **servicos** — nome do serviço (ex: overlock, franja, lavagem), insumo usado
- **precos** — combinação **costureira + serviço + tipo de tapete → valor**. Quando você for criar uma remessa, o sistema busca o preço certo automaticamente.
- **remessas** — costureira, data de envio, data prevista de retorno, status (aberta, parcial, concluída), observações
- **remessa_itens** — cada linha de uma remessa: tapete, serviço, quantidade enviada, quantidade retornada, preço unitário (travado no momento do envio)
- **retornos** — registro de cada retorno (uma remessa pode ter vários retornos parciais), data, observações
- **retorno_itens** — qual item da remessa voltou e quantas peças

A remessa só fecha (status "concluída") quando soma dos retornos = quantidade enviada de cada item. Senão fica "parcial".

### Telas

1. **Dashboard** — remessas abertas, pendências por costureira, total a pagar no mês
2. **Costureiras** — listar, criar, editar
3. **Tipos de Tapete** — listar, criar, editar
4. **Tapetes** — listar, criar, editar (vinculado a um tipo)
5. **Insumos** — listar, criar, editar
6. **Serviços** — listar, criar, editar (vinculado a um insumo)
7. **Tabela de Preços** — matriz costureira × serviço × tipo de tapete, edição rápida inline
8. **Remessas**
   - Lista com filtros (costureira, status, período)
   - Nova remessa: escolhe costureira → adiciona linhas (tapete + serviço + quantidade), preço puxa automático da tabela, mostra total
   - Detalhe da remessa: itens com colunas "enviado / retornado / pendente"
9. **Registrar Retorno** — dentro da remessa: escolhe quanto voltou de cada item, salva como um retorno parcial; status da remessa atualiza sozinho

### Detalhes técnicos

- React + TanStack Router + TanStack Query
- Tabelas no Supabase (via Lovable Cloud) com RLS habilitada
- Como é uso pessoal (sem login agora), uso uma policy permissiva — mas a estrutura já fica pronta caso você queira adicionar login depois
- shadcn/ui para formulários, tabelas, diálogos
- Validação com Zod
- Estética: clean, profissional, paleta neutra com um acento quente (combinando com o universo têxtil)

### Fora deste escopo (posso adicionar depois se quiser)

- Login / multi-usuário
- Controle de estoque dos insumos com baixa automática
- Geração de PDF/recibo da remessa para imprimir
- Relatórios financeiros detalhados (pagamentos por costureira, exportar Excel)
- WhatsApp / notificação automática para costureira

Posso construir tudo isso agora?
