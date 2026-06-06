import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app-shell";
import { useList } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { brl } from "@/lib/data";

export const Route = createFileRoute("/precos")({
  head: () => ({ meta: [{ title: "Tabela de Preços" }] }),
  component: PrecosPage,
});

type Costureira = { id: string; nome: string; ativa: boolean };
type Servico = { id: string; nome: string };
type Tipo = { id: string; nome: string };
type Preco = { id: string; costureira_id: string; servico_id: string; tipo_tapete_id: string; valor: number };

type Alteracao = {
  servico_id: string;
  tipo_tapete_id: string;
  valor: number;
  original_valor: number;
  existing_id?: string;
};

function PrecosPage() {
  const { data: costureiras = [] } = useList<Costureira>("costureiras", { order: "nome" });
  const { data: servicos = [] } = useList<Servico>("servicos", { order: "nome" });
  const { data: tipos = [] } = useList<Tipo>("tipos_tapete", { order: "nome" });
  const { data: precos = [] } = useList<Preco>("precos");
  const qc = useQueryClient();

  const [costureiraId, setCostureiraId] = useState<string>("");
  const [alteracoes, setAlteracoes] = useState<Map<string, Alteracao>>(new Map());
  const [salvando, setSalvando] = useState(false);

  // Pick first active by default
  const selected = costureiraId || costureiras.find((c) => c.ativa)?.id || costureiras[0]?.id || "";

  const map = useMemo(() => {
    const m = new Map<string, Preco>();
    for (const p of precos) {
      if (p.costureira_id === selected) {
        m.set(`${p.servico_id}__${p.tipo_tapete_id}`, p);
      }
    }
    return m;
  }, [precos, selected]);

  // Função para alterar um preço (salva na lista de alterações)
  const handlePriceChange = (servicoId: string, tipoId: string, valor: number, originalValor: number, existingId?: string) => {
    const key = `${servicoId}__${tipoId}`;
    const existingAlteracao = alteracoes.get(key);
    
    // Se o valor voltou ao original, remove da lista de alterações
    if (valor === originalValor) {
      if (existingAlteracao) {
        alteracoes.delete(key);
        setAlteracoes(new Map(alteracoes));
      }
      return;
    }
    
    // Adiciona ou atualiza a alteração
    setAlteracoes(new Map(alteracoes.set(key, {
      servico_id: servicoId,
      tipo_tapete_id: tipoId,
      valor,
      original_valor: originalValor,
      existing_id: existingId
    })));
  };

  // Função para salvar todos os preços
  const salvarTodosPrecos = async () => {
    if (!selected) {
      toast.error("Selecione uma costureira primeiro");
      return;
    }
    
    if (alteracoes.size === 0) {
      toast.info("Nenhuma alteração para salvar");
      return;
    }
    
    setSalvando(true);
    let sucessos = 0;
    let erros = 0;
    
    try {
      for (const [_, alteracao] of alteracoes) {
        const { servico_id, tipo_tapete_id, valor, existing_id } = alteracao;
        
        try {
          if (existing_id) {
            // Atualiza preço existente
            if (valor === 0) {
              await supabase.from("precos").delete().eq("id", existing_id);
            } else {
              await supabase.from("precos").update({ valor }).eq("id", existing_id);
            }
          } else if (valor > 0) {
            // Insere novo preço
            await supabase.from("precos").insert({
              costureira_id: selected,
              servico_id: servico_id,
              tipo_tapete_id: tipo_tapete_id,
              valor,
            });
          }
          sucessos++;
        } catch (e) {
          console.error("Erro ao salvar:", e);
          erros++;
        }
      }
      
      // Limpa as alterações
      setAlteracoes(new Map());
      
      // Recarrega os dados
      await qc.invalidateQueries({ queryKey: ["precos"] });
      
      // Mostra mensagem de sucesso ou erro parcial
      if (sucessos > 0 && erros === 0) {
        toast.success(`${sucessos} preço(s) salvo(s) com sucesso!`);
      } else if (sucessos > 0 && erros > 0) {
        toast.warning(`${sucessos} preço(s) salvos, ${erros} erro(s)`);
      } else {
        toast.error("Erro ao salvar os preços");
      }
      
    } catch (e: any) {
      toast.error(e.message || "Houve um erro ao salvar os preços");
    } finally {
      setSalvando(false);
    }
  };

  // Função para cancelar alterações
  const cancelarAlteracoes = () => {
    setAlteracoes(new Map());
    toast.info("Alterações descartadas");
  };

  // Obtém o valor atual (incluindo alterações pendentes)
  const getCurrentValue = (servicoId: string, tipoId: string) => {
    const key = `${servicoId}__${tipoId}`;
    const p = map.get(key);
    const alteracao = alteracoes.get(key);
    
    if (alteracao !== undefined) {
      return alteracao.valor;
    }
    return p?.valor ?? 0;
  };

  const hasChanges = alteracoes.size > 0;

  return (
    <>
      <PageHeader
        title="Tabela de Preços"
        description="Defina o preço de cada combinação serviço × tipo de tapete por costureira"
      />

      <div className="bg-card rounded-lg border p-4 mb-4">
        <Label className="mb-2 block">Costureira</Label>
        <Select value={selected} onValueChange={(v) => {
          setCostureiraId(v);
          setAlteracoes(new Map()); // Limpa alterações ao trocar de costureira
        }}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {costureiras.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selected ? (
        <div className="bg-muted/40 rounded-lg p-8 text-center text-muted-foreground">
          Cadastre uma costureira para começar.
        </div>
      ) : servicos.length === 0 || tipos.length === 0 ? (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-sm">
          Cadastre <strong>serviços</strong> e <strong>tipos de tapete</strong> para montar a tabela.
        </div>
      ) : (
        <>
          <div className="bg-card rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">Serviço \ Tipo de tapete</TableHead>
                  {tipos.map((t) => (
                    <TableHead key={t.id} className="text-center min-w-32">{t.nome}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicos.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    {tipos.map((t) => {
                      const p = map.get(`${s.id}__${t.id}`);
                      const currentValue = getCurrentValue(s.id, t.id);
                      const hasChange = alteracoes.has(`${s.id}__${t.id}`);
                      return (
                        <TableCell key={t.id} className="p-2">
                          <PriceInput
                            key={`${selected}-${s.id}-${t.id}`}
                            initial={currentValue}
                            originalValue={p?.valor ?? 0}
                            hasChange={hasChange}
                            onValueChange={(valor) => handlePriceChange(s.id, t.id, valor, p?.valor ?? 0, p?.id)}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Botões de ação */}
          <div className="flex justify-end gap-2 mt-4">
            {hasChanges && (
              <Button variant="outline" onClick={cancelarAlteracoes} disabled={salvando}>
                Cancelar
              </Button>
            )}
            <Button onClick={salvarTodosPrecos} disabled={!hasChanges || salvando}>
              {salvando ? "Salvando..." : `Salvar Preços (${alteracoes.size} alteração${alteracoes.size !== 1 ? 'ões' : ''})`}
            </Button>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        Dica: Edite os valores e clique em "Salvar Preços" para confirmar as alterações. 
        Exemplo de valor: {brl(15.5)}
      </p>
    </>
  );
}

function PriceInput({ 
  initial, 
  originalValue, 
  hasChange, 
  onValueChange 
}: { 
  initial: number; 
  originalValue: number;
  hasChange: boolean;
  onValueChange: (v: number) => void;
}) {
  const [value, setValue] = useState(initial === 0 ? "" : String(initial).replace(".", ","));

  return (
    <Input
      className={`h-9 text-right tabular-nums transition-all duration-200 ${
        hasChange ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : ''
      }`}
      placeholder="—"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const num = parseFloat(value.replace(",", ".")) || 0;
        setValue(num === 0 ? "" : String(num).replace(".", ","));
        if (num !== initial) {
          onValueChange(num);
        }
      }}
    />
  );
}