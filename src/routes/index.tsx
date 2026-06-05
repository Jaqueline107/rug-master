import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { useList, brl } from "@/lib/data";
import { Truck, AlertCircle, CheckCircle2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Controle de Remessas" },
      { name: "description", content: "Painel de controle das remessas para costureiras" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: remessas = [] } = useList<any>("remessas", {
    select: "*, costureiras(nome), remessa_itens(quantidade_enviada, quantidade_retornada, preco_unitario)",
  });

  const abertas = remessas.filter((r) => r.status !== "concluida");
  const concluidas = remessas.filter((r) => r.status === "concluida");

  const totalPendentePecas = abertas.reduce((s, r) => {
    const itens = r.remessa_itens || [];
    return s + itens.reduce((a: number, i: any) => a + (i.quantidade_enviada - i.quantidade_retornada), 0);
  }, 0);

  const now = new Date();
  const mesAtual = remessas.filter((r) => {
    const d = new Date(r.data_envio);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalMes = mesAtual.reduce((s, r) => {
    const itens = r.remessa_itens || [];
    return s + itens.reduce((a: number, i: any) => a + i.quantidade_enviada * Number(i.preco_unitario), 0);
  }, 0);

  return (
    <>
      <PageHeader title="Dashboard" description="Visão geral do atelier" />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={Truck} label="Remessas abertas" value={abertas.length} tint="primary" />
        <StatCard icon={AlertCircle} label="Peças pendentes" value={totalPendentePecas} tint="warning" />
        <StatCard icon={CheckCircle2} label="Concluídas" value={concluidas.length} tint="success" />
        <StatCard icon={DollarSign} label={`Enviado em ${format(now, "MMM/yyyy", { locale: ptBR })}`} value={brl(totalMes)} tint="primary" />
      </div>

      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Remessas em andamento</h2>
        </div>
        {abertas.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p>Nenhuma remessa aberta.</p>
            <Link to="/remessas/nova" className="text-primary hover:underline mt-2 inline-block">
              Criar nova remessa →
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {abertas.slice(0, 10).map((r) => {
              const itens = r.remessa_itens || [];
              const env = itens.reduce((s: number, i: any) => s + i.quantidade_enviada, 0);
              const ret = itens.reduce((s: number, i: any) => s + i.quantidade_retornada, 0);
              return (
                <Link
                  key={r.id}
                  to="/remessas/$id"
                  params={{ id: r.id }}
                  className="block p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-muted-foreground">#{r.numero}</span>
                        <span className="font-medium">{r.costureiras?.nome}</span>
                        {r.status === "parcial" ? (
                          <Badge className="bg-warning text-warning-foreground">Parcial</Badge>
                        ) : (
                          <Badge variant="secondary">Aberta</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enviada em {format(new Date(r.data_envio), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular-nums font-medium">{ret} / {env} peças</p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {brl(itens.reduce((s: number, i: any) => s + i.quantidade_enviada * Number(i.preco_unitario), 0))}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({
  icon: Icon, label, value, tint,
}: { icon: any; label: string; value: string | number; tint: "primary" | "warning" | "success" }) {
  const colors = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/20 text-warning-foreground",
    success: "bg-success/15 text-success",
  };
  return (
    <div className="bg-card border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={`p-2 rounded-md ${colors[tint]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
