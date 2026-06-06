import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Item = {
  tapete: { nome: string; tipos_tapete?: { nome: string } };
  servico: { nome: string };
  quantidade_enviada: number;
  quantidade_retornada: number;
  preco_unitario: number;
};

type Remessa = {
  numero: number;
  data_envio: string;
  data_prevista_retorno: null | string;
  costureira: { nome: string };
  observacoes: string | null;
  remessa_itens: Item[];
};

interface ImprimirRemessaProps {
  remessa: Remessa;
  onClose?: () => void;
}

export function ImprimirRemessa({ remessa, onClose }: ImprimirRemessaProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const originalTitle = document.title;
    document.title = `Remessa #${remessa.numero}`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Remessa #${remessa.numero}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Arial', sans-serif;
                padding: 40px;
                font-size: 14px;
              }
              .container { max-width: 1200px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 30px; }
              .header h1 { font-size: 24px; margin-bottom: 8px; }
              .header p { color: #666; }
              .info-section { 
                display: grid; 
                grid-template-columns: 1fr 1fr; 
                gap: 20px; 
                margin-bottom: 30px;
                padding: 15px;
                background: #f5f5f5;
                border-radius: 8px;
              }
              .info-item { margin-bottom: 8px; }
              .info-label { font-weight: bold; font-size: 12px; color: #666; }
              .info-value { font-size: 14px; margin-top: 4px; }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 12px;
                text-align: left;
              }
              th {
                background-color: #f5f5f5;
                font-weight: bold;
                font-size: 13px;
              }
              td {
                font-size: 13px;
              }
              .assinaturas {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 40px;
                margin-top: 50px;
                padding-top: 20px;
              }
              .assinatura-linha {
                border-top: 1px solid #000;
                margin-top: 40px;
                padding-top: 10px;
                width: 100%;
              }
              .observacoes {
                margin-top: 30px;
                padding: 15px;
                background: #f9f9f9;
                border-radius: 8px;
              }
              .observacoes h4 { margin-bottom: 8px; }
              .footer {
                margin-top: 50px;
                text-align: center;
                font-size: 11px;
                color: #999;
              }
              @media print {
                body { padding: 0; }
                button { display: none; }
              }
            </style>
          </head>
          <body>
            <div>${printContent.innerHTML}</div>
            <script>
              window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
    document.title = originalTitle;
    if (onClose) onClose();
  };

  const pendente = (item: Item) => {
    return item.quantidade_enviada - item.quantidade_retornada;
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handlePrint} className="print:hidden">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir / Exportar PDF
        </Button>
      </div>

      <div ref={printRef}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="header" style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>REMESSA DE TAPETES</h1>
            <p style={{ color: '#666' }}>Nº {remessa.numero}</p>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '20px', 
            marginBottom: '30px',
            padding: '15px',
            background: '#f5f5f5',
            borderRadius: '8px'
          }}>
            <div>
              <div className="info-item">
                <div className="info-label">COSTUREIRA</div>
                <div className="info-value">{remessa.costureira?.nome || '-'}</div>
              </div>
              <div className="info-item">
                <div className="info-label">DATA DE ENVIO</div>
                <div className="info-value">
                  {remessa.data_envio ? format(new Date(remessa.data_envio), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                </div>
              </div>
            </div>
            <div>
              <div className="info-item">
                <div className="info-label">PREVISÃO DE RETORNO</div>
                <div className="info-value">
                  {remessa.data_prevista_retorno ? format(new Date(remessa.data_prevista_retorno), "dd/MM/yyyy", { locale: ptBR }) : 'Não informada'}
                </div>
              </div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '12px', background: '#f5f5f5' }}>Tapete</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', background: '#f5f5f5' }}>Tipo</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', background: '#f5f5f5' }}>Serviço</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', background: '#f5f5f5' }}>Enviado</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', background: '#f5f5f5' }}>Conferência</th>
                <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', background: '#f5f5f5' }}>Pendente</th>
              </tr>
            </thead>
            <tbody>
              {remessa.remessa_itens?.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ddd', padding: '12px' }}>{item.tapete?.nome || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px' }}>{item.tapete?.tipos_tapete?.nome || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px' }}>{item.servico?.nome || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>{item.quantidade_enviada}</td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}></td>
                  <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}></td>
                </tr>
              ))}
            </tbody>
          </table>

          {remessa.observacoes && (
            <div style={{ marginTop: '30px', padding: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '8px' }}>Observações</h4>
              <p>{remessa.observacoes}</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px', marginTop: '50px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>CONFERENTE / MOTORISTA</div>
              <div style={{ borderTop: '1px solid #000', marginTop: '40px', paddingTop: '10px' }}></div>
              
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>RECEBIDO POR (COSTUREIRA)</div>
              <div style={{ borderTop: '1px solid #000', marginTop: '40px', paddingTop: '10px' }}></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px', marginTop: '50px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>CONFERENTE</div>
              <div style={{ borderTop: '1px solid #000', marginTop: '40px', paddingTop: '10px' }}></div>
              
            </div>
          </div>

          <div className="footer" style={{ marginTop: '50px', textAlign: 'center', fontSize: '11px', color: '#999' }}>
            Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>
      </div>
    </>
  );
}