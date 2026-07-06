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

export const Route = createFileRoute("/tipos-tapete")({
  head: () => ({ meta: [{ title: "Tipos de Tapete" }] }),
  component: TiposPage,
});

type Tipo = { id: string; nome: string; numero_pecas: number; descricao: string | null };

function TiposPage() {
  const { data: list = [], isLoading } = useList<Tipo>("tipos_tapete", { order: "nome" });
  const upsert = useUpsert("tipos_tapete");
  const del = useDelete("tipos_tapete");
  const [editing, setEditing] = useState<Partial<Tipo> | null>(null);

  return (
    <>
      <PageHeader
        title="Tipos de Tapete"
        description="Ex: Kit Banheiro 3 peças, Tapete simples, Jogo de cozinha"
        action={
          <Button onClick={() => setEditing({ numero_pecas: 1 })}>
            <Plus className="h-4 w-4 mr-2" /> Novo tipo
          </Button>
        }
      />

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-32">Nº de peças</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && list.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum tipo cadastrado</TableCell></TableRow>}
            {list.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.nome}</TableCell>
                <TableCell>{t.numero_pecas}</TableCell>
                <TableCell className="text-muted-foreground">{t.descricao || "—"}</TableCell>
                <TableCell className="text-right">
                  <EditButton onClick={() => setEditing(t)} />
                  <DeleteButton onConfirm={() => del.mutate(t.id)} />
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
          title={editing.id ? "Editar tipo" : "Novo tipo de tapete"}
          onSubmit={async () => { await upsert.mutateAsync(editing); setEditing(null); }}
        >
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input required value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Número de peças *</Label>
            <Input type="number" min={1} required value={editing.numero_pecas ?? 1} onChange={(e) => setEditing({ ...editing, numero_pecas: parseInt(e.target.value) || 1 })} />
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
