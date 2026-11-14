export type ModeloNome = {
  nome: string;
  ano_inicio?: number | null;
  ano_fim?: number | null;
  materiais?: readonly string[] | null;
  tipos_tapete?: { nome: string } | null;
};

export function faixaAnosTapete(inicio?: number | null, fim?: number | null) {
  return inicio == null ? "" : inicio + "/" + (fim ?? "Atual");
}

export function nomeTapete(modelo?: ModeloNome | null) {
  if (!modelo) return "";
  const anos = faixaAnosTapete(modelo.ano_inicio, modelo.ano_fim);
  const materiais = modelo.materiais?.filter(Boolean).join(", ");
  const tipo = modelo.tipos_tapete?.nome;
  return [modelo.nome, anos, materiais && "(" + materiais + ")", tipo && "(" + tipo + ")"]
    .filter(Boolean).join(" ");
}
