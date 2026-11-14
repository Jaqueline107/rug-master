import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowRight, Download } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { useList } from "@/lib/data";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import folhaIvanUrl from "../assets/folha-ivan-nova-remessa.pdf?url";

export const Route = createFileRoute("/_authenticated/remessas/")({
  head: () => ({ meta: [{ title: "Remessas" }] }),
  component: RemessasPage,
});

function statusBadge(status: string) {
  if (status === "concluida") return <Badge className="bg-success text-success-foreground">Concluída</Badge>;
  if (status === "parcial") return <Badge className="bg-warning text-warning-foreground">Parcial</Badge>;
  return <Badge variant="secondary">Aberta</Badge>;
}

function RemessasPage() {
  const { data: list = [], isLoading } = useList<any>("remessas", {
    select: "*, costureiras(nome), remessa_itens(quantidade_enviada, quantidade_retornada, preco_unitario)",
    order: "data_envio",
  });

  const sorted = [...list].sort((a, b) => (b.numero ?? 0) - (a.numero ?? 0));

  return (
    <>
      <PageHeader
        title="Remessas"
        description="Controle de envios e retornos"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <a href={folhaIvanUrl} download="folha-ivan-nova-remessa.pdf">
                <Download className="h-4 w-4" /> Folha Ivan - Nova Remessa
              </a>
            </Button>
            <Button asChild>
              <Link to="/remessas/nova"><Plus className="h-4 w-4" /> Nova remessa</Link>
            </Button>
          </div>
        }
      />

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Costureira</TableHead>
              <TableHead>Enviada em</TableHead>
              <TableHead>Previsão retorno</TableHead>
              <TableHead className="text-center">Peças</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && sorted.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Nenhuma remessa criada ainda</TableCell></TableRow>}
            {sorted.map((r: any) => {
              const itens = r.remessa_itens || [];
              const totalEnv = itens.reduce((s: number, i: any) => s + (i.quantidade_enviada || 0), 0);
              const totalRet = itens.reduce((s: number, i: any) => s + (i.quantidade_retornada || 0), 0);
              const total = itens.reduce((s: number, i: any) => s + (i.quantidade_enviada || 0) * Number(i.preco_unitario || 0), 0);
              return (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell className="font-mono">#{r.numero}</TableCell>
                  <TableCell className="font-medium">{r.costureiras?.nome}</TableCell>
                  <TableCell>{format(parseISO(r.data_envio), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                  <TableCell>{r.data_prevista_retorno ? format(new Date(r.data_prevista_retorno), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                  <TableCell className="text-center tabular-nums">{totalRet}/{totalEnv}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>
                    <Link to="/remessas/$id" params={{ id: r.id }}>
                      <Button variant="ghost" size="icon"><ArrowRight className="h-4 w-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
