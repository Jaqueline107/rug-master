import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const isRecovery = () => new URLSearchParams(window.location.search).get("reset") === "1";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Atelier" }] }),
  beforeLoad: async () => {
    if (isRecovery()) return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "request" | "reset">(() => isRecovery() ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(isRecovery);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!isRecovery()) return;
    let active = true;
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === "PASSWORD_RECOVERY" && session) {
        setRecoveryReady(true);
        setChecking(false);
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setRecoveryReady(!error && !!data.session);
      setChecking(false);
    }).catch(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "reset" && (!recoveryReady || senha !== confirmacao)) {
      return toast.error(recoveryReady ? "As senhas precisam ser iguais." : "Peça um novo link de recuperação.");
    }
    setLoading(true);
    try {
      if (mode === "request") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth?reset=1`,
        });
        if (error) throw error;
        setSent(true);
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password: senha });
        if (error) throw error;
        await supabase.auth.signOut();
        setSenha(""); setConfirmacao(""); setMode("login"); setRecoveryReady(false);
        toast.success("Senha atualizada. Entre com a nova senha.");
        await nav({ to: "/auth", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
        toast.success("Bem-vindo!");
        await nav({ to: "/" });
      }
    } catch (error: unknown) {
      const issue = error as { code?: string; status?: number; message?: string };
      if (issue.code === "invalid_credentials") toast.error("E-mail ou senha inválidos. Use Esqueci minha senha para recuperar o acesso.");
      else if (issue.status === 429) toast.error("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      else if (issue.code === "email_not_confirmed") toast.error("Confirme seu e-mail antes de entrar.");
      else if (issue.code === "same_password") toast.error("Escolha uma senha diferente da anterior.");
      else if (issue.code === "weak_password") toast.error("Escolha uma senha mais forte, com pelo menos 12 caracteres.");
      else if (mode === "reset") toast.error("Não foi possível atualizar a senha. Peça um novo link de recuperação.");
      else toast.error("Não foi possível conectar ao serviço de acesso. Tente novamente em instantes.");
    } finally { setLoading(false); }
  }

  function requestRecovery() {
    setMode("request"); setSent(false); setSenha(""); setConfirmacao("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Atelier</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de Remessas</p>
        </div>
        <form onSubmit={submit} className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold">{mode === "login" ? "Entrar" : mode === "request" ? "Recuperar acesso" : "Criar nova senha"}</h2>
          {mode === "request" && sent ? (
            <p role="status" className="text-sm">Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também a pasta de spam.</p>
          ) : mode === "reset" && !recoveryReady ? (
            <>
              <p role="status" className="text-sm">{checking ? "Verificando link…" : "O link expirou ou não é válido. Solicite um novo link para recuperar o acesso."}</p>
              {!checking && <Button type="button" className="w-full" onClick={requestRecovery}>Pedir novo link</Button>}
            </>
          ) : (
            <>
              {mode !== "reset" && <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>}
              {mode !== "request" && <div className="space-y-2">
                <Label htmlFor="senha">{mode === "reset" ? "Nova senha" : "Senha"}</Label>
                <Input id="senha" type="password" required minLength={mode === "reset" ? 12 : undefined} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={mode === "reset" ? "new-password" : "current-password"} />
              </div>}
              {mode === "reset" && <div className="space-y-2">
                <Label htmlFor="confirmacao">Confirme a nova senha</Label>
                <Input id="confirmacao" type="password" required minLength={12} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" />
              </div>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Aguarde…" : mode === "request" ? "Enviar link de recuperação" : mode === "reset" ? "Salvar nova senha" : "Entrar"}
              </Button>
            </>
          )}
          {mode === "login" ? <>
            <Button type="button" variant="link" className="w-full" onClick={requestRecovery}>Esqueci minha senha</Button>
            <p className="text-xs text-muted-foreground text-center pt-2">Cadastro é feito apenas pelo administrador.</p>
          </> : <Button type="button" variant="link" className="w-full" disabled={loading} onClick={() => { setMode("login"); setSenha(""); setConfirmacao(""); nav({ to: "/auth", replace: true }); }}>Voltar para entrar</Button>}
        </form>
      </div>
    </div>
  );
}
