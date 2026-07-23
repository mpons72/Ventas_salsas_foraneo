import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore, orderTotals, formatMoney, formatDate } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Share2, FileText, FileDown } from "lucide-react";
import { useState } from "react";
import { shareText, saveAndShareFile, isNative } from "@/lib/nativeIO";
import { printPdfBase64 } from "@/lib/nativePrint";

export const Route = createFileRoute("/pedidos/$id_/pagos")({
  head: () => ({
    meta: [
      { title: "Historial de pagos · La Salsoa Foráneo" },
      { name: "description", content: "Historial de pagos del pedido." },
    ],
  }),
  component: HistorialPagos,
});

function HistorialPagos() {
  const { id } = Route.useParams();
  const order = useStore((s) => s.orders.find((o) => o.id === id));
  const clients = useStore((s) => s.clients);
  const products = useStore((s) => s.products);
  const [sharing, setSharing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printing, setPrinting] = useState(false);

  if (!order) {
    return (
      <div className="p-6 text-center">
        Pedido no encontrado.{" "}
        <Link to="/pedidos" className="text-primary underline">
          Volver
        </Link>
      </div>
    );
  }

  const client = clients.find((c) => c.id === order.clientId);
  const t = orderTotals(order, products);
  const folio = String(order.number).padStart(4, "0");

  const buildShareText = () => {
    const lines: string[] = [];
    lines.push(`HISTORIAL DE PAGOS - Pedido #${folio}`);
    lines.push(`La Salsoa Foráneo`);
    lines.push(`Fecha: ${formatDate(order.createdAt)}`);
    if (order.shipDate) lines.push(`Envío: ${formatDate(order.shipDate)}`);
    lines.push(`Cliente: ${client?.name ?? "—"}`);
    if (client?.phone) lines.push(`Tel: ${client.phone}`);
    lines.push("");
    lines.push(`Cajas: ${t.totalBoxes}   Piezas: ${t.totalPieces}`);
    lines.push(`TOTAL PEDIDO: ${formatMoney(t.total)}`);
    lines.push(`Pagado: ${formatMoney(t.paid)}`);
    lines.push(`SALDO: ${formatMoney(t.balance)}`);
    lines.push("");
    if (order.payments.length > 0) {
      lines.push("PAGOS REALIZADOS");
      order.payments.forEach((p, i) => {
        const paidSoFar = order.payments
          .slice(0, i + 1)
          .reduce((sum, pay) => sum + pay.amount, 0);
        const runningBalance = t.total - paidSoFar;
        lines.push(
          `${i + 1}. ${formatDate(p.date)} - ${p.method ?? "Pago"}${
            p.note ? " (" + p.note + ")" : ""
          }`
        );
        lines.push(`   Monto: ${formatMoney(p.amount)}   Saldo: ${formatMoney(runningBalance)}`);
      });
    } else {
      lines.push("Sin pagos registrados.");
    }
    return lines.join("\n");
  };

  const onShare = async () => {
    const text = buildShareText();
    setSharing(true);
    try {
      const result = await shareText(`Historial de pagos #${folio}`, text);
      if (result === "clipboard") alert("Historial copiado al portapapeles.");
    } catch {
      /* user cancelled */
    } finally {
      setSharing(false);
    }
  };

  const onDownloadTxt = async () => {
    const text = buildShareText();
    await saveAndShareFile({
      filename: `pagos_${folio}_${new Date(order.createdAt).toISOString().slice(0, 10)}.txt`,
      data: text,
      mimeType: "text/plain",
    });
  };

  const buildPagosPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const marginX = 40;
    let y = 50;

    const ensureSpace = (h: number) => {
      if (y + h > pageH - 40) {
        pdf.addPage();
        y = 50;
      }
    };
    const line = (
      text: string,
      opts: { size?: number; bold?: boolean; align?: "left" | "right" | "center"; gap?: number } = {}
    ) => {
      const size = opts.size ?? 10;
      pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
      pdf.setFontSize(size);
      const x =
        opts.align === "right"
          ? pageW - marginX
          : opts.align === "center"
          ? pageW / 2
          : marginX;
      const wrapped = pdf.splitTextToSize(text, pageW - marginX * 2);
      wrapped.forEach((ln: string) => {
        ensureSpace(size + 4);
        pdf.text(ln, x, y, { align: opts.align ?? "left" });
        y += size + 2;
      });
      y += opts.gap ?? 0;
    };
    const hr = () => {
      ensureSpace(10);
      pdf.setDrawColor(180);
      pdf.line(marginX, y, pageW - marginX, y);
      y += 8;
    };

    line("La Salsoa", { size: 18, bold: true });
    line("Ventas Foráneo · Salsas artesanales", { size: 9 });
    line(`Historial de Pagos   Folio: #${folio}`, { size: 11, bold: true });
    line(`Fecha: ${formatDate(order.createdAt)}${order.shipDate ? "   Envío: " + formatDate(order.shipDate) : ""}`);
    hr();

    line("CLIENTE", { size: 9, bold: true });
    line(client?.name ?? "—", { size: 11, bold: true });
    if (client?.phone) line(client.phone);
    if (client?.address) line(client.address);
    y += 4;
    hr();

    line("RESUMEN DEL PEDIDO", { size: 11, bold: true });
    line(`Cajas: ${t.totalBoxes}    Piezas: ${t.totalPieces}`);
    y += 4;
    hr();

    line("TOTAL PEDIDO", { size: 12, bold: true, align: "right" });
    line(formatMoney(t.total), { size: 14, bold: true, align: "right" });
    y += 4;
    line("Pagado", { align: "right" });
    line(formatMoney(t.paid), { align: "right" });
    y += 4;
    line("SALDO", { size: 12, bold: true, align: "right" });
    line(formatMoney(t.balance), { size: 14, bold: true, align: "right" });
    y += 4;
    hr();

    if (order.payments.length > 0) {
      line("PAGOS REALIZADOS", { size: 11, bold: true });
      order.payments.forEach((p, i) => {
        const paidSoFar = order.payments
          .slice(0, i + 1)
          .reduce((sum, pay) => sum + pay.amount, 0);
        const runningBalance = t.total - paidSoFar;
        line(`${i + 1}. ${formatDate(p.date)} — ${p.method ?? "Pago"}${p.note ? " (" + p.note + ")" : ""}`);
        line(`Monto: ${formatMoney(p.amount)}          Saldo: ${formatMoney(runningBalance)}`, { gap: 2 });
      });
      hr();
    } else {
      line("Sin pagos registrados.", { gap: 2 });
      hr();
    }

    y += 20;
    line("La Salsoa Foráneo · Gracias por su preferencia", { size: 9, align: "center" });

    return pdf;
  };

  const onDownloadPdf = async () => {
    setExportingPdf(true);
    try {
      const pdf = await buildPagosPdf();
      const filename = `pagos_${folio}_${new Date(order.createdAt).toISOString().slice(0, 10)}.pdf`;
      const base64 = pdf.output("datauristring").split(",")[1];
      await saveAndShareFile({ filename, data: base64, mimeType: "application/pdf", base64: true });
    } catch (e) {
      console.error("PDF error:", e);
      alert("No se pudo generar el PDF: " + ((e as Error)?.message ?? "error desconocido"));
    } finally {
      setExportingPdf(false);
    }
  };

  const onPrint = async () => {
    if (!isNative()) {
      window.print();
      return;
    }
    setPrinting(true);
    try {
      const pdf = await buildPagosPdf();
      const base64 = pdf.output("datauristring").split(",")[1];
      await printPdfBase64(base64, `Pagos ${folio}`);
    } catch (e) {
      console.error("Print error:", e);
      alert("No se pudo imprimir: " + ((e as Error)?.message ?? "error desconocido"));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-20 bg-card border-b pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-3xl px-4 py-2 flex items-center gap-2 flex-wrap">
          <Button asChild size="icon" variant="ghost">
            <Link to="/pedidos/$id" params={{ id: order.id }}>
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex-1 font-semibold truncate min-w-0">
            Historial de pagos #{folio}
          </div>
          <Button size="sm" variant="outline" onClick={onShare} disabled={sharing}>
            <Share2 /> Compartir
          </Button>
          <Button size="sm" variant="outline" onClick={onDownloadTxt}>
            <FileText /> TXT
          </Button>
          <Button size="sm" variant="outline" onClick={onDownloadPdf} disabled={exportingPdf}>
            <FileDown /> {exportingPdf ? "Generando…" : "PDF"}
          </Button>
          <Button size="sm" onClick={onPrint} disabled={printing}>
            <Printer /> {printing ? "Imprimiendo…" : "Imprimir"}
          </Button>
        </div>
      </div>

      {/* Nota */}
      <div className="mx-auto max-w-3xl p-4 print:p-0">
        <div className="bg-white text-black rounded-2xl print:rounded-none shadow-sm print:shadow-none p-6 print:p-8 border print:border-0">
          <header className="flex items-start justify-between border-b pb-4 mb-4">
            <div>
              <div className="text-2xl font-extrabold tracking-tight">La Salsoa</div>
              <div className="text-xs text-gray-500">Ventas Foráneo · Salsas artesanales</div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">Historial de Pagos</div>
              <div className="text-gray-600">
                Folio: <span className="font-mono">#{folio}</span>
              </div>
              <div className="text-gray-600">Fecha: {formatDate(order.createdAt)}</div>
              {order.shipDate && (
                <div className="text-gray-600">Envío: {formatDate(order.shipDate)}</div>
              )}
            </div>
          </header>

          <section className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <div className="text-gray-500 text-xs uppercase tracking-wide">Cliente</div>
              <div className="font-semibold">{client?.name ?? "—"}</div>
              {client?.phone && <div className="text-gray-600">{client.phone}</div>}
              {client?.address && <div className="text-gray-600 whitespace-pre-wrap">{client.address}</div>}
            </div>
            <div className="text-right">
              <div className="text-gray-500 text-xs uppercase tracking-wide">Resumen</div>
              <div>
                <span className="text-gray-600">Cajas:</span>{" "}
                <span className="font-semibold">{t.totalBoxes}</span>
              </div>
              <div>
                <span className="text-gray-600">Piezas:</span>{" "}
                <span className="font-semibold">{t.totalPieces}</span>
              </div>
              <div>
                <span className="text-gray-600">Estado:</span>{" "}
                <span className="font-semibold capitalize">{order.status}</span>
              </div>
            </div>
          </section>

          <section className="mb-4">
            <div className="text-sm font-semibold mb-2">Resumen de cuenta</div>
            <div className="ml-auto max-w-xs text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Total del pedido</span>
                <span className="font-semibold">{formatMoney(t.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pagado</span>
                <span className="font-semibold">{formatMoney(t.paid)}</span>
              </div>
              <div className="border-t pt-1 flex justify-between text-base">
                <span className="font-bold">SALDO</span>
                <span className="font-bold">{formatMoney(t.balance)}</span>
              </div>
            </div>
          </section>

          <section className="mb-4">
            <div className="text-sm font-semibold mb-2">Pagos realizados</div>
            {order.payments.length === 0 ? (
              <div className="text-sm text-gray-500 italic">Sin pagos registrados.</div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border px-2 py-1.5">#</th>
                    <th className="border px-2 py-1.5">Fecha</th>
                    <th className="border px-2 py-1.5">Método / Nota</th>
                    <th className="border px-2 py-1.5 text-right">Monto</th>
                    <th className="border px-2 py-1.5 text-right">Saldo restante</th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((p, i) => {
                    const paidSoFar = order.payments
                      .slice(0, i + 1)
                      .reduce((sum, pay) => sum + pay.amount, 0);
                    const runningBalance = t.total - paidSoFar;
                    return (
                      <tr key={p.id}>
                        <td className="border px-2 py-1.5">{i + 1}</td>
                        <td className="border px-2 py-1.5">{formatDate(p.date)}</td>
                        <td className="border px-2 py-1.5">
                          {p.method ?? "Pago"}
                          {p.note && <div className="text-xs text-gray-500">{p.note}</div>}
                        </td>
                        <td className="border px-2 py-1.5 text-right font-semibold">
                          {formatMoney(p.amount)}
                        </td>
                        <td className="border px-2 py-1.5 text-right font-semibold">
                          {formatMoney(runningBalance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
            La Salsoa Foráneo · Gracias por su preferencia
          </footer>
        </div>
      </div>
    </div>
  );
}
