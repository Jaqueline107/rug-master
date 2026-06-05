import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, PackageCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/data";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/remessas/$id")({
  head: () => ({ meta: [{ title: "Detalhes da Remessa" }] }),
  component: RemessaDetailPage,
});

function statusBadge(status: string) {
  if (status === "concluida") return <Badge className="bg-success text-success-foreground">Concluída</Badge>;
  if (status === "parcial") return <Badge className="bg-warning text-warning-foreground">Parcial</Badge>;
  return <Badge variant="secondary">Aberta</Badge>;
}

function RemessaDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["remessa", id],
    queryFn: async () => {
      const { data: r, error } = await supabase
        .from("remessas")
        .select("*, costureiras(nome, telefone), remessa_itens(*, tapetes(nome, codigo, tipos_tapete(nome)), servicos(nome))")
        .eq("id", id)
        .single();
      if (error) throw error;
      const { data: ret } = await supabase
        .from("retornos")
        .select("*, retorno_itens(*)")
        .eq("remessa_id", id)
        .order("data_retorno", { ascending: false });
      return { remessa: r, retornos: ret ?? [] };
    },
  });

  const [openRetorno, setOpenRetorno] = useState(false);

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!data) return <div>Remessa não encontrada</div>;

  const r = data.remessa;
  const itens = r.remessa_itens || [];
  const totalEnv = itens.reduce((s: number, i: any) => s + i.quantidade_enviada, 0);
  const totalRet = itens.reduce((s: number, i: any) => s + i.quantidade_retornada, 0);
  const totalValor = itens.reduce((s: number, i: any) => s + i.quantidade_enviada * Number(i.preco_unitario), 0);
  const totalValorRet = itens.reduce((s: number, i: any) => s + i.quantidade_retornada * Number(i.preco_unitario), 0);

  const excluir = async () => {
    if (!confirm("Excluir esta remessa e todos os seus retornos?")) return;
    const { error } = await supabase.from("remessas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Remessa excluída");
    qc.invalidateQueries({ queryKey: ["remessas"] });
    navigate({ to: "/remessas" });
  };

  return (
    <>
      <div className="mb-2">
        <Link to="/remessas" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
      </div>

      <PageHeader
        title={`Remessa #${r.numero}`}
        description={`${r.costureiras?.nome} • enviada em ${format(new Date(r.data_envio), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
        action={
          <div className="flex gap-2 items-center">
            {statusBadge(r.status)}
            {r.status !== "concluida" && (
              <Button onClick={() => setOpenRetorno(true)}>
                <PackageCheck className="h-4 w-4 mr-2" /> Registrar retorno
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={excluir}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Stat label="Peças enviadas" value={totalEnv} />
        <Stat label="Peças retornadas" value={`${totalRet} / ${totalEnv}`} />
        <Stat label="Valor da remessa" value={brl(totalValor)} />
        <Stat label="Valor já retornado" value={brl(totalValorRet)} />
      </div>

      <div className="bg-card rounded-lg border mb-6">
        <div className="p-4 border-b"><h2 className="font-semibold">Itens</h2></div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tapete</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-center">Enviado</TableHead>
              <TableHead className="text-center">Retornado</TableHead>
              <TableHead className="text-center">Pendente</TableHead>
              <TableHead className="text-right">Preço unit.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((i: any) => {
              const pend = i.quantidade_enviada - i.quantidade_retornada;
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.tapetes?.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{i.tapetes?.tipos_tapete?.nome}</TableCell>
                  <TableCell>{i.servicos?.nome}</TableCell>
                  <TableCell className="text-center tabular-nums">{i.quantidade_enviada}</TableCell>
                  <TableCell className="text-center tabular-nums">{i.quantidade_retornada}</TableCell>
                  <TableCell className="text-center tabular-nums">
                    {pend > 0 ? <span className="text-warning-foreground font-semibold">{pend}</span> : <span className="text-success">✓</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(Number(i.preco_unitario))}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{brl(i.quantidade_enviada * Number(i.preco_unitario))}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {data.retornos.length > 0 && (
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b"><h2 className="font-semibold">Histórico de retornos</h2></div>
          <div className="divide-y">
            {data.retornos.map((ret: any) => {
              const totalItens = (ret.retorno_itens || []).reduce((s: number, ri: any) => s + ri.quantidade, 0);
              return (
                <div key={ret.id} className="p-4 flex justify-between items-start">
                  <div>
                    <p className="font-medium">{format(new Date(ret.data_retorno), "dd/MM/yyyy", { locale: ptBR })}</p>
                    {ret.observacoes && <p className="text-sm text-muted-foreground mt-1">{ret.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{totalItens} peça{totalItens !== 1 ? "s" : ""}</Badge>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      if (!confirm("Excluir este retorno?")) return;
                      await supabase.from("retornos").delete().eq("id", ret.id);
                      qc.invalidateQueries({ queryKey: ["remessa", id] });
                      qc.invalidateQueries({ queryKey: ["remessas"] });
                      toast.success("Retorno removido");
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <RetornoDialog
        open={openRetorno}
        onOpenChange={setOpenRetorno}
        remessaId={id}
        itens={itens}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["remessa", id] });
          qc.invalidateQueries({ queryKey: ["remessas"] });
        }}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function RetornoDialog({
  open, onOpenChange, remessaId, itens, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; remessaId: string; itens: any[]; onSaved: () => void;
}) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});

  const reset = () => { setQuantidades({}); setObs(""); setData(new Date().toISOString().slice(0, 10)); };

  const salvar = async () => {
    const entries = Object.entries(quantidades).filter(([, q]) => q > 0);
    if (entries.length === 0) return toast.error("Informe ao menos uma quantidade");

    // valida que não excede o pendente
    for (const [itemId, qtd] of entries) {
      const it = itens.find((i) => i.id === itemId);
      const pend = it.quantidade_enviada - it.quantidade_retornada;
      if (qtd > pend) return toast.error(`Quantidade maior que o pendente para "${it.tapetes?.nome}"`);
    }

    try {
      const { data: ret, error } = await supabase
        .from("retornos")
        .insert({ remessa_id: remessaId, data_retorno: data, observacoes: obs || null })
        .select()
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("retorno_itens").insert(
        entries.map(([remessa_item_id, quantidade]) => ({ retorno_id: ret.id, remessa_item_id, quantidade }))
      );
      if (e2) throw e2;
      toast.success("Retorno registrado");
      reset();
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar retorno");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Registrar retorno</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data do retorno</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tapete / Serviço</TableHead>
                  <TableHead className="text-center w-24">Pendente</TableHead>
                  <TableHead className="text-center w-28">Voltou agora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((it) => {
                  const pend = it.quantidade_enviada - it.quantidade_retornada;
                  if (pend === 0) return null;
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        <div className="font-medium">{it.tapetes?.nome}</div>
                        <div className="text-xs text-muted-foreground">{it.servicos?.nome}</div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{pend}</TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} max={pend} className="h-9 text-center"
                          value={quantidades[it.id] ?? ""}
                          onChange={(e) => setQuantidades({ ...quantidades, [it.id]: parseInt(e.target.value) || 0 })}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar}>Registrar retorno</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
