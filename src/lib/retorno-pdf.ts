import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type FolhaRetorno = {
  numero: number;
  ordem: number;
  costureira: string;
  dataEnvio: string;
  observacoes?: string | null;
  itens: { carro: string; tipo: string; material: string; enviado: number; pendente: number }[];
};

export function gerarRetornoPdf(folha: FolhaRetorno) {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 3.5;
  const limite = largura - margem;
  const titulo = `${folha.ordem}º RETORNO DA REMESSA #${folha.numero}`;
  const linhas = folha.itens.map((item) => [
    item.carro, item.tipo, item.material, String(item.enviado), String(item.pendente), "",
  ]);
  while (linhas.length < 8) linhas.push(["", "", "", "", "", ""]);

  function campo(label: string, valor: string, x: number, inicio: number, fim: number, y: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    const texto = doc.splitTextToSize(valor, fim - inicio - 2) as string[];
    doc.text(texto.slice(0, 2), inicio + 1, y - (texto.length > 1 ? 2 : 0));
    doc.setLineWidth(0.17);
    doc.line(inicio, y + 1.3, fim, y + 1.3);
  }

  autoTable(doc, {
    margin: { top: 38, left: margem, right: margem, bottom: 15 },
    head: [["CARRO", "TIPO TAPETE", "MATERIAL", "ENVIADO", "PENDENTE", "RETIRANDO"]],
    body: linhas,
    theme: "grid",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      minCellHeight: 4.5,
      cellPadding: { top: 0.5, bottom: 0.5, left: 1, right: 1 },
      fillColor: 255,
      textColor: 0,
      lineColor: 0,
      lineWidth: 0.2,
      halign: "center",
      valign: "middle",
    },
    headStyles: { fillColor: 255, fontSize: 8.5, lineWidth: 0.35, minCellHeight: 4.9 },
    columnStyles: {
      0: { cellWidth: 40.6 },
      1: { cellWidth: 40.6 },
      2: { cellWidth: 40.6 },
      3: { cellWidth: 27.05 },
      4: { cellWidth: 27.05 },
      5: { cellWidth: 27.1 },
    },
    willDrawPage: () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(titulo, largura / 2, 27, { align: "center" });
      campo("COSTUREIRA:", folha.costureira, 9, 30.5, 58, 34.4);
      campo("DATA DO ENVIO:", folha.dataEnvio, 63, 87, 114.5, 34.4);
      campo("DATA DO RETORNO:", "", 126, 155.5, 182.5, 34.4);
    },
  });
  let y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 38) + 5.5;
  const observacao = folha.observacoes?.trim();
  doc.setFontSize(8.5);
  if (observacao) {
    if (y > 272) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÃO REMESSA:", 8.5, y);
    doc.setFont("helvetica", "normal");
    const linhasObs = doc.splitTextToSize(observacao, limite - 49) as string[];
    for (const linha of linhasObs) {
      if (y > 278) {
        doc.addPage();
        y = 18;
      }
      doc.text(linha, 49, y);
      y += 4.5;
    }
  }
  if (y > 274) {
    doc.addPage();
    y = 18;
  }
  doc.setFont("helvetica", "bold");
  doc.text("OBSERVAÇÃO RETORNO:", 8.5, y);
  doc.setLineWidth(0.17);
  doc.line(44, y + 1.5, limite, y + 1.5);
  y += 9.5;
  doc.text("MOTORISTA:", 11, y);
  doc.text("COSTUREIRA:", 117.5, y);
  doc.setLineWidth(0.4);
  doc.line(30.5, y + 1.4, 98.5, y + 1.4);
  doc.line(138.5, y + 1.4, limite, y + 1.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("ASSINATURA", 64.5, y + 4.5, { align: "center" });
  doc.text("ASSINATURA", (138.5 + limite) / 2, y + 4.5, { align: "center" });
  return doc;
}

export function baixarRetornoPdf(folha: FolhaRetorno) {
  gerarRetornoPdf(folha).save(`retorno-${folha.ordem}-remessa-${folha.numero}.pdf`);
}
