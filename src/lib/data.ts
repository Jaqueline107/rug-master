import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useList<T = any>(table: string, opts?: { select?: string; order?: string }) {
  return useQuery({
    queryKey: [table, opts?.select, opts?.order],
    queryFn: async () => {
      let q = supabase.from(table as any).select(opts?.select ?? "*");
      if (opts?.order) q = q.order(opts.order);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useUpsert(table: string, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: any) => {
      const { id, ...rest } = row;
      if (id) {
        const { error } = await supabase.from(table as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table as any).insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      [table, ...invalidate].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Salvo com sucesso");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });
}

export function useDelete(table: string, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      [table, ...invalidate].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });
}

export function brl(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
