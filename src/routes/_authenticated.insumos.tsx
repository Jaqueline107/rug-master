import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { FormDialog, EditButton, DeleteButton } from "@/components/crud-helpers";
import { useList, useUpsert, useDelete } from "@/lib/data";

export const Route = createFileRoute("/insumos")({
  head: () => ({ meta: [{ title: "Insumos" }] }),
  component: InsumosPage,
});

type Insumo = { id: string; nome: string; unidade: string; observacoes: string | null };

function InsumosPage() {
  const { data: list = [], isLoading } = useList<Insumo>("insumos", { order: "nome" });
  const upsert = useUpsert("insumos");
  const del = useDelete("insumos");
  const [editing, setEditing] = useState<Partial<Insumo> | null>(null);

  return (
    <>
      <PageHeader
        title="Insumos"
        description="Materiais usados pelos serviços (linha, viés, fita, etc.)"
        action={
          <Button onClick={() => setEditing({ unidade: "un" })}>
            <Plus className="h-4 w-4 mr-2" /> Novo insumo
          </Button>
        }
      />

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-24">Unidade</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && list.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum insumo cadastrado</TableCell></TableRow>}
            {list.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.nome}</TableCell>
                <TableCell>{i.unidade}</TableCell>
                <TableCell className="text-muted-foreground">{i.observacoes || "—"}</TableCell>
                <TableCell className="text-right">
                  <EditButton onClick={() => setEditing(i)} />
                  <DeleteButton onConfirm={() => del.mutate(i.id)} />
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
          title={editing.id ? "Editar insumo" : "Novo insumo"}
          onSubmit={async () => { await upsert.mutateAsync(editing); setEditing(null); }}
        >
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input required value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Unidade *</Label>
            <Input required placeholder="un, m, kg..." value={editing.unidade || ""} onChange={(e) => setEditing({ ...editing, unidade: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={editing.observacoes || ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} />
          </div>
        </FormDialog>
      )}
    </>
  );
}
