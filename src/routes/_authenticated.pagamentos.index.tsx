import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, Trash2, Download } from "lucide-react";
import { brl } from "@/lib/data";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Can, usePermission } from "@/lib/permissions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pagamentos/")({
  head: () => ({ meta: [{ title: "Pagamentos" }] }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const qc = useQueryClient();
  const podeExcluir = usePermission("pagamentos", "delete");
  const { data = [], isPending, isError, refetch } = useQuery({
    queryKey: ["pagamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*, costureiras(nome), pagamento_remessas(remessa_id, valor_pago)")
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function excluir(id: string, url?: string | null) {
    if (!confirm("Excluir este pagamento? As remessas voltarão a aparecer como pendentes.")) return;
    if (url) {
      const path = url.split("/comprovantes/")[1]?.split("?")[0];
      if (path) await supabase.storage.from("comprovantes").remove([path]);
    }
    const { error } = await supabase.from("pagamentos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pagamento excluído");
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
    qc.invalidateQueries({ queryKey: ["remessas-a-pagar"] });
  }

  return (
    <>
      <PageHeader
        title="Pagamentos"
        description="Histórico de pagamentos às costureiras"
        action={
          <Can resource="pagamentos" action="create">
            <Button asChild>
              <Link to="/pagamentos/novo">
                <Plus className="h-4 w-4 mr-2" /> Novo pagamento
              </Link>
            </Button>
          </Can>
        }
      />

      <div className="bg-card rounded-lg border">
        {isPending ? (
          <div className="p-12 text-center text-muted-foreground" role="status">Carregando pagamentos...</div>
        ) : isError ? (
          <div className="p-12 text-center space-y-3" role="alert">
            <p className="text-sm text-destructive">Não foi possível carregar os pagamentos. Tente novamente; se o erro continuar, verifique a configuração de pagamentos no Supabase.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nenhum pagamento registrado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Costureira</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead className="text-center">Remessas</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Comprovante</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>{format(new Date(p.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                  <TableCell className="font-medium">{p.costureiras?.nome}</TableCell>
                  <TableCell><Badge variant="outline">{p.forma_pagamento}</Badge></TableCell>
                  <TableCell className="text-center tabular-nums">{p.pagamento_remessas?.length ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{brl(Number(p.valor_total))}</TableCell>
                  <TableCell className="text-center">
                    {p.comprovante_url ? (
                      <a href={p.comprovante_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-sm hover:underline">
                        <FileText className="h-4 w-4" /> Ver
                      </a>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    {podeExcluir && (
                      <Button variant="ghost" size="icon" onClick={() => excluir(p.id, p.comprovante_url)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
