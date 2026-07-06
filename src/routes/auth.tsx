import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Atelier" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) return toast.error("E-mail ou senha inválidos");
    toast.success("Bem-vindo!");
    nav({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Atelier</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de Remessas</p>
        </div>
        <form onSubmit={entrar} className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">Entrar</h2>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <p className="text-xs text-muted-foreground text-center pt-2">
            Cadastro é feito apenas pelo administrador.
          </p>
        </form>
      </div>
    </div>
  );
}
