import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileDown, Save } from "lucide-react";
import { brl } from "@/lib/data";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/pagamentos/novo")({
  head: () => ({ meta: [{ title: "Novo Pagamento" }] }),
  component: NovoPagamentoPage,
});

function NovoPagamentoPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [costureiraId, setCostureiraId] = useState<string>("");
  const [selecionadas, setSelecionadas] = useState<Record<string, number>>({});
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("pix");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: costureiras = [] } = useQuery({
    queryKey: ["costureiras-ativas"],
    queryFn: async () => {
      const { data } = await supabase.from("costureiras").select("id, nome").eq("ativa", true).order("nome");
      return data ?? [];
    },
  });

  const { data: pendentes = [] } = useQuery({
    queryKey: ["remessas-a-pagar", costureiraId],
    enabled: !!costureiraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remessas_a_pagar")
        .select("*")
        .eq("costureira_id", costureiraId)
        .gt("valor_pendente", 0)
        .order("data_envio");
      if (error) throw error;
      return data ?? [];
    },
  });

  const costureiraNome = costureiras.find((c: any) => c.id === costureiraId)?.nome ?? "";

  const total = useMemo(
    () => Object.values(selecionadas).reduce((s, v) => s + (v || 0), 0),
    [selecionadas]
  );

  function toggle(remessaId: string, valor: number) {
    setSelecionadas((s) => {
      const n = { ...s };
      if (n[remessaId] != null) delete n[remessaId];
      else n[remessaId] = valor;
      return n;
    });
  }

  function selecionarTodas() {
    const n: Record<string, number> = {};
    pendentes.forEach((r: any) => (n[r.remessa_id] = Number(r.valor_pendente)));
    setSelecionadas(n);
  }

  function exportarPDF() {
    if (!costureiraId) return toast.error("Escolha uma costureira");
    const linhas = pendentes.filter((r: any) => selecionadas[r.remessa_id] != null);
    if (linhas.length === 0) return toast.error("Selecione ao menos uma remessa");

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório de Pagamento", 14, 18);
    doc.setFontSize(11);
    doc.text(`Costureira: ${costureiraNome}`, 14, 27);
    doc.text(`Data: ${format(new Date(dataPagamento), "dd/MM/yyyy", { locale: ptBR })}`, 14, 33);

    autoTable(doc, {
      startY: 40,
      head: [["Remessa", "Envio", "Status", "Valor devido", "Já pago", "A pagar"]],
      body: linhas.map((r: any) => [
        `#${r.numero}`,
        format(new Date(r.data_envio), "dd/MM/yyyy"),
        r.status,
        brl(Number(r.valor_devido)),
        brl(Number(r.valor_ja_pago)),
        brl(Number(selecionadas[r.remessa_id])),
      ]),
      foot: [["", "", "", "", "Total", brl(total)]],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [40, 40, 40] },
    });

    doc.save(`pagamento-${costureiraNome.replace(/\s+/g, "-")}-${dataPagamento}.pdf`);
  }

  async function salvar() {
    if (!costureiraId) return toast.error("Escolha uma costureira");
    const entries = Object.entries(selecionadas).filter(([, v]) => v > 0);
    if (entries.length === 0) return toast.error("Selecione ao menos uma remessa");
    setSaving(true);
    try {
      let comprovanteUrl: string | null = null;
      if (file) {
        const path = `${costureiraId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, file);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("comprovantes").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        comprovanteUrl = signed?.signedUrl ?? null;
      }

      const { data: pag, error } = await supabase
        .from("pagamentos")
        .insert({
          costureira_id: costureiraId,
          data_pagamento: dataPagamento,
          valor_total: total,
          forma_pagamento: forma,
          comprovante_url: comprovanteUrl,
          observacoes: obs || null,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: e2 } = await supabase.from("pagamento_remessas").insert(
        entries.map(([remessa_id, valor_pago]) => ({ pagamento_id: pag.id, remessa_id, valor_pago }))
      );
      if (e2) throw e2;

      toast.success("Pagamento registrado");
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      nav({ to: "/pagamentos" });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-2">
        <Link to="/pagamentos" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
      </div>
      <PageHeader title="Novo pagamento" description="Selecione as remessas para pagar" />

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-2">
          <Label>Costureira</Label>
          <Select value={costureiraId} onValueChange={(v) => { setCostureiraId(v); setSelecionadas({}); }}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              {costureiras.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {costureiraId && (
        <>
          <div className="bg-card rounded-lg border mb-6">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Remessas com valor a pagar</h2>
              {pendentes.length > 0 && (
                <Button variant="outline" size="sm" onClick={selecionarTodas}>
                  Selecionar todas
                </Button>
              )}
            </div>
            {pendentes.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma remessa pendente para essa costureira.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Remessa</TableHead>
                    <TableHead>Envio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Devido</TableHead>
                    <TableHead className="text-right">Já pago</TableHead>
                    <TableHead className="text-right">A pagar agora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.map((r: any) => {
                    const checked = selecionadas[r.remessa_id] != null;
                    return (
                      <TableRow key={r.remessa_id} className={checked ? "bg-muted/30" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle(r.remessa_id, Number(r.valor_pendente))}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">#{r.numero}</TableCell>
                        <TableCell>{format(new Date(r.data_envio), "dd/MM/yyyy")}</TableCell>
                        <TableCell><span className="text-xs uppercase text-muted-foreground">{r.status}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{brl(Number(r.valor_devido))}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{brl(Number(r.valor_ja_pago))}</TableCell>
                        <TableCell className="text-right">
                          {checked ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-right w-28 ml-auto"
                              value={selecionadas[r.remessa_id]}
                              onChange={(e) => setSelecionadas({ ...selecionadas, [r.remessa_id]: parseFloat(e.target.value) || 0 })}
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground tabular-nums">{brl(Number(r.valor_pendente))}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="bg-card rounded-lg border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Total a pagar</p>
                <p className="text-3xl font-bold tabular-nums">{brl(total)}</p>
              </div>
              <Button variant="outline" onClick={exportarPDF} disabled={total === 0}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Data do pagamento</Label>
                <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={forma} onValueChange={setForma}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <Label>Observações</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
            </div>

            <div className="space-y-2 mb-4">
              <Label>Comprovante (imagem ou PDF)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <Button onClick={salvar} disabled={saving || total === 0} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Registrar pagamento"}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
