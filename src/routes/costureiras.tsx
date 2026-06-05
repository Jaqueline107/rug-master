import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { FormDialog, EditButton, DeleteButton } from "@/components/crud-helpers";
import { useList, useUpsert, useDelete } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/costureiras")({
  head: () => ({ meta: [{ title: "Costureiras" }] }),
  component: CostureirasPage,
});

type Costureira = {
  id: string; nome: string; telefone: string | null;
  endereco: string | null; observacoes: string | null; ativa: boolean;
};

function CostureirasPage() {
  const { data: list = [], isLoading } = useList<Costureira>("costureiras", { order: "nome" });
  const upsert = useUpsert("costureiras");
  const del = useDelete("costureiras");
  const [editing, setEditing] = useState<Partial<Costureira> | null>(null);

  return (
    <>
      <PageHeader
        title="Costureiras"
        description="Cadastro das costureiras terceirizadas"
        action={
          <Button onClick={() => setEditing({ ativa: true })}>
            <Plus className="h-4 w-4 mr-2" /> Nova costureira
          </Button>
        }
      />

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && list.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma costureira cadastrada</TableCell></TableRow>
            )}
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.telefone || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.endereco || "—"}</TableCell>
                <TableCell>
                  {c.ativa ? (
                    <Badge variant="secondary">Ativa</Badge>
                  ) : (
                    <Badge variant="outline">Inativa</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <EditButton onClick={() => setEditing(c)} />
                  <DeleteButton onConfirm={() => del.mutate(c.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <FormDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          title={editing.id ? "Editar costureira" : "Nova costureira"}
          onSubmit={async () => {
            await upsert.mutateAsync(editing);
            setEditing(null);
          }}
        >
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              required
              value={editing.nome || ""}
              onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={editing.telefone || ""}
              onChange={(e) => setEditing({ ...editing, telefone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input
              value={editing.endereco || ""}
              onChange={(e) => setEditing({ ...editing, endereco: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={editing.observacoes || ""}
              onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={editing.ativa ?? true}
              onCheckedChange={(v) => setEditing({ ...editing, ativa: v })}
            />
            <Label>Ativa</Label>
          </div>
        </FormDialog>
      )}
    </>
  );
}
