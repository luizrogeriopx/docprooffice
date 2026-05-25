# Compartilhamento com 3 tipos de link

## O que será criado

Cada documento poderá gerar **3 links distintos**, cada um com comportamento próprio:

1. **Link de Visualização** — quem abre só lê o documento (sem editar, sem copiar para a conta).
2. **Link de Duplicar (fork)** — quem abre, ao entrar logado, recebe uma **cópia independente** na própria conta. O documento original não é alterado. Cada pessoa que usar o link gera a sua cópia.
3. **Link de Colaboração** — quem abre vira **colaborador do documento original**. Edições aparecem para o dono e para todos os colaboradores (edição compartilhada). O criador pode **remover colaboradores** a qualquer momento.

## Mudanças no banco (migration)

- Nova tabela `share_links`: `id`, `document_id`, `owner_id`, `mode` ('view' | 'fork' | 'collab'), `token` (único, aleatório), `created_at`.
  - Cada documento tem no máximo 1 link por modo (constraint único em `document_id + mode`). Regenerar invalida o anterior.
- Nova tabela `document_collaborators`: `document_id`, `user_id`, `added_at`. PK composta.
- Atualizar RLS de `documents`:
  - SELECT: dono **OU** colaborador **OU** existe `share_link` modo view/fork/collab para o doc (via SECURITY DEFINER function que valida token recebido — ver abaixo).
  - UPDATE: dono **OU** colaborador.
  - DELETE: só dono.
- RLS de `share_links`: dono gerencia (CRUD). SELECT por token via função pública.
- RLS de `document_collaborators`: dono insere/remove; colaborador vê o próprio registro.
- Função `get_share_link(token text)` SECURITY DEFINER → retorna `{document_id, mode, owner_id}` se token existir.
- Função `accept_collab_invite(token text)` SECURITY DEFINER → se token é modo `collab`, insere o `auth.uid()` em `document_collaborators`.
- Função `fork_document(token text)` SECURITY DEFINER → se token é modo `fork`, cria uma cópia do documento na conta do `auth.uid()` e retorna o novo id.

## Frontend

### Dashboard (`src/routes/dashboard.tsx`)
- Substituir o menu de compartilhamento atual por um **diálogo "Compartilhar"** com 3 abas/seções:
  - **Visualização** — botão "Gerar/Copiar link"
  - **Duplicar** — botão "Gerar/Copiar link" + texto explicativo
  - **Colaborar** — botão "Gerar/Copiar link" + lista de colaboradores atuais com botão de remover (X) ao lado de cada um (só visível para o dono)
- Cada seção também mostra botões rápidos de WhatsApp / Email / Drive para o link gerado.

### Nova rota `/share/$token` (`src/routes/share.$token.tsx`)
- Resolve o token via `get_share_link`.
- Se modo `view`: redireciona para `/doc/$id` (a página do editor entra em modo somente-leitura quando o usuário não é dono nem colaborador — já permitido pela RLS de SELECT).
- Se modo `fork`: exige login → chama `fork_document` → redireciona para o novo doc.
- Se modo `collab`: exige login → chama `accept_collab_invite` → redireciona para `/doc/$id`.

### Editor (`src/routes/doc.$id.tsx`)
- Detectar se o usuário atual é dono, colaborador ou só visualizador.
- Visualizador: editor em `editable: false`, toolbar oculta, botão "Salvar" oculto.
- Colaborador: edita normalmente (escreve no doc original via UPDATE permitido pela RLS).
- Dono no modo colab: aparece seção "Colaboradores" no menu compartilhar com lista + botão remover.

### Realtime (já existe no projeto)
- `documents` já está em `supabase_realtime`. Em modo colab, o editor escuta mudanças do mesmo `document_id` e atualiza o conteúdo quando outro colaborador salva (debounce básico, last-write-wins — sem CRDT/OT nesta fase).

## Detalhes técnicos

- Tokens: 32 chars base62 gerados client-side via `crypto.getRandomValues`.
- URLs de compartilhamento: `${origin}/share/${token}`.
- O link de "view" funciona **sem login** (RLS via função SECURITY DEFINER que aceita o token).
- Os links de "fork" e "collab" **exigem login** (redirecionam para `/login?next=/share/...` se não autenticado).
- Limitação assumida: sincronização realtime em colab é simples (last-write-wins por save). Edição simultânea no mesmo parágrafo pode causar perda; aviso será exibido. Se quiser CRDT (Yjs) avise — é trabalho maior.

## Arquivos tocados
- Migration nova (tabelas + RLS + 3 funções).
- `src/routes/dashboard.tsx` — novo diálogo de compartilhar.
- `src/routes/share.$token.tsx` — nova rota.
- `src/routes/doc.$id.tsx` — modo somente-leitura + realtime para colab + UI de colaboradores.
- `src/components/ShareDialog.tsx` — novo componente do diálogo.

Confirma para eu seguir?