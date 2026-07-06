import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, type ReactNode } from "react";

export type AppResource =
  | "dashboard"
  | "costureiras"
  | "tipos_tapete"
  | "modelos_tapetes"
  | "insumos"
  | "servicos"
  | "precos"
  | "remessas"
  | "pagamentos"
  | "usuarios";
export type AppAction = "view" | "create" | "update" | "delete";

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
      setEmail(s?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { userId, email, loading };
}

export function usePermissions() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ["permissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return { isAdmin: false, perms: new Set<string>(), profile: null as any };
      const [rolesRes, permsRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("user_permissions").select("resource, action").eq("user_id", userId),
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      ]);
      const isAdmin = (rolesRes.data ?? []).some((r: any) => r.role === "admin");
      const perms = new Set<string>((permsRes.data ?? []).map((p: any) => `${p.resource}:${p.action}`));
      return { isAdmin, perms, profile: profileRes.data };
    },
  });
}

export function usePermission(resource: AppResource, action: AppAction): boolean {
  const { data } = usePermissions();
  if (!data) return false;
  if (data.isAdmin) return true;
  return data.perms.has(`${resource}:${action}`);
}

export function Can({
  resource,
  action,
  children,
  fallback = null,
}: {
  resource: AppResource;
  action: AppAction;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const ok = usePermission(resource, action);
  return <>{ok ? children : fallback}</>;
}

export const RESOURCE_LABELS: Record<AppResource, string> = {
  dashboard: "Dashboard",
  costureiras: "Costureiras",
  tipos_tapete: "Tipos de Tapete",
  modelos_tapetes: "Modelos de Tapete",
  insumos: "Insumos",
  servicos: "Serviços",
  precos: "Tabela de Preços",
  remessas: "Remessas",
  pagamentos: "Pagamentos",
  usuarios: "Usuários",
};

export const ALL_RESOURCES: AppResource[] = [
  "dashboard",
  "costureiras",
  "tipos_tapete",
  "modelos_tapetes",
  "insumos",
  "servicos",
  "precos",
  "remessas",
  "pagamentos",
];

export const ALL_ACTIONS: AppAction[] = ["view", "create", "update", "delete"];
