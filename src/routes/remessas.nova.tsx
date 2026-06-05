import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { useList, brl } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/remessas/nova")({
  head: () => ({ meta: [{ title: "Nova Remessa" }] }),
  component: NovaRemessaPage,
});

type Item = {
  tapete_id: string;
  servico_id: string;
  quantidade_enviada: number;
  preco_unitario: number;
};

function NovaRemessaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: costureiras = [] } = useList<any>("costureiras", { order: "nome" });
  const { data: tapetes = [] } = useList<any>("tapetes", { select: "*, tipos_tapete(id, nome)", order: "nome" });
  const { data: servicos = [] } = useList<any>("servicos", { order: "nome" });
  const { data: precos = [] } = useList<any>("precos");

  const [costureiraId, setCostureiraId] = useState("");
  const [dataEnvio, setDataEnvio] = useState(new Date().toISOString().slice(0, 10));
  const [dataPrev, setDataPrev] = useState("");
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<Item[]>([]);

  const precoMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of precos) m.set(`${p.costureira_id}__${p.servico_id}__${p.tipo_tapete_id}`, Number(p.valor));
    return m;
  }, [precos]);

  const findPreco = (tapeteId: string, servicoId: string) => {
    if (!costureiraId || !tapeteId || !servicoId) return 0;
    const tap = tapetes.find((t: any) => t.id === tapeteId);
    if (!tap) return 0;
    return precoMap.get(`${costureiraId}__${servicoId}__${tap.tipo_tapete_id}`) ?? 0;
  };

  const updateItem = (i: number, patch: Partial<Item>) => {
    setItens((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      // recalcula preço se mudou tapete ou serviço
      if (patch.tapete_id || patch.servico_id) {
        next[i].preco_unitario = findPreco(next[i].tapete_id, next[i].servico_id);
      }
      return next;
    });
  };

  const addItem = () => setItens([...itens, { tapete_id: "", servico_id: "", quantidade_enviada: 1, preco_unitario: 0 }]);
  const removeItem = (i: number) => setItens(itens.filter((_, idx) => idx !== i));

  const total = itens.reduce((s, i) => s + i.quantidade_enviada * i.preco_unitario, 0);

  const salvar = async () => {
    if (!costureiraId) return toast.error("Selecione a costureira");
    const validos = itens.filter((i) => i.tapete_id && i.servico_id && i.quantidade_enviada > 0);
    if (validos.length === 0) return toast.error("Adicione ao menos um item");

    try {
      const { data: rem, error } = await supabase
        .from("remessas")
        .insert({
          costureira_id: costureiraId,
          data_envio: dataEnvio,
          data_prevista_retorno: dataPrev || null,
          observacoes: obs || null,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: e2 } = await supabase.from("remessa_itens").insert(
        validos.map((i) => ({ ...i, remessa_id: rem.id }))
      );
      if (e2) throw e2;

      toast.success(`Remessa #${rem.numero} criada`);
      qc.invalidateQueries({ queryKey: ["remessas"] });
      navigate({ to: "/remessas/$id", params: { id: rem.id } });
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar remessa");
    }
  };

  // recalcula preços de todos os itens quando muda costureira
  const handleCostureiraChange = (v: string) => {
    setCostureiraId(v);
    setItens((prev) => prev.map((i) => {
      if (!i.tapete_id || !i.servico_id) return i;
      const tap = tapetes.find((t: any) => t.id === i.tapete_id);
      const novo = tap ? precoMap.get(`${v}__${i.servico_id}__${tap.tipo_tapete_id}`) ?? 0 : 0;
      return { ...i, preco_unitario: novo };
    }));
  };

  return (
    <>
      <div className="mb-2">
        <Link to="/remessas" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
      </div>
      <PageHeader title="Nova Remessa" description="Envie tapetes para uma costureira" />

      <div className="bg-card rounded-lg border p-6 space-y-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Costureira *</Label>
            <Select value={costureiraId} onValueChange={handleCostureiraChange}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {costureiras.filter((c: any) => c.ativa).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data do envio *</Label>
            <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Previsão de retorno</Label>
            <Input type="date" value={dataPrev} onChange={(e) => setDataPrev(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="bg-card rounded-lg border mb-6">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Itens da remessa</h2>
          <Button size="sm" onClick={addItem} disabled={!costureiraId}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar item
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tapete</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead className="w-24 text-center">Qtd</TableHead>
              <TableHead className="w-32 text-right">Preço unit.</TableHead>
              <TableHead className="w-32 text-right">Subtotal</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                {costureiraId ? "Clique em \"Adicionar item\"" : "Selecione a costureira primeiro"}
              </TableCell></TableRow>
            )}
            {itens.map((it, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Select value={it.tapete_id} onValueChange={(v) => updateItem(i, { tapete_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Tapete" /></SelectTrigger>
                    <SelectContent>
                      {tapetes.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome} <span className="text-muted-foreground">({t.tipos_tapete?.nome})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={it.servico_id} onValueChange={(v) => updateItem(i, { servico_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Serviço" /></SelectTrigger>
                    <SelectContent>
                      {servicos.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number" min={1} className="h-9 text-center"
                    value={it.quantidade_enviada}
                    onChange={(e) => updateItem(i, { quantidade_enviada: parseInt(e.target.value) || 1 })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number" step="0.01" className="h-9 text-right tabular-nums"
                    value={it.preco_unitario}
                    onChange={(e) => updateItem(i, { preco_unitario: parseFloat(e.target.value) || 0 })}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {brl(it.quantidade_enviada * it.preco_unitario)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-4 border-t flex justify-between items-center bg-muted/30">
          <span className="text-sm text-muted-foreground">Total da remessa</span>
          <span className="text-xl font-bold tabular-nums">{brl(total)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link to="/remessas"><Button variant="outline">Cancelar</Button></Link>
        <Button onClick={salvar}>Criar remessa</Button>
      </div>
    </>
  );
}
