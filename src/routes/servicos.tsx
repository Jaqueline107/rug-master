import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { FormDialog, EditButton, DeleteButton } from "@/components/crud-helpers";
import { useList, useUpsert, useDelete } from "@/lib/data";

export const Route = createFileRoute("/servicos")({
  head: () => ({ meta: [{ title: "Serviços" }] }),
  component: ServicosPage,
});

type Servico = { id: string; nome: string; insumo_id: string | null; descricao: string | null };
type Insumo = { id: string; nome: string };

function ServicosPage() {
  const { data: list = [], isLoading } = useList<any>("servicos", { select: "*, insumos(nome)", order: "nome" });
  const { data: insumos = [] } = useList<Insumo>("insumos", { order: "nome" });
  const upsert = useUpsert("servicos");
  const del = useDelete("servicos");
  const [editing, setEditing] = useState<Partial<Servico> | null>(null);

  return (
    <>
      <PageHeader
        title="Serviços"
        description="Tipos de serviço que as costureiras fazem (overlock, franja, lavagem...)"
        action={
          <Button onClick={() => setEditing({})}>
            <Plus className="h-4 w-4 mr-2" /> Novo serviço
          </Button>
        }
      />

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Insumo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && list.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum serviço cadastrado</TableCell></TableRow>}
            {list.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell>{s.insumos?.nome || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{s.descricao || "—"}</TableCell>
                <TableCell className="text-right">
                  <EditButton onClick={() => setEditing(s)} />
                  <DeleteButton onConfirm={() => del.mutate(s.id)} />
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
          title={editing.id ? "Editar serviço" : "Novo serviço"}
          onSubmit={async () => {
            const { insumos: _, ...payload } = editing as any;
            await upsert.mutateAsync(payload);
            setEditing(null);
          }}
        >
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input required value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Insumo usado</Label>
            <Select
              value={editing.insumo_id || "__none__"}
              onValueChange={(v) => setEditing({ ...editing, insumo_id: v === "__none__" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {insumos.map((i) => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={editing.descricao || ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
          </div>
        </FormDialog>
      )}
    </>
  );
}
