import { createFileRoute } from "@tanstack/react-router";
import { faixaAnosTapete } from "@/lib/nome-tapete";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { FormDialog, EditButton, DeleteButton } from "@/components/crud-helpers";
import { useList, useUpsert, useDelete } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/modelos-tapetes")({
  head: () => ({ meta: [{ title: "Modelos de Tapete" }] }),
  component: TapetesPage,
});

const MATERIAIS = ["Frisado", "Carpete", "Canelado"] as const;
type Material = (typeof MATERIAIS)[number];

type Tapete = { id: string; codigo: string | null; nome: string; tipo_tapete_id: string; cor: string | null; observacoes: string | null; ano_inicio: number | null; ano_fim: number | null; materiais: Material[]; servicos_permitidos: string[] };
type Tipo = { id: string; nome: string };

function TapetesPage() {
  const { data: list = [], isLoading } = useList<Tapete & { tipos_tapete?: { nome: string } | null }>("tapetes", { select: "*, tipos_tapete(nome)", order: "nome" });
  const { data: tipos = [] } = useList<Tipo>("tipos_tapete", { order: "nome" });
  const { data: servicos = [], isLoading: carregandoServicos, isError: erroServicos } = useList<Tipo>("servicos", { order: "nome" });
  const upsert = useUpsert("tapetes");
  const del = useDelete("tapetes");
  const [editing, setEditing] = useState<Partial<Tapete> | null>(null);
  const [todosOsAnos, setTodosOsAnos] = useState(true);

  return (
    <>
      <PageHeader
        title="Modelos de Tapete"
        description="Modelos de tapete que você produz"
        action={
          <Button onClick={() => { setTodosOsAnos(true); setEditing({}); }} disabled={tipos.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Novo Modelo
          </Button>
        }
      />

      {tipos.length === 0 && (
        <div className="bg-warning/10 border border-warning/30 text-warning-foreground rounded-lg p-4 mb-4 text-sm">
          Cadastre ao menos um <strong>tipo de tapete</strong> antes de criar modelos.
        </div>
      )}

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Compatibilidade</TableHead>
              <TableHead>Materiais</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && list.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum tapete cadastrado</TableCell></TableRow>}
            {list.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-sm">{t.codigo || "—"}</TableCell>
                <TableCell className="font-medium">{t.nome}</TableCell>
                <TableCell>{t.tipos_tapete?.nome}</TableCell>
                <TableCell>{faixaAnosTapete(t.ano_inicio, t.ano_fim)}</TableCell>
                <TableCell>{t.materiais?.length ? t.materiais.join(", ") : "—"}</TableCell>
                <TableCell className="text-right">
                  <EditButton onClick={() => { setTodosOsAnos(t.ano_inicio == null); setEditing(t); }} />
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
            const inicio = todosOsAnos ? null : editing.ano_inicio ?? null;
            const fim = todosOsAnos ? null : editing.ano_fim ?? null;
            if (!todosOsAnos && (inicio == null || !Number.isInteger(inicio) || inicio < 1900 || inicio > 9999)) {
              toast.error("Informe um ano de início válido.");
              return;
            }
            if (fim != null && (!Number.isInteger(fim) || fim > 9999 || inicio == null || fim < inicio)) {
              toast.error("O ano fim deve ser válido e igual ou posterior ao ano início.");
              return;
            }
            const { id, codigo, nome, tipo_tapete_id, cor, observacoes } = editing;
            await upsert.mutateAsync({ id, codigo, nome, tipo_tapete_id, cor, observacoes, ano_inicio: inicio, ano_fim: fim, materiais: editing.materiais ?? [], servicos_permitidos: editing.servicos_permitidos ?? [] });
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
            <Label id="tapete-compatibilidade-label">Compatibilidade</Label>
            <Select value={todosOsAnos ? "todos" : "faixa"} onValueChange={(v) => setTodosOsAnos(v === "todos")}>
              <SelectTrigger aria-labelledby="tapete-compatibilidade-label"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os anos</SelectItem>
                <SelectItem value="faixa">Faixa de anos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!todosOsAnos && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tapete-ano-inicio">Ano início *</Label>
                <Input id="tapete-ano-inicio" type="number" required min={1900} max={9999} step={1}
                  value={editing.ano_inicio ?? ""} onChange={(e) => setEditing({ ...editing, ano_inicio: e.target.value === "" ? null : e.target.valueAsNumber })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tapete-ano-fim">Ano fim</Label>
                <Input id="tapete-ano-fim" type="number" min={editing.ano_inicio ?? 1900} max={9999} step={1}
                  aria-describedby="tapete-ano-fim-ajuda" value={editing.ano_fim ?? ""}
                  onChange={(e) => setEditing({ ...editing, ano_fim: e.target.value === "" ? null : e.target.valueAsNumber })} />
                <p id="tapete-ano-fim-ajuda" className="text-xs text-muted-foreground">Deixe em branco para indicar “até atual”.</p>
              </div>
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Materiais</legend>
            <div className="flex flex-wrap gap-4">
              {MATERIAIS.map((material) => (
                <div key={material} className="flex items-center gap-2">
                  <Checkbox
                    id={"tapete-material-" + material}
                    checked={editing.materiais?.includes(material) ?? false}
                    onCheckedChange={(checked) => setEditing((current) => {
                      if (!current) return current;
                      const selecionados = new Set(current.materiais);
                      if (checked === true) selecionados.add(material);
                      else selecionados.delete(material);
                      return { ...current, materiais: MATERIAIS.filter((item) => selecionados.has(item)) };
                    })}
                  />
                  <Label htmlFor={"tapete-material-" + material}>{material}</Label>
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Serviços permitidos</legend>
            <p className="text-xs text-muted-foreground">Só os serviços marcados poderão ser escolhidos na Nova Remessa.</p>
            {carregandoServicos ? <p className="text-sm text-muted-foreground">Carregando serviços...</p>
              : erroServicos ? <p className="text-sm text-destructive" role="alert">Não foi possível carregar os serviços.</p>
              : servicos.length === 0 ? <p className="text-sm text-muted-foreground">Cadastre um serviço para vinculá-lo ao modelo.</p>
              : <div className="flex flex-wrap gap-4">
                {servicos.map((servico) => (
                  <div key={servico.id} className="flex items-center gap-2">
                    <Checkbox
                      id={"tapete-servico-" + servico.id}
                      checked={editing.servicos_permitidos?.includes(servico.id) ?? false}
                      onCheckedChange={(checked) => setEditing((current) => {
                        if (!current) return current;
                        const selecionados = new Set(current.servicos_permitidos);
                        if (checked === true) selecionados.add(servico.id);
                        else selecionados.delete(servico.id);
                        return { ...current, servicos_permitidos: [...selecionados] };
                      })}
                    />
                    <Label htmlFor={"tapete-servico-" + servico.id}>{servico.nome}</Label>
                  </div>
                ))}
              </div>}
          </fieldset>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={editing.observacoes || ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} />
          </div>
        </FormDialog>
      )}
    </>
  );
}
