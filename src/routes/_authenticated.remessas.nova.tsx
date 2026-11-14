import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseISO } from "date-fns";
import { Trash2, Plus, ArrowLeft, ChevronsUpDown, Check } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { useList, brl } from "@/lib/data";
import { nomeTapete } from "@/lib/nome-tapete";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/remessas/nova")({
  head: () => ({ meta: [{ title: "Nova Remessa" }] }),
  component: NovaRemessaPage,
});

type Item = {
  tapete_id: string;
  servico_id: string;
  quantidade_enviada: number;
};

type ModeloRemessa = {
  id: string;
  nome: string;
  tipo_tapete_id: string;
  tipos_tapete?: { nome: string } | null;
  ano_inicio: number | null;
  ano_fim: number | null;
  materiais?: string[] | null;
  servicos_permitidos: string[];
};
type Servico = { id: string; nome: string };

function normalizarBusca(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[()/]/g, " ").toLocaleLowerCase("pt-BR").trim();
}

function SeletorTapete({ modelos, selecionado, onSelect }: {
  modelos: ModeloRemessa[];
  selecionado?: ModeloRemessa;
  onSelect: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-label={selecionado ? "Tapete: " + nomeTapete(selecionado) : "Selecionar tapete"}
          className="h-9 w-full min-w-40 justify-between gap-2 font-normal">
          <span className="truncate">{selecionado ? nomeTapete(selecionado) : "Selecionar tapete"}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <Command label="Pesquisar tapete" filter={(_id, busca, termos) => {
          const texto = normalizarBusca(termos?.join(" ") ?? "");
          return normalizarBusca(busca).split(/\s+/).every((termo) => texto.includes(termo)) ? 1 : 0;
        }}>
          <CommandInput autoFocus placeholder="Digite o nome do tapete..." />
          <CommandList>
            <CommandEmpty>Nenhum tapete encontrado.</CommandEmpty>
            {modelos.map((modelo) => (
              <CommandItem key={modelo.id} value={modelo.id} keywords={[nomeTapete(modelo)]}
                onSelect={() => { onSelect(modelo.id); setAberto(false); }}>
                <Check className={modelo.id === selecionado?.id ? "opacity-100" : "opacity-0"} aria-hidden="true" />
                {nomeTapete(modelo)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function NovaRemessaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: costureiras = [] } = useList<any>("costureiras", { order: "nome" });
  const { data: tapetes = [] } = useList<ModeloRemessa>("tapetes", { select: "*, tipos_tapete(id, nome)", order: "nome" });
  const { data: servicos = [], isLoading: carregandoServicos, isError: erroServicos } = useList<Servico>("servicos", { order: "nome" });
  const { data: precos = [], isPending: carregandoPrecos, isError: erroPrecos } = useList<any>("precos");

  const [costureiraId, setCostureiraId] = useState("");
  const [dataEnvio, setDataEnvio] = useState("");
  const [dataPrev, setDataPrev] = useState("");
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [itens, setItens] = useState<Item[]>([]);

  const precoMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of precos) m.set(`${p.costureira_id}__${p.servico_id}__${p.tipo_tapete_id}`, Number(p.valor));
    return m;
  }, [precos]);

  const modelosPorId = useMemo(() => new Map(tapetes.map((modelo) => [modelo.id, modelo])), [tapetes]);

  const servicosDoModelo = (tapeteId: string) => {
    const permitidos = modelosPorId.get(tapeteId)?.servicos_permitidos ?? [];
    return servicos.filter((servico) => permitidos.includes(servico.id));
  };

  const findPreco = (tapeteId: string, servicoId: string) => {
    if (!costureiraId || !tapeteId || !servicoId) return undefined;
    const tap = modelosPorId.get(tapeteId);
    if (!tap) return undefined;
    return precoMap.get(`${costureiraId}__${servicoId}__${tap.tipo_tapete_id}`);
  };

  const updateItem = (i: number, patch: Partial<Item>) => {
    setItens((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const addItem = () => setItens([...itens, { tapete_id: "", servico_id: "", quantidade_enviada: 1 }]);
  const removeItem = (i: number) => setItens(itens.filter((_, idx) => idx !== i));

  const total = itens.reduce((s, i) => s + i.quantidade_enviada * (findPreco(i.tapete_id, i.servico_id) ?? 0), 0);

  const salvar = async () => {
    if (salvando) return;
    if (!foto) return toast.error("Anexe uma foto da Folha Ivan preenchida.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(foto.type) || foto.size === 0 || foto.size > 10 * 1024 * 1024) {
      return toast.error("Anexe uma foto JPG, PNG ou WebP de até 10 MB.");
    }
    if (!costureiraId) return toast.error("Selecione a costureira");
    if (!dataEnvio || !/^\d{4}-\d{2}-\d{2}$/.test(dataEnvio) || Number.isNaN(parseISO(dataEnvio).getTime())) {
      return toast.error("Selecione uma data de envio válida.");
    }
    if (carregandoPrecos || erroPrecos) return toast.error("A tabela de preços não está disponível.");
    const itensComPreco: (Item & { preco_unitario: number })[] = [];
    if (itens.length === 0) return toast.error("Adicione ao menos um item");
    for (const [index, item] of itens.entries()) {
      if (!item.tapete_id || !item.servico_id || item.quantidade_enviada < 1) {
        return toast.error("Preencha o tapete, o serviço e a quantidade do item " + (index + 1) + ".");
      }
      if (!servicosDoModelo(item.tapete_id).some((servico) => servico.id === item.servico_id)) {
        return toast.error("Escolha um serviço permitido para o item " + (index + 1) + ".");
      }
      const preco = findPreco(item.tapete_id, item.servico_id);
      if (preco === undefined || !Number.isFinite(preco)) {
        return toast.error("Cadastre o preço do item " + (index + 1) + " na Tabela de Preços.");
      }
      itensComPreco.push({ ...item, preco_unitario: preco });
    }

    setSalvando(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Entre novamente para anexar a foto.");

      const caminho = user.id + "/" + crypto.randomUUID();
      const bucket = supabase.storage.from("folhas-ivan");
      const { error: uploadError } = await bucket.upload(caminho, foto, { contentType: foto.type });
      if (uploadError) throw uploadError;

      const { data: rem, error } = await supabase.rpc("criar_remessa_com_folha_ivan", {
        p_costureira_id: costureiraId,
        p_data_envio: dataEnvio,
        p_data_prevista_retorno: dataPrev || null,
        p_observacoes: obs || null,
        p_foto: caminho,
        p_itens: itensComPreco,
      }).single();
      if (error || !rem) {
        await bucket.remove([caminho]);
        throw error ?? new Error("Não foi possível confirmar a criação da remessa.");
      }

      toast.success(`Remessa #${rem.numero} criada`);
      qc.invalidateQueries({ queryKey: ["remessas"] });
      navigate({ to: "/remessas/$id", params: { id: rem.id } });
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar remessa");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="mb-2">
        <Link to="/remessas" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
      </div>
      <PageHeader title="Nova Remessa" description="Envie tapetes para uma costureira" />

      <div className="bg-card rounded-lg border p-6 space-y-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Costureira *</Label>
            <Select value={costureiraId} onValueChange={setCostureiraId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {costureiras.filter((c: any) => c.ativa).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="data-envio">Data do envio *</Label>
            <Input id="data-envio" type="date" required value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Previsão de retorno</Label>
            <Input type="date" value={dataPrev} onChange={(e) => setDataPrev(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="foto-folha-ivan">Foto da Folha Ivan preenchida *</Label>
          <Input id="foto-folha-ivan" type="file" accept="image/jpeg,image/png,image/webp"
            required disabled={salvando} aria-describedby="foto-folha-ivan-ajuda"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          <p id="foto-folha-ivan-ajuda" className="text-xs text-muted-foreground">
            Uma foto para toda a remessa. JPG, PNG ou WebP, até 10 MB.
          </p>
        </div>
      </div>

      <div className="bg-card rounded-lg border mb-6">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Itens da remessa</h2>
          <Button size="sm" onClick={addItem} disabled={!costureiraId}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar item
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tapete</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead className="w-24 text-center">Qtd</TableHead>
              <TableHead className="w-32 text-right">Preço unit.</TableHead>
              <TableHead className="w-32 text-right">Subtotal</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                {costureiraId ? "Clique em \"Adicionar item\"" : "Selecione a costureira primeiro"}
              </TableCell></TableRow>
            )}
            {itens.map((it, i) => {
              const permitidos = servicosDoModelo(it.tapete_id);
              const preco = findPreco(it.tapete_id, it.servico_id);
              return (
              <TableRow key={i}>
                <TableCell>
                  <SeletorTapete modelos={tapetes} selecionado={modelosPorId.get(it.tapete_id)}
                    onSelect={(id) => { if (id !== it.tapete_id) updateItem(i, { tapete_id: id, servico_id: "" }); }} />
                </TableCell>
                <TableCell>
                  <Select value={permitidos.some((s) => s.id === it.servico_id) ? it.servico_id : ""} onValueChange={(v) => updateItem(i, { servico_id: v })} disabled={!permitidos.length}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={
                      !it.tapete_id ? "Selecione o tapete"
                        : carregandoServicos ? "Carregando serviços..."
                        : erroServicos ? "Erro ao carregar serviços"
                        : permitidos.length === 0 ? "Sem serviços cadastrados"
                        : "Serviço"
                    } /></SelectTrigger>
                    <SelectContent>
                      {permitidos.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number" min={1} className="h-9 text-center"
                    value={it.quantidade_enviada}
                    onChange={(e) => updateItem(i, { quantidade_enviada: parseInt(e.target.value) || 1 })}
                  />
                </TableCell>
                <TableCell>
                  <span className="block text-right tabular-nums">
                    {preco !== undefined ? brl(preco)
                      : !it.servico_id ? "—"
                      : carregandoPrecos ? "Carregando..."
                      : erroPrecos ? "Erro ao carregar"
                      : "Sem preço cadastrado"}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {preco === undefined ? "—" : brl(it.quantidade_enviada * preco)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="p-4 border-t flex justify-between items-center bg-muted/30">
          <span className="text-sm text-muted-foreground">Total da remessa</span>
          <span className="text-xl font-bold tabular-nums">{brl(total)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link to="/remessas"><Button variant="outline">Cancelar</Button></Link>
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Criar remessa"}</Button>
      </div>
    </>
  );
}
