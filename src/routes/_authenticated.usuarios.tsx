import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import {
  ALL_RESOURCES,
  ALL_ACTIONS,
  RESOURCE_LABELS,
  type AppResource,
  type AppAction,
  useSession,
} from "@/lib/permissions";
import {
  adminCreateUser,
  adminUpdatePermissions,
  adminResetPassword,
  adminSetActive,
  adminDeleteUser,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários" }] }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw redirect({ to: "/" });
  },
  component: UsuariosPage,
});

type PermSet = Set<string>;

function UsuariosPage() {
  const qc = useQueryClient();
  const { userId: meuId } = useSession();
  const [editUser, setEditUser] = useState<any | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const [pRes, rRes, permRes] = await Promise.all([
        supabase.from("profiles").select("*").order("nome"),
        supabase.from("user_roles").select("*"),
        supabase.from("user_permissions").select("*"),
      ]);
      return (pRes.data ?? []).map((p: any) => ({
        ...p,
        isAdmin: (rRes.data ?? []).some((r: any) => r.user_id === p.id && r.role === "admin"),
        permissions: (permRes.data ?? []).filter((x: any) => x.user_id === p.id),
      }));
    },
  });

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Cadastro e permissões"
        action={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo usuário
          </Button>
        }
      />

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nome || "—"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {u.isAdmin ? <Badge>Admin</Badge> : <Badge variant="secondary">Usuário</Badge>}
                </TableCell>
                <TableCell>
                  {u.ativo ? <span className="text-success text-sm">Ativo</span> : <span className="text-muted-foreground text-sm">Inativo</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditUser(u)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NewUserDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onSaved={() => qc.invalidateQueries({ queryKey: ["usuarios"] })}
      />
      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        meuId={meuId}
        onSaved={() => qc.invalidateQueries({ queryKey: ["usuarios"] })}
      />
    </>
  );
}

function PermissionsMatrix({
  perms,
  isAdmin,
  onToggle,
  onAdminChange,
}: {
  perms: PermSet;
  isAdmin: boolean;
  onToggle: (r: AppResource, a: AppAction) => void;
  onAdminChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-muted rounded">
        <Switch checked={isAdmin} onCheckedChange={onAdminChange} />
        <div>
          <p className="text-sm font-medium">Administrador</p>
          <p className="text-xs text-muted-foreground">Acesso total; ignora a matriz abaixo</p>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aba</TableHead>
              <TableHead className="text-center">Ver</TableHead>
              <TableHead className="text-center">Criar</TableHead>
              <TableHead className="text-center">Editar</TableHead>
              <TableHead className="text-center">Excluir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALL_RESOURCES.map((r) => (
              <TableRow key={r} className={isAdmin ? "opacity-50" : ""}>
                <TableCell className="font-medium">{RESOURCE_LABELS[r]}</TableCell>
                {ALL_ACTIONS.map((a) => (
                  <TableCell key={a} className="text-center">
                    <Checkbox
                      disabled={isAdmin}
                      checked={perms.has(`${r}:${a}`)}
                      onCheckedChange={() => onToggle(r, a)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NewUserDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const createFn = useServerFn(adminCreateUser);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState<PermSet>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(r: AppResource, a: AppAction) {
    setPerms((s) => {
      const n = new Set(s);
      const k = `${r}:${a}`;
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }

  function reset() {
    setNome(""); setEmail(""); setSenha(""); setIsAdmin(false); setPerms(new Set());
  }

  async function salvar() {
    if (!nome || !email || senha.length < 6) return toast.error("Preencha nome, e-mail e senha (mín. 6)");
    setSaving(true);
    try {
      await createFn({
        data: {
          nome, email, password: senha, isAdmin,
          permissions: Array.from(perms).map((k) => {
            const [resource, action] = k.split(":");
            return { resource, action };
          }),
        },
      });
      toast.success("Usuário criado");
      reset();
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Senha inicial</Label><Input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
          <PermissionsMatrix perms={perms} isAdmin={isAdmin} onToggle={toggle} onAdminChange={setIsAdmin} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Criar usuário"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose, onSaved, meuId }: { user: any | null; onClose: () => void; onSaved: () => void; meuId: string | null }) {
  const updateFn = useServerFn(adminUpdatePermissions);
  const resetPassFn = useServerFn(adminResetPassword);
  const setActiveFn = useServerFn(adminSetActive);
  const deleteFn = useServerFn(adminDeleteUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState<PermSet>(new Set());
  const [novaSenha, setNovaSenha] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSelf = user?.id === meuId;

  // sync when user changes
  const uid = user?.id;
  if (user && (isAdmin !== user.isAdmin || (user as any).__loaded !== uid)) {
    setIsAdmin(user.isAdmin);
    setPerms(new Set(user.permissions.map((p: any) => `${p.resource}:${p.action}`)));
    setAtivo(user.ativo);
    (user as any).__loaded = uid;
  }

  function toggle(r: AppResource, a: AppAction) {
    setPerms((s) => {
      const n = new Set(s);
      const k = `${r}:${a}`;
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }

  async function salvar() {
    if (!user) return;
    setSaving(true);
    try {
      await updateFn({
        data: {
          userId: user.id, isAdmin,
          permissions: Array.from(perms).map((k) => {
            const [resource, action] = k.split(":");
            return { resource, action };
          }),
        },
      });
      toast.success("Permissões atualizadas");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetarSenha() {
    if (!user || novaSenha.length < 6) return toast.error("Mín. 6 caracteres");
    try {
      await resetPassFn({ data: { userId: user.id, password: novaSenha } });
      toast.success("Senha redefinida");
      setNovaSenha("");
    } catch (e: any) { toast.error(e.message); }
  }

  async function toggleAtivo(v: boolean) {
    if (!user) return;
    try {
      await setActiveFn({ data: { userId: user.id, ativo: v } });
      setAtivo(v);
      onSaved();
      toast.success(v ? "Usuário ativado" : "Usuário desativado");
    } catch (e: any) { toast.error(e.message); }
  }

  async function excluir() {
    if (!user) return;
    if (!confirm(`Excluir usuário ${user.nome}? Essa ação é permanente.`)) return;
    try {
      await deleteFn({ data: { userId: user.id } });
      toast.success("Usuário excluído");
      onSaved();
      onClose();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Editar {user?.nome}</DialogTitle></DialogHeader>
        {user && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded">
              <Switch checked={ativo} disabled={isSelf} onCheckedChange={toggleAtivo} />
              <div className="flex-1">
                <p className="text-sm font-medium">{ativo ? "Ativo" : "Inativo"}</p>
                {isSelf && <p className="text-xs text-muted-foreground">Você não pode desativar a si mesmo</p>}
              </div>
            </div>

            <PermissionsMatrix perms={perms} isAdmin={isAdmin} onToggle={toggle} onAdminChange={setIsAdmin} />

            <div className="border rounded-lg p-4 space-y-2">
              <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Redefinir senha</Label>
              <div className="flex gap-2">
                <Input type="text" placeholder="Nova senha (mín. 6)" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
                <Button variant="outline" onClick={resetarSenha}>Redefinir</Button>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" onClick={excluir} disabled={isSelf} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Excluir usuário
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar permissões"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
