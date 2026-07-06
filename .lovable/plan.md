Plano combinado: **módulo de pagamentos** (versão anterior aprovada) + **sistema de usuários com permissões granulares** criados pelo admin.

---

## Parte 1 — Pagamentos às costureiras

### Fluxo
1. Aba **Pagamentos** → botão "Novo pagamento"
2. Escolhe costureira → sistema lista remessas dela ainda não pagas (concluídas + parciais com peças retornadas), já com valor a pagar calculado
3. Marca quais remessas incluir (padrão: todas)
4. Botão **"Exportar PDF"** gera relatório pré-pagamento (cabeçalho da costureira, tabela de remessas/itens/valores, total) — pra imprimir/enviar antes de pagar
5. Confirma: data, forma (Pix/dinheiro/transferência), observação, **upload do comprovante** (imagem/PDF)
6. Remessas quitadas somem da próxima seleção

**Valor por remessa** = soma de `preço_unitário × quantidade_retornada`. Se voltarem mais peças depois, o restante entra em pagamento futuro.

### Novas telas
- **Pagamentos** (lista com filtros por costureira/período, link do comprovante)
- **Novo pagamento** (wizard: costureira → seleção + PDF → confirmação com upload)
- **Detalhe do pagamento** (dados, remessas quitadas, comprovante, baixar PDF)

### Ajustes
- Detalhe da remessa: badge "Pago / A pagar R$ X / Pago parcialmente"
- Dashboard: card "A pagar este mês" por costureira
- Sidebar: item "Pagamentos"

---

## Parte 2 — Usuários e permissões

### Fluxo
- **Tela de login** (email + senha) na rota pública `/auth`
- Não há cadastro público. Só o **admin** cria usuários pela tela **Usuários**
- Ao criar usuário: admin define email, senha inicial, e marca em uma matriz o que ele pode fazer
- Usuário faz login, vê só as abas permitidas, e dentro de cada aba os botões (Novo, Editar, Excluir) aparecem só se tiver permissão
- O primeiro usuário do sistema vira admin automaticamente (você)

### Matriz de permissões (por aba × ação)
Cada aba do sistema (Dashboard, Costureiras, Tipos de Tapete, Modelos, Insumos, Serviços, Preços, Remessas, Pagamentos, Usuários) tem 4 checkboxes:

| Aba         | Ver | Criar | Editar | Excluir |
|-------------|-----|-------|--------|---------|
| Costureiras | ☑   | ☑     | ☐      | ☐       |
| Remessas    | ☑   | ☑     | ☑      | ☐       |
| ...         |     |       |        |         |

- **Ver desmarcado** → aba some da sidebar e a rota redireciona
- **Criar desmarcado** → botão "Novo" some
- **Editar desmarcado** → botão de editar some e a linha fica só leitura
- **Excluir desmarcado** → botão de lixeira some
- **Admin** tem tudo automaticamente (não aparece na matriz — é implícito)

### Tela "Usuários" (só admin vê)
- Lista de usuários com nome, email, admin sim/não, ativo sim/não
- Botão "Novo usuário" abre modal: nome, email, senha inicial, checkbox "É admin", matriz de permissões
- Editar usuário: mesma matriz + botão "Redefinir senha" + toggle "Ativo"
- Não permite excluir/desativar o próprio usuário logado

### Ajustes em telas existentes
- Sidebar filtra itens pelo que o usuário pode ver + mostra nome do usuário logado + botão "Sair"
- Todos os botões Novo/Editar/Excluir passam a checar permissão antes de renderizar
- Header ganha menu com nome + logout

---

## Detalhes técnicos

### Backend — pagamentos
Novas tabelas:
- `pagamentos` (costureira_id, data_pagamento, valor_total, forma_pagamento, comprovante_url, observacoes)
- `pagamento_remessas` (pagamento_id, remessa_id, valor_pago) — trava valor no momento
- View `remessas_a_pagar`: `valor_devido` (itens retornados) − `valor_ja_pago` = `valor_pendente`
- Trigger recalcula `valor_ja_pago` da remessa ao inserir/remover linhas
- Bucket privado **`comprovantes`** com URLs assinadas

PDF: `jspdf` + `jspdf-autotable` no cliente.

### Backend — usuários e permissões
- **Auth do Lovable Cloud** com email/senha, sem cadastro público (`disable_signup: true`), auto-confirm ligado (admin cria usuário já pronto pra logar)
- Tabela `profiles` (id = auth.users.id, nome, ativo)
- Enum `app_role` = `admin | user`
- Tabela `user_roles` (user_id, role) — separada por segurança (não guarda role em profiles)
- Enum `app_resource` = `costureiras | tipos_tapete | modelos_tapetes | insumos | servicos | precos | remessas | pagamentos | usuarios | dashboard`
- Enum `app_action` = `view | create | update | delete`
- Tabela `user_permissions` (user_id, resource, action, PRIMARY KEY (user_id, resource, action))
- Função `has_role(uuid, app_role)` (SECURITY DEFINER) — usada em RLS
- Função `can(uuid, app_resource, app_action)` (SECURITY DEFINER) → `true` se admin, senão consulta `user_permissions`
- **RLS em todas as tabelas do domínio** substitui as policies abertas atuais:
  - `SELECT` requer `can(auth.uid(), '<resource>', 'view')`
  - `INSERT` requer `can(..., 'create')` (via WITH CHECK)
  - `UPDATE` requer `can(..., 'update')`
  - `DELETE` requer `can(..., 'delete')`
- `user_permissions` / `user_roles` / `profiles`: só admin gerencia; usuário lê o próprio
- Trigger `handle_new_user` cria `profiles` no signup; primeiro usuário criado ganha role `admin` automaticamente
- Bucket `comprovantes`: policies permitem read/write para quem tem permissão em `pagamentos`

### Frontend — auth e permissões
- Rota pública `/auth` com formulário de login (não permite signup)
- Layout `_authenticated` já existe (integração) — mover todas as rotas do domínio pra baixo dele
- Hook `usePermissions()` carrega roles + permissions do usuário logado numa query cacheada
- Helper `<Can resource="remessas" action="create">…</Can>` e `usePermission(res, act)` pra esconder botões
- Sidebar filtra itens pelo `view` de cada aba
- Rota `/usuarios` protegida por `has_role('admin')` — redireciona se não for admin
- Página de usuários usa Supabase Auth Admin API via **server function** (`createServerFn` + `requireSupabaseAuth` + checagem de admin) pra criar/resetar senha/desativar (essas operações precisam de service role)

### Segurança
- Roles nunca em `profiles` (evita escalada de privilégio)
- Todas as checagens de permissão duplicadas: cliente (UX) + RLS (segurança real)
- Server functions admin conferem `has_role('admin')` antes de qualquer operação privilegiada
- Auth: `disable_signup: true`, HIBP ligado, sem OAuth (só email/senha nesta fase)

### Migração dos dados existentes
Suas remessas, costureiras e cadastros atuais ficam intactos — só as policies mudam. O primeiro login (você) vira admin e enxerga tudo.

---

Ordem sugerida de implementação (uma coisa por vez pra você acompanhar):
1. Pagamentos + PDF + upload de comprovante
2. Auth (login, disable signup, layout protegido)
3. Tabelas de roles/permissões + RLS + tela de Usuários com matriz