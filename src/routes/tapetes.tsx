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

export const Route = createFileRoute("/tapetes")({
  head: () => ({ meta: [{ title: "Tapetes" }] }),
  component: TapetesPage,
});

type Tapete = { id: string; codigo: string | null; nome: string; tipo_tapete_id: string; cor: string | null; observacoes: string | null };
type Tipo = { id: string; nome: string };

function TapetesPage() {
  const { data: list = [], isLoading } = useList<any>("tapetes", { select: "*, tipos_tapete(nome)", order: "nome" });
  const { data: tipos = [] } = useList<Tipo>("tipos_tapete", { order: "nome" });
  const upsert = useUpsert("tapetes");
  const del = useDelete("tapetes");
  const [editing, setEditing] = useState<Partial<Tapete> | null>(null);

  return (
    <>
      <PageHeader
        title="Tapetes"
        description="Modelos de tapete que você produz"
        action={
          <Button onClick={() => setEditing({})} disabled={tipos.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Novo tapete
          </Button>
        }
      />

      {tipos.length === 0 && (
        <div className="bg-warning/10 border border-warning/30 text-warning-foreground rounded-lg p-4 mb-4 text-sm">
          Cadastre ao menos um <strong>tipo de tapete</strong> antes de criar tapetes.
        </div>
      )}

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && list.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum tapete cadastrado</TableCell></TableRow>}
            {list.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-sm">{t.codigo || "—"}</TableCell>
                <TableCell className="font-medium">{t.nome}</TableCell>
                <TableCell>{t.tipos_tapete?.nome}</TableCell>
                <TableCell>{t.cor || "—"}</TableCell>
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
          title={editing.id ? "Editar tapete" : "Novo tapete"}
          onSubmit={async () => {
            const { tipos_tapete, ...payload } = editing as any;
            await upsert.mutateAsync(payload);
            setEditing(null);
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código / SKU</Label>
              <Input value={editing.codigo || ""} onChange={(e) => setEditing({ ...editing, codigo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Input value={editing.cor || ""} onChange={(e) => setEditing({ ...editing, cor: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input required value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={editing.tipo_tapete_id || ""} onValueChange={(v) => setEditing({ ...editing, tipo_tapete_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
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
