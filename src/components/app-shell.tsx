import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Layers,
  Package,
  Boxes,
  Wrench,
  DollarSign,
  Truck,
  Wallet,
  UserCog,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions, usePermission, type AppResource } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const navItems: { to: string; label: string; icon: any; exact?: boolean; resource: AppResource }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, resource: "dashboard" },
  { to: "/remessas", label: "Remessas", icon: Truck, resource: "remessas" },
  { to: "/pagamentos", label: "Pagamentos", icon: Wallet, resource: "pagamentos" },
  { to: "/costureiras", label: "Costureiras", icon: Users, resource: "costureiras" },
  { to: "/tipos-tapete", label: "Tipos de Tapete", icon: Layers, resource: "tipos_tapete" },
  { to: "/modelos-tapetes", label: "Modelos de Tapete", icon: Package, resource: "modelos_tapetes" },
  { to: "/insumos", label: "Insumos", icon: Boxes, resource: "insumos" },
  { to: "/servicos", label: "Serviços", icon: Wrench, resource: "servicos" },
  { to: "/precos", label: "Tabela de Preços", icon: DollarSign, resource: "precos" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: perms } = usePermissions();
  const nav = useNavigate();
  const qc = useQueryClient();
  const canUsuarios = usePermission("usuarios", "view") || perms?.isAdmin;

  const items = navItems.filter((i) => perms?.isAdmin || perms?.perms.has(`${i.resource}:view`));

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold tracking-tight">Atelier</h1>
          <p className="text-xs text-sidebar-foreground/60 mt-1">Controle de Remessas</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {(perms?.isAdmin || canUsuarios) && (
            <>
              <div className="my-2 border-t border-sidebar-border" />
              <Link
                to="/usuarios"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  pathname.startsWith("/usuarios")
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
                )}
              >
                <UserCog className="h-4 w-4" /> Usuários
              </Link>
            </>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 pb-2">
            <p className="text-xs text-sidebar-foreground/60">Logado como</p>
            <p className="text-sm font-medium truncate">{perms?.profile?.nome || "—"}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={sair}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
          <p className="text-[10px] text-sidebar-foreground/60 mt-3 px-1">
            &copy; Jaqueline Moura 2026
          </p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
