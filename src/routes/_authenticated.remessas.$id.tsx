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
import { ArrowLeft, PackageCheck, Printer, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { faixaAnosTapete, nomeTapete } from "@/lib/nome-tapete";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/data";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { baixarRetornoPdf } from "@/lib/retorno-pdf";
import { ImprimirRemessa } from "@/components/remessas/imprmir-remessa";

export const Route = createFileRoute("/_authenticated/remessas/$id")({
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
  const [showPrint, setShowPrint] = useState(false);
  const [fotoAberta, setFotoAberta] = useState<{ url: string; titulo: string } | null>(null);
  const [abrindoFoto, setAbrindoFoto] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["remessa", id],
    queryFn: async () => {
      const { data: r, error } = await supabase
        .from("remessas")
        .select("*, costureiras(nome, telefone), remessa_itens(*, tapetes(nome, codigo, ano_inicio, ano_fim, materiais, tipos_tapete(nome)), servicos(nome))")
        .eq("id", id)
        .single();
      if (error) throw error;
      const { data: ret, error: erroRetornos } = await supabase
        .from("retornos")
        .select("*, retorno_itens(*)")
        .eq("remessa_id", id)
        .order("ordem", { ascending: true });
      if (erroRetornos) throw erroRetornos;
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

  const abrirFoto = async (bucket: "folhas-ivan" | "fotos-retornos", caminho: string, titulo: string) => {
    if (abrindoFoto) return;
    setAbrindoFoto(true);
    try {
      const { data: foto, error } = await supabase.storage.from(bucket).createSignedUrl(caminho, 300);
      if (error || !foto) throw error;
      setFotoAberta({ url: foto.signedUrl, titulo });
    } catch {
      toast.error("Não foi possível abrir o anexo.");
    } finally {
      setAbrindoFoto(false);
    }
  };

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
        description={`${r.costureiras?.nome} • enviada em ${format(parseISO(r.data_envio), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
        action={
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" onClick={() => setShowPrint(true)}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
            {statusBadge(r.status)}
            {r.status !== "concluida" && (
              <Button variant="outline" onClick={() => baixarRetornoPdf({
                numero: r.numero,
                ordem: (data.retornos.at(-1)?.ordem ?? 0) + 1,
                costureira: r.costureiras?.nome ?? "",
                dataEnvio: format(parseISO(r.data_envio), "dd/MM/yyyy"),
                observacoes: r.observacoes,
                itens: itens.map((item) => ({
                  carro: [item.tapetes?.nome, faixaAnosTapete(item.tapetes?.ano_inicio, item.tapetes?.ano_fim)].filter(Boolean).join(" "),
                  tipo: item.tapetes?.tipos_tapete?.nome ?? "",
                  material: item.tapetes?.materiais?.join(", ") ?? "",
                  enviado: item.quantidade_enviada,
                  pendente: Math.max(0, item.quantidade_enviada - item.quantidade_retornada),
                })),
              })}><Printer className="h-4 w-4" /> Imprimir próximo retorno</Button>
            )}
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
                  <TableCell className="font-medium">{nomeTapete(i.tapetes) || "—"}</TableCell>
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
            {[...data.retornos].reverse().map((ret) => {
              const totalItens = (ret.retorno_itens || []).reduce((s: number, ri: any) => s + ri.quantidade, 0);
              return (
                <div key={ret.id} className="p-4 flex justify-between items-start">
                  <div>
                    <p className="font-medium">{ret.ordem}º Retorno · {format(parseISO(ret.data_retorno), "dd/MM/yyyy", { locale: ptBR })}</p>
                    {ret.observacoes && <p className="text-sm text-muted-foreground mt-1">{ret.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{totalItens} peça{totalItens !== 1 ? "s" : ""}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <section className="mt-6 rounded-lg border bg-card">
        <h2 className="border-b p-4 font-semibold">Remessa #{r.numero} — Anexos</h2>
        <div className="divide-y">
          <div className="flex items-center justify-between gap-4 p-4">
            <span className="font-medium">Envio</span>
            {r.foto_folha_ivan_path ? (
              <Button variant="outline" size="sm" disabled={abrindoFoto}
                onClick={() => abrirFoto("folhas-ivan", r.foto_folha_ivan_path!, "Foto da folha de envio")}>
                Ver foto
              </Button>
            ) : <span className="text-sm text-muted-foreground">Sem foto anexada</span>}
          </div>
          {data.retornos.map((ret) => (
            <div key={ret.id} className="flex items-center justify-between gap-4 p-4">
              <span className="font-medium">{ret.ordem}º Retorno</span>
              {ret.foto_retorno_path ? (
                <Button variant="outline" size="sm" disabled={abrindoFoto}
                  onClick={() => abrirFoto("fotos-retornos", ret.foto_retorno_path!, ret.ordem + "º Retorno")}>
                  Ver foto
                </Button>
              ) : <span className="text-sm text-muted-foreground">Sem foto anexada</span>}
            </div>
          ))}
        </div>
      </section>
      <Dialog open={!!fotoAberta} onOpenChange={(open) => { if (!open) setFotoAberta(null); }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto" aria-describedby={undefined}>
          <DialogTitle>{fotoAberta?.titulo}</DialogTitle>
          {fotoAberta && <img src={fotoAberta.url} alt={fotoAberta.titulo} className="max-h-[75vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent className="grid max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)] sm:rounded-lg">
          <DialogTitle className="pr-8">Visualização da remessa</DialogTitle>
          <div className="min-h-0 overflow-auto bg-white">
            <ImprimirRemessa
              remessa={{
                numero: r.numero,
                data_envio: r.data_envio,
                data_prevista_retorno: r.data_prevista_retorno,
                costureira: r.costureiras,
                observacoes: r.observacoes,
                remessa_itens: itens.map((i: any) => ({
                  tapete: i.tapetes,
                  servico: i.servicos,
                  quantidade_enviada: i.quantidade_enviada,
                  quantidade_retornada: i.quantidade_retornada,
                  preco_unitario: i.preco_unitario,
                }))
              }}
              onClose={() => setShowPrint(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
      <RetornoDialog
        open={openRetorno}
        onOpenChange={setOpenRetorno}
        remessaId={id}
        itens={itens}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["remessa", id] });
          qc.invalidateQueries({ queryKey: ["remessas"] });
          qc.invalidateQueries({ queryKey: ["remessas-a-pagar"] });
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
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const reset = () => { setFoto(null); setQuantidades({}); setObs(""); setData(new Date().toISOString().slice(0, 10)); };

  const salvar = async () => {
    if (salvando) return;
    if (!data || Number.isNaN(parseISO(data).getTime())) return toast.error("Informe a data do retorno.");
    if (!foto) return toast.error("Anexe a foto da folha de retorno preenchida.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(foto.type) || !foto.size || foto.size > 10 * 1024 * 1024) {
      return toast.error("Anexe uma foto JPG, PNG ou WebP de até 10 MB.");
    }
    const entries = Object.entries(quantidades).filter(([, q]) => q > 0);
    if (entries.length === 0) return toast.error("Informe ao menos uma quantidade");

    // valida que não excede o pendente
    for (const [itemId, qtd] of entries) {
      const it = itens.find((i) => i.id === itemId);
      const pend = it.quantidade_enviada - it.quantidade_retornada;
      if (qtd > pend) return toast.error(`Quantidade maior que o pendente para "${(nomeTapete(it.tapetes) || "Tapete")}"`);
    }

    setSalvando(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Entre novamente para anexar a foto.");
      const caminho = user.id + "/" + crypto.randomUUID();
      const bucket = supabase.storage.from("fotos-retornos");
      const { error: uploadError } = await bucket.upload(caminho, foto, { contentType: foto.type });
      if (uploadError) throw uploadError;
      const { error } = await supabase.rpc("registrar_retorno_com_foto", {
        p_remessa_id: remessaId,
        p_data_retorno: data,
        p_observacoes: obs || null,
        p_foto: caminho,
        p_itens: entries.map(([remessa_item_id, quantidade]) => ({ remessa_item_id, quantidade })),
      });
      if (error) {
        await bucket.remove([caminho]);
        throw error;
      }
      toast.success("Retorno registrado");
      reset();
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar retorno");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!salvando) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
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
          <div className="space-y-2">
            <Label htmlFor="foto-retorno">Foto da folha de retorno preenchida *</Label>
            <Input id="foto-retorno" type="file" required disabled={salvando}
              accept="image/jpeg,image/png,image/webp" aria-describedby="foto-retorno-ajuda"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            <p id="foto-retorno-ajuda" className="text-xs text-muted-foreground">Selecione uma foto nova. JPG, PNG ou WebP, até 10 MB.</p>
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
                        <div className="font-medium">{(nomeTapete(it.tapetes) || "Tapete")}</div>
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
          <Button variant="outline" disabled={salvando} onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Registrar retorno"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
