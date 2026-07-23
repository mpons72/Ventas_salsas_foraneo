import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  useStore, orderTotals, formatMoney, formatDate,
  type Order,
} from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Box, FileText, Plus, Printer, Receipt, Trash2, Truck, Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/pedidos/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Pedido · Don Manuel` },
      { name: "description", content: `Detalle del pedido ${params.id}` },
    ],
  }),
  component: PedidoDetail,
  notFoundComponent: () => (
    <AppShell><div className="p-6 text-center">Pedido no encontrado.</div></AppShell>
  ),
});

function PedidoDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const order = useStore((s) => s.orders.find((o) => o.id === id));
  const allOrders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const clients = useStore((s) => s.clients);
  const addBox = useStore((s) => s.addBox);
  const removeBox = useStore((s) => s.removeBox);
  const setBoxItem = useStore((s) => s.setBoxItem);
  const updateOrder = useStore((s) => s.updateOrder);
  const setOrderNumber = useStore((s) => s.setOrderNumber);
  const removeOrder = useStore((s) => s.removeOrder);
  const addPayment = useStore((s) => s.addPayment);
  const removePayment = useStore((s) => s.removePayment);
  const addExtra = useStore((s) => s.addExtra);
  const removeExtra = useStore((s) => s.removeExtra);
  const [numberDraft, setNumberDraft] = useState<string | null>(null);

  if (!order) {
    return <AppShell><div className="text-center py-10">Pedido no encontrado.</div></AppShell>;
  }
  const client = clients.find((c) => c.id === order.clientId);
  const t = orderTotals(order, products);

  return (
    <AppShell>
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <Button asChild size="icon" variant="ghost" className="shrink-0">
            <Link to="/pedidos"><ArrowLeft /></Link>
          </Button>
          <span className="text-lg font-bold whitespace-nowrap">Pedido #</span>
          <Input
            type="number"
            inputMode="numeric"
            value={numberDraft ?? String(order.number)}
            onFocus={() => setNumberDraft(String(order.number))}
            onChange={(e) => setNumberDraft(e.target.value)}
            onBlur={() => {
              const n = parseInt(numberDraft ?? "", 10);
              if (Number.isFinite(n) && n > 0 && n !== order.number) {
                setOrderNumber(order.id, n);
              }
              setNumberDraft(null);
            }}
            className="h-9 w-20 text-lg font-bold px-2 shrink-0"
          />
        </div>

        {allOrders.some((o) => o.id !== order.id && o.number === order.number) && (
          <p className="text-xs text-destructive pl-1">
            ⚠ Ya existe otro pedido con el número #{order.number}.
          </p>
        )}

        <div className="pl-1 space-y-1.5">
          <Input
            value={order.name ?? ""}
            placeholder="Nombre del pedido (opcional)"
            maxLength={80}
            onChange={(e) =>
              updateOrder(order.id, { name: e.target.value || undefined })
            }
            className="h-9 text-sm"
          />
          <div className="text-sm text-muted-foreground">
            {client?.name ?? "Sin cliente"} · {formatDate(order.createdAt)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-auto py-2 whitespace-normal text-xs leading-tight gap-1.5"
          >
            <Link to="/pedidos/$id/nota" params={{ id: order.id }}>
              <FileText className="shrink-0 size-4" />
              Nota por piezas y pagos
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-auto py-2 whitespace-normal text-xs leading-tight gap-1.5"
          >
            <Link to="/pedidos/$id/pagos" params={{ id: order.id }}>
              <Receipt className="shrink-0 size-4" />
              Historial de pagos
            </Link>
          </Button>
        </div>
      </div>

      {/* Status & ship date */}
      <Card className="mb-3">
        <CardContent className="p-3 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Estado</Label>
            <Select
              value={order.status}
              onValueChange={(v) => updateOrder(order.id, { status: v as Order["status"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="abierto">Abierto</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Fecha de envío</Label>
            <Input
              type="date"
              value={order.shipDate ? order.shipDate.slice(0, 10) : ""}
              onChange={(e) =>
                updateOrder(order.id, {
                  shipDate: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : undefined,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <MiniStat label="Cajas" value={t.totalBoxes} />
        <MiniStat label="Piezas" value={t.totalPieces} />
        <MiniStat label="Total" value={formatMoney(t.total)} />
      </div>
      <Card className="mb-3">
        <CardContent className="p-3 text-sm space-y-1">
          <Row label="Subtotal productos" value={formatMoney(t.subtotal)} />
          {t.extras !== 0 && <Row label="Cargos extra" value={formatMoney(t.extras)} />}
          <Row label="Pagado" value={formatMoney(t.paid)} tone="success" />
          <div className="border-t pt-1 mt-1">
            <Row
              label="Saldo"
              value={formatMoney(t.balance)}
              tone={t.balance > 0 ? "warning" : "muted"}
              bold
            />
          </div>
        </CardContent>
      </Card>

      {/* Boxes */}
      <SectionHeader
        icon={<Box className="size-4" />}
        title="Cajas"
        action={
          <Button size="sm" variant="outline" onClick={() => addBox(order.id)}>
            <Plus /> Caja
          </Button>
        }
      />
      <div className="space-y-3 mb-4">
        {order.boxes.map((b, idx) => {
          const totalPzs = b.items.reduce((s, i) => s + i.pieces, 0);
          return (
            <Card key={b.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Caja {idx + 1}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {totalPzs} pzs
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`¿Eliminar Caja ${idx + 1}?`))
                          removeBox(order.id, b.id);
                      }}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  {products.map((p) => {
                    const item = b.items.find((i) => i.productId === p.id);
                    const pieces = item?.pieces ?? 0;
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <div className="flex-1 text-sm truncate">{p.name}</div>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() =>
                            setBoxItem(order.id, b.id, p.id, Math.max(0, pieces - p.piecesPerBox))
                          }
                        >
                          −
                        </Button>
                        <Input
                          inputMode="numeric"
                          className="h-8 w-16 text-center"
                          value={pieces || ""}
                          placeholder="0"
                          onChange={(e) =>
                            setBoxItem(
                              order.id, b.id, p.id,
                              Math.max(0, parseInt(e.target.value.replace(/\D/g, "")) || 0)
                            )
                          }
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() =>
                            setBoxItem(order.id, b.id, p.id, pieces + p.piecesPerBox)
                          }
                        >
                          +
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Extras */}
      <SectionHeader
        icon={<Truck className="size-4" />}
        title="Cargos adicionales"
        action={
          <ExtraDialog onAdd={(e) => addExtra(order.id, e)}>
            <Button size="sm" variant="outline"><Plus /> Cargo</Button>
          </ExtraDialog>
        }
      />
      <div className="space-y-2 mb-4">
        {order.extras.length === 0 && (
          <Card><CardContent className="py-4 text-center text-xs text-muted-foreground">
            Sin cargos.
          </CardContent></Card>
        )}
        {order.extras.map((e) => (
          <Card key={e.id}><CardContent className="p-3 flex items-center gap-2">
            <div className="flex-1">
              <div className="text-sm font-medium">{e.concept}</div>
              <div className="text-xs text-muted-foreground">{formatDate(e.date)}</div>
            </div>
            <div className="text-sm font-semibold">{formatMoney(e.amount)}</div>
            <Button size="icon" variant="ghost" onClick={() => removeExtra(order.id, e.id)}>
              <Trash2 className="text-destructive" />
            </Button>
          </CardContent></Card>
        ))}
      </div>

      {/* Payments */}
      <SectionHeader
        icon={<Wallet className="size-4" />}
        title="Pagos / Abonos"
        action={
          <PaymentDialog onAdd={(p) => addPayment(order.id, p)}>
            <Button size="sm" variant="outline"><Plus /> Pago</Button>
          </PaymentDialog>
        }
      />
      <div className="space-y-2 mb-6">
        {order.payments.length === 0 && (
          <Card><CardContent className="py-4 text-center text-xs text-muted-foreground">
            Sin pagos registrados.
          </CardContent></Card>
        )}
        {order.payments.map((p) => (
          <Card key={p.id}><CardContent className="p-3 flex items-center gap-2">
            <div className="flex-1">
              <div className="text-sm font-medium">
                {p.method ?? "Pago"} {p.note && `· ${p.note}`}
              </div>
              <div className="text-xs text-muted-foreground">{formatDate(p.date)}</div>
            </div>
            <div className="text-sm font-semibold text-success">
              {formatMoney(p.amount)}
            </div>
            <Button size="icon" variant="ghost" onClick={() => removePayment(order.id, p.id)}>
              <Trash2 className="text-destructive" />
            </Button>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Button asChild variant="default">
          <Link to="/pedidos/$id/nota" params={{ id: order.id }}>
            <Printer /> Nota por PIEZAS y pagos
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/pedidos/$id/pagos" params={{ id: order.id }}>
            <Receipt /> Nota historial de Pagos
          </Link>
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            if (confirm("¿Eliminar este pedido por completo?")) {
              removeOrder(order.id);
              navigate({ to: "/pedidos" });
            }
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </AppShell>
  );
}

function SectionHeader({
  icon, title, action,
}: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {action}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function Row({
  label, value, tone = "default", bold = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "muted";
  bold?: boolean;
}) {
  const t =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning-foreground bg-warning rounded px-1.5" :
    tone === "muted" ? "text-muted-foreground" : "";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-bold text-base" : ""} ${t}`}>{value}</span>
    </div>
  );
}

function ExtraDialog({
  onAdd, children,
}: {
  onAdd: (e: { date: string; concept: string; amount: number }) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [concept, setConcept] = useState("Paquetería");
  const [amount, setAmount] = useState("0");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo cargo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Concepto</Label><Input value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={100} /></div>
          <div><Label>Monto</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              const a = parseFloat(amount);
              if (!concept.trim() || !a) return;
              onAdd({ date: new Date(date).toISOString(), concept: concept.trim(), amount: a });
              setOpen(false);
            }}
          >Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  onAdd, children,
}: {
  onAdd: (p: { date: string; amount: number; method?: string; note?: string }) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Monto</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
          <div><Label>Método</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Efectivo", "Transferencia", "Depósito", "Tarjeta", "Otro"].map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Nota</Label><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              const a = parseFloat(amount);
              if (!a) return;
              onAdd({
                date: new Date(date).toISOString(),
                amount: a,
                method,
                note: note.trim() || undefined,
              });
              setOpen(false);
            }}
          >Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
