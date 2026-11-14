import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type FolhaRetorno = {
  numero: number; ordem: number; costureira: string; dataEnvio: string;
  observacoes?: string | null;
  itens: { carro: string; tipo: string; material: string; enviado: number; pendente: number }[];
};

export function gerarRetornoPdf(folha: FolhaRetorno) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const titulo = folha.ordem + "º RETORNO DA REMESSA #" + folha.numero;
  const margem = 12;
  const largura = doc.internal.pageSize.getWidth();
  const limite = largura - margem;
  const linha = (x1: number, y: number, x2: number) => doc.line(x1, y, x2, y);

  autoTable(doc, {
    margin: { top: 42, left: margem, right: margem, bottom: 15 },
    head: [["Carro", "Tipo Tapete", "Material", "Enviado", "Pendente", "Retirando"]],
    body: folha.itens.map((i) => [i.carro, i.tipo, i.material, i.enviado, i.pendente, ""]),
    theme: "grid",
    rowPageBreak: "avoid",
    styles: { fontSize: 9, minCellHeight: 9, textColor: 0, lineColor: 60, lineWidth: 0.18, valign: "middle" },
    headStyles: { fillColor: 235, textColor: 0 },
    columnStyles: { 3: { halign: "center", cellWidth: 19 }, 4: { halign: "center", cellWidth: 19 }, 5: { cellWidth: 24 } },
    willDrawPage: () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(titulo, largura / 2, 17, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const nome = doc.splitTextToSize("Costureira: " + folha.costureira, limite - margem);
      doc.text(nome.slice(0, 2), margem, 25);
      doc.text("Data do Envio: " + folha.dataEnvio, margem, 37);
      doc.text("Data do Retorno:", 110, 37);
      linha(138, 37.5, limite);
    },
  });
  let y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 42) + 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const observacao = folha.observacoes?.trim();
  if (observacao) {
    const lines: string[] = doc.splitTextToSize("Observação Remessa: " + observacao, limite - margem);
    for (const texto of lines) {
      if (y > 278) { doc.addPage(); y = 18; }
      doc.text(texto, margem, y);
      y += 5;
    }
    y += 4;
  }
  if (y + 32 > 282) { doc.addPage(); y = 18; }
  doc.text("Observação Retorno:", margem, y);
  linha(49, y + 1, limite);
  linha(margem, y + 9, limite);
  const meio = largura / 2;
  linha(margem, y + 25, meio - 6);
  linha(meio + 6, y + 25, limite);
  doc.text("Motorista", (margem + meio - 6) / 2, y + 31, { align: "center" });
  doc.text("Costureira", (meio + 6 + limite) / 2, y + 31, { align: "center" });
  return doc;
}

export function baixarRetornoPdf(folha: FolhaRetorno) {
  gerarRetornoPdf(folha).save("retorno-" + folha.ordem + "-remessa-" + folha.numero + ".pdf");
}
