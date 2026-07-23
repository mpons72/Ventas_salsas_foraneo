import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore, orderTotals, formatMoney, formatDate } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Share2, FileText, FileDown } from "lucide-react";
import { useRef, useState } from "react";
import { shareText, saveAndShareFile, isNative } from "@/lib/nativeIO";
import { printPdfBase64 } from "@/lib/nativePrint";


export const Route = createFileRoute("/pedidos/$id_/nota")({
  head: () => ({
    meta: [
      { title: "Nota de venta · La Salsoa Foráneo" },
      { name: "description", content: "Nota de venta imprimible del pedido." },
    ],
  }),
  component: NotaVenta,
});

function NotaVenta() {
  const { id } = Route.useParams();
  const order = useStore((s) => s.orders.find((o) => o.id === id));
  const clients = useStore((s) => s.clients);
  const products = useStore((s) => s.products);
  const [sharing, setSharing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printing, setPrinting] = useState(false);
  const notaRef = useRef<HTMLDivElement>(null);


  if (!order) {
    return (
      <div className="p-6 text-center">
        Pedido no encontrado.{" "}
        <Link to="/pedidos" className="text-primary underline">Volver</Link>
      </div>
    );
  }
  const client = clients.find((c) => c.id === order.clientId);
  const t = orderTotals(order, products);
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Totales por producto en todo el pedido (usando precios CONGELADOS a nivel del pedido)
  const snap = order.priceSnapshot ?? {};
  const totalsByProduct = new Map<string, { pieces: number; amount: number; unit: number }>();
  for (const b of order.boxes)
    for (const it of b.items) {
      const prev = totalsByProduct.get(it.productId) ?? { pieces: 0, amount: 0, unit: 0 };
      const unit =
        snap[it.productId] ??
        (it as { unitPrice?: number }).unitPrice ??
        productMap.get(it.productId)?.unitPrice ??
        0;
      totalsByProduct.set(it.productId, {
        pieces: prev.pieces + it.pieces,
        amount: prev.amount + it.pieces * unit,
        unit,
      });
    }


  const folio = String(order.number).padStart(4, "0");

  const buildShareText = () => {
    const lines: string[] = [];
    lines.push(`NOTA DE VENTA #${folio}`);
    lines.push(`La Salsoa Foráneo`);
    lines.push(`Fecha: ${formatDate(order.createdAt)}`);
    if (order.shipDate) lines.push(`Envío: ${formatDate(order.shipDate)}`);
    lines.push(`Cliente: ${client?.name ?? "—"}`);
    if (client?.phone) lines.push(`Tel: ${client.phone}`);
    lines.push("");
    lines.push(`Cajas: ${t.totalBoxes}   Piezas: ${t.totalPieces}`);
    lines.push("");
    lines.push("CONTENIDO POR CAJA");
    order.boxes.forEach((b, idx) => {
      const items = b.items.filter((i) => i.pieces > 0);
      lines.push(`• Caja ${idx + 1}:`);
      if (items.length === 0) lines.push("    (vacía)");
      items.forEach((it) => {
        const p = productMap.get(it.productId);
        lines.push(`    - ${p?.name ?? "?"}: ${it.pieces} pzs`);
      });
    });
    if (totalsByProduct.size > 0) {
      lines.push("");
      lines.push("TOTALES POR PRODUCTO");
      totalsByProduct.forEach((v, pid) => {
        const p = productMap.get(pid);
        lines.push(
          `  ${p?.name ?? "?"}: ${v.pieces} pzs${v.amount ? "  " + formatMoney(v.amount) : ""}`
        );
      });
    }

    if (order.extras.length > 0) {
      lines.push("");
      lines.push("CARGOS ADICIONALES");
      order.extras.forEach((e) =>
        lines.push(`  ${e.concept}: ${formatMoney(e.amount)}`)
      );
    }
    lines.push("");
    lines.push(`Subtotal: ${formatMoney(t.subtotal)}`);
    if (t.extras) lines.push(`Cargos:   ${formatMoney(t.extras)}`);
    lines.push(`TOTAL:    ${formatMoney(t.total)}`);
    lines.push(`Pagado:   ${formatMoney(t.paid)}`);
    lines.push(`SALDO:    ${formatMoney(t.balance)}`);
    return lines.join("\n");
  };

  const onShare = async () => {
    const text = buildShareText();
    setSharing(true);
    try {
      const result = await shareText(`Nota #${folio}`, text);
      if (result === "clipboard") alert("Nota copiada al portapapeles.");
    } catch {
      /* user cancelled */
    } finally {
      setSharing(false);
    }
  };

  const onDownloadTxt = async () => {
    const text = buildShareText();
    await saveAndShareFile({
      filename: `nota_${folio}_${new Date(order.createdAt).toISOString().slice(0, 10)}.txt`,
      data: text,
      mimeType: "text/plain",
    });
  };

  const buildNotaPdf = async () => {
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
      const x = opts.align === "right" ? pageW - marginX : opts.align === "center" ? pageW / 2 : marginX;
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
    line(`Nota de Venta   Folio: #${folio}`, { size: 11, bold: true });
    line(`Fecha: ${formatDate(order.createdAt)}${order.shipDate ? "   Envío: " + formatDate(order.shipDate) : ""}`);
    hr();

    line("CLIENTE", { size: 9, bold: true });
    line(client?.name ?? "—", { size: 11, bold: true });
    if (client?.phone) line(client.phone);
    if (client?.address) line(client.address);
    y += 4;
    line(`Cajas: ${t.totalBoxes}    Piezas: ${t.totalPieces}    Estado: ${order.status}`, { bold: true });
    hr();

    line("CONTENIDO DETALLADO POR CAJA", { size: 11, bold: true });
    order.boxes.forEach((b, idx) => {
      const items = b.items.filter((i) => i.pieces > 0);
      const total = items.reduce((s, i) => s + i.pieces, 0);
      line(`Caja ${idx + 1}  —  ${total} pzs`, { bold: true });
      if (items.length === 0) {
        line("   (vacía)");
      } else {
        items.forEach((it) => {
          const p = productMap.get(it.productId);
          line(`   • ${p?.name ?? "?"}: ${it.pieces} pzs`);
        });
      }
      y += 2;
    });
    hr();

    if (totalsByProduct.size > 0) {
      line("TOTALES POR PRODUCTO", { size: 11, bold: true });
      totalsByProduct.forEach((v, pid) => {
        const p = productMap.get(pid);
        line(`   ${p?.name ?? "?"}: ${v.pieces} pzs${v.amount ? "   " + formatMoney(v.amount) : ""}`);
      });
      hr();
    }


    if (order.extras.length > 0) {
      line("CARGOS ADICIONALES", { size: 11, bold: true });
      order.extras.forEach((e) =>
        line(`   ${e.concept} (${formatDate(e.date)}): ${formatMoney(e.amount)}`)
      );
      hr();
    }

    line(`Subtotal piezas:  ${formatMoney(t.subtotal)}`, { align: "right" });
    if (t.extras) line(`Cargos:  ${formatMoney(t.extras)}`, { align: "right" });
    line(`TOTAL VENTA:  ${formatMoney(t.total)}`, { size: 12, bold: true, align: "right" });
    line(`Pagado:  ${formatMoney(t.paid)}`, { align: "right" });
    line(`SALDO:  ${formatMoney(t.balance)}`, { size: 12, bold: true, align: "right" });

    if (order.payments.length > 0) {
      y += 6;
      hr();
      line("PAGOS REGISTRADOS", { size: 11, bold: true });
      order.payments.forEach((p) => {
        line(`   ${formatDate(p.date)} — ${p.method ?? "Pago"}${p.note ? " (" + p.note + ")" : ""}: ${formatMoney(p.amount)}`);
      });
    }

    y += 20;
    line("¡Gracias por su compra! · La Salsoa Foráneo", { size: 9, align: "center" });

    return pdf;
  };

  const onDownloadPdf = async () => {
    setExportingPdf(true);
    try {
      const pdf = await buildNotaPdf();
      const filename = `nota_${folio}_${new Date(order.createdAt).toISOString().slice(0, 10)}.pdf`;
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
      const pdf = await buildNotaPdf();
      const base64 = pdf.output("datauristring").split(",")[1];
      await printPdfBase64(base64, `Nota ${folio}`);
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
            Nota #{folio}
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
        <div ref={notaRef} className="bg-white text-black rounded-2xl print:rounded-none shadow-sm print:shadow-none p-6 print:p-8 border print:border-0">

          <header className="flex items-start justify-between border-b pb-4 mb-4">
            <div>
              <div className="text-2xl font-extrabold tracking-tight">La Salsoa</div>
              <div className="text-xs text-gray-500">Ventas Foráneo · Salsas artesanales</div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">Nota de Venta</div>
              <div className="text-gray-600">Folio: <span className="font-mono">#{folio}</span></div>
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
              <div><span className="text-gray-600">Cajas:</span> <span className="font-semibold">{t.totalBoxes}</span></div>
              <div><span className="text-gray-600">Piezas:</span> <span className="font-semibold">{t.totalPieces}</span></div>
              <div><span className="text-gray-600">Estado:</span> <span className="font-semibold capitalize">{order.status}</span></div>
            </div>
          </section>

          {/* Detalle por caja */}
          <section className="mb-4">
            <div className="text-sm font-semibold mb-2">Contenido detallado por caja</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border px-2 py-1.5">Caja</th>
                    <th className="border px-2 py-1.5">Producto</th>
                    <th className="border px-2 py-1.5 text-right">Piezas</th>
                    <th className="border px-2 py-1.5 text-right">Subtotal caja</th>
                  </tr>
                </thead>
                <tbody>
                  {order.boxes.map((b, idx) => {
                    const items = b.items.filter((i) => i.pieces > 0);
                    const boxPieces = items.reduce((s, i) => s + i.pieces, 0);
                    if (items.length === 0) {
                      return (
                        <tr key={b.id}>
                          <td className="border px-2 py-1.5 font-semibold">Caja {idx + 1}</td>
                          <td className="border px-2 py-1.5 italic text-gray-400" colSpan={3}>
                            (vacía)
                          </td>
                        </tr>
                      );
                    }
                    return items.map((it, i) => {
                      const p = productMap.get(it.productId);
                      return (
                        <tr key={b.id + it.productId}>
                          {i === 0 && (
                            <td
                              className="border px-2 py-1.5 font-semibold align-top bg-gray-50"
                              rowSpan={items.length}
                            >
                              Caja {idx + 1}
                            </td>
                          )}
                          <td className="border px-2 py-1.5">{p?.name ?? "?"}</td>
                          <td className="border px-2 py-1.5 text-right">{it.pieces}</td>
                          {i === 0 && (
                            <td
                              className="border px-2 py-1.5 text-right font-semibold align-top bg-gray-50"
                              rowSpan={items.length}
                            >
                              {boxPieces} pzs
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })}
                  <tr className="bg-gray-100 font-semibold">
                    <td className="border px-2 py-1.5" colSpan={2}>Total general</td>
                    <td className="border px-2 py-1.5 text-right">{t.totalPieces}</td>
                    <td className="border px-2 py-1.5 text-right">{t.totalBoxes} cajas</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Totales por producto */}
          {totalsByProduct.size > 0 && (
            <section className="mb-4">
              <div className="text-sm font-semibold mb-2">Totales por producto</div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border px-2 py-1.5">Producto</th>
                    <th className="border px-2 py-1.5 text-right">Piezas</th>
                    <th className="border px-2 py-1.5 text-right">P. unit.</th>
                    <th className="border px-2 py-1.5 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(totalsByProduct.entries()).map(([pid, v]) => {
                    const p = productMap.get(pid);
                    return (
                      <tr key={pid}>
                        <td className="border px-2 py-1.5">{p?.name ?? "?"}</td>
                        <td className="border px-2 py-1.5 text-right">{v.pieces}</td>
                        <td className="border px-2 py-1.5 text-right">
                          {v.unit ? formatMoney(v.unit) : "—"}
                        </td>
                        <td className="border px-2 py-1.5 text-right">
                          {v.amount ? formatMoney(v.amount) : "—"}
                        </td>
                      </tr>
                    );
                  })}

                </tbody>
              </table>
            </section>
          )}

          {/* Cargos */}
          {order.extras.length > 0 && (
            <section className="mb-4">
              <div className="text-sm font-semibold mb-2">Cargos adicionales</div>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {order.extras.map((e) => (
                    <tr key={e.id}>
                      <td className="border px-2 py-1.5">{e.concept}</td>
                      <td className="border px-2 py-1.5 text-gray-500 text-xs">{formatDate(e.date)}</td>
                      <td className="border px-2 py-1.5 text-right">{formatMoney(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Totales finales */}
          <section className="ml-auto max-w-xs text-sm space-y-1">
            <Line label="Subtotal piezas" value={formatMoney(t.subtotal)} />
            {t.extras !== 0 && <Line label="Cargos" value={formatMoney(t.extras)} />}
            <Line label="TOTAL VENTA" value={formatMoney(t.total)} bold />
            <Line label="Pagado" value={formatMoney(t.paid)} />
            <div className="border-t pt-1">
              <Line label="SALDO" value={formatMoney(t.balance)} bold />
            </div>
          </section>

          {/* Pagos */}
          {order.payments.length > 0 && (
            <section className="mt-4">
              <div className="text-sm font-semibold mb-1">Pagos registrados</div>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {order.payments.map((p) => (
                  <li key={p.id}>
                    {formatDate(p.date)} — {p.method ?? "Pago"}
                    {p.note && ` (${p.note})`}: {formatMoney(p.amount)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
            ¡Gracias por su compra! · La Salsoa Foráneo
          </footer>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
