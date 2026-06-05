import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app-shell";
import { useList } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { brl } from "@/lib/data";

export const Route = createFileRoute("/precos")({
  head: () => ({ meta: [{ title: "Tabela de Preços" }] }),
  component: PrecosPage,
});

type Costureira = { id: string; nome: string; ativa: boolean };
type Servico = { id: string; nome: string };
type Tipo = { id: string; nome: string };
type Preco = { id: string; costureira_id: string; servico_id: string; tipo_tapete_id: string; valor: number };

function PrecosPage() {
  const { data: costureiras = [] } = useList<Costureira>("costureiras", { order: "nome" });
  const { data: servicos = [] } = useList<Servico>("servicos", { order: "nome" });
  const { data: tipos = [] } = useList<Tipo>("tipos_tapete", { order: "nome" });
  const { data: precos = [] } = useList<Preco>("precos");
  const qc = useQueryClient();

  const [costureiraId, setCostureiraId] = useState<string>("");

  // Pick first active by default
  const selected = costureiraId || costureiras.find((c) => c.ativa)?.id || costureiras[0]?.id || "";

  const map = useMemo(() => {
    const m = new Map<string, Preco>();
    for (const p of precos) {
      if (p.costureira_id === selected) {
        m.set(`${p.servico_id}__${p.tipo_tapete_id}`, p);
      }
    }
    return m;
  }, [precos, selected]);

  const savePrice = async (servicoId: string, tipoId: string, valor: number) => {
    if (!selected) return;
    const existing = map.get(`${servicoId}__${tipoId}`);
    try {
      if (existing) {
        if (valor === 0) {
          await supabase.from("precos").delete().eq("id", existing.id);
        } else {
          await supabase.from("precos").update({ valor }).eq("id", existing.id);
        }
      } else if (valor > 0) {
        await supabase.from("precos").insert({
          costureira_id: selected,
          servico_id: servicoId,
          tipo_tapete_id: tipoId,
          valor,
        });
      }
      qc.invalidateQueries({ queryKey: ["precos"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar preço");
    }
  };

  return (
    <>
      <PageHeader
        title="Tabela de Preços"
        description="Defina o preço de cada combinação serviço × tipo de tapete por costureira"
      />

      <div className="bg-card rounded-lg border p-4 mb-4">
        <Label className="mb-2 block">Costureira</Label>
        <Select value={selected} onValueChange={setCostureiraId}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {costureiras.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selected ? (
        <div className="bg-muted/40 rounded-lg p-8 text-center text-muted-foreground">
          Cadastre uma costureira para começar.
        </div>
      ) : servicos.length === 0 || tipos.length === 0 ? (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-sm">
          Cadastre <strong>serviços</strong> e <strong>tipos de tapete</strong> para montar a tabela.
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Serviço \ Tipo de tapete</TableHead>
                {tipos.map((t) => (
                  <TableHead key={t.id} className="text-center min-w-32">{t.nome}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicos.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  {tipos.map((t) => {
                    const p = map.get(`${s.id}__${t.id}`);
                    return (
                      <TableCell key={t.id} className="p-2">
                        <PriceInput
                          initial={p?.valor ?? 0}
                          onCommit={(v) => savePrice(s.id, t.id, v)}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        Dica: deixe em branco (ou 0) para combinações que esta costureira não executa. Exemplo de valor salvo: {brl(15.5)}
      </p>
    </>
  );
}

function PriceInput({ initial, onCommit }: { initial: number; onCommit: (v: number) => void }) {
  const [value, setValue] = useState(initial === 0 ? "" : String(initial).replace(".", ","));

  return (
    <Input
      className="h-9 text-right tabular-nums"
      placeholder="—"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const num = parseFloat(value.replace(",", ".")) || 0;
        if (num !== initial) onCommit(num);
      }}
    />
  );
}
