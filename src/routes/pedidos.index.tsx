import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, orderTotals, formatMoney, formatDate } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Boxes, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";


type Search = { cliente?: string };

export const Route = createFileRoute("/pedidos/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    cliente: typeof s.cliente === "string" ? s.cliente : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pedidos · Don Manuel" },
      { name: "description", content: "Pedidos abiertos, enviados y pagados." },
    ],
  }),
  component: PedidosPage,
});

function PedidosPage() {
  const orders = useStore((s) => s.orders);
  const clients = useStore((s) => s.clients);
  const products = useStore((s) => s.products);
  const { cliente } = Route.useSearch();

  const list = useMemo(() => {
    return orders.filter((o) => !cliente || o.clientId === cliente);
  }, [orders, cliente]);

  const clientName = cliente
    ? clients.find((c) => c.id === cliente)?.name
    : undefined;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            {clientName ? `Cliente: ${clientName}` : "Todos tus pedidos"}
          </p>
        </div>
        <NewOrderDialog defaultClientId={cliente}>
          <Button size="sm"><Plus /> Nuevo</Button>
        </NewOrderDialog>
      </div>

      {clientName && (
        <Link to="/pedidos" className="text-xs text-primary mb-3 inline-block">
          ← Ver todos
        </Link>
      )}

      <div className="space-y-2">
        {list.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Sin pedidos.
          </CardContent></Card>
        )}
        {list.map((o) => {
          const c = clients.find((x) => x.id === o.clientId);
          const t = orderTotals(o, products);
          return (
            <Link
              key={o.id}
              to="/pedidos/$id"
              params={{ id: o.id }}
              className="block"
            >
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center font-semibold">
                    #{o.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {o.name ? o.name : (c?.name ?? "Sin cliente")}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {o.name ? `${c?.name ?? "Sin cliente"} · ` : ""}
                      {formatDate(o.createdAt)} · {t.totalBoxes} cajas · {t.totalPieces} pzs
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {formatMoney(t.total)}
                    </div>
                    <StatusBadge status={o.status} balance={t.balance} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

function StatusBadge({
  status,
  balance,
}: {
  status: string;
  balance: number;
}) {
  if (balance > 0)
    return (
      <span className="text-[10px] bg-warning text-warning-foreground rounded-full px-2 py-0.5">
        Saldo {formatMoney(balance)}
      </span>
    );
  if (status === "pagado")
    return (
      <span className="text-[10px] bg-success/15 text-success rounded-full px-2 py-0.5">
        Pagado
      </span>
    );
  return (
    <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 capitalize">
      {status}
    </span>
  );
}

function NewOrderDialog({
  defaultClientId,
  children,
}: {
  defaultClientId?: string;
  children: React.ReactNode;
}) {
  const clients = useStore((s) => s.clients);
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const createOrder = useStore((s) => s.createOrder);
  const addExtra = useStore((s) => s.addExtra);
  const addPayment = useStore((s) => s.addPayment);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [name, setName] = useState("");
  const [transferBalance, setTransferBalance] = useState(true);

  // Saldos pendientes de pedidos anteriores del cliente
  const pending = useMemo(() => {
    if (!clientId) return { total: 0, items: [] as { id: string; number: number; balance: number }[] };
    const items = orders
      .filter((o) => o.clientId === clientId && o.status !== "cancelado")
      .map((o) => ({
        id: o.id,
        number: o.number,
        balance: orderTotals(o, products).balance,
      }))
      .filter((x) => x.balance > 0.005);
    return { total: items.reduce((s, x) => s + x.balance, 0), items };
  }, [clientId, orders, products]);

  // Al cambiar de cliente, reactiva el traslado por defecto
  useEffect(() => {
    setTransferBalance(true);
  }, [clientId]);

  const submit = () => {
    if (!clientId) return;
    const o = createOrder(clientId);
    const trimmed = name.trim();
    if (trimmed) {
      useStore.getState().updateOrder(o.id, { name: trimmed });
    }
    if (transferBalance && pending.total > 0) {
      const nowIso = new Date().toISOString();
      const nums = pending.items.map((x) => `#${x.number}`).join(", ");
      addExtra(o.id, {
        date: nowIso,
        concept: `Saldo anterior (${nums})`,
        amount: pending.total,
      });
      // Liquida los pedidos anteriores dejando constancia del traslado
      for (const prev of pending.items) {
        addPayment(prev.id, {
          date: nowIso,
          amount: prev.balance,
          method: "Traslado",
          note: `Trasladado al pedido #${o.number}`,
        });
      }
    }
    setOpen(false);
    navigate({ to: "/pedidos/$id", params: { id: o.id } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo pedido</DialogTitle>
        </DialogHeader>
        {clients.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            Primero registra un cliente.{" "}
            <Link to="/clientes" className="text-primary underline">
              Ir a clientes
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="text-sm font-medium">Cliente</label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div>
              <Label className="text-sm">Nombre del pedido (opcional)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Ej. Pedido de la boda"
              />
            </div>

            {pending.total > 0 && (
              <div className="rounded-lg border bg-warning/10 p-3 space-y-2">
                <div className="text-sm">
                  Este cliente tiene un saldo pendiente de{" "}
                  <span className="font-semibold">{formatMoney(pending.total)}</span>
                  {" "}en {pending.items.length === 1 ? "el pedido" : "los pedidos"}{" "}
                  {pending.items.map((x) => `#${x.number}`).join(", ")}.
                </div>
                <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
                  <Checkbox
                    checked={transferBalance}
                    onCheckedChange={(v) => setTransferBalance(!!v)}
                    className="mt-0.5"
                  />
                  <span>
                    Sumar el saldo a este nuevo pedido{" "}
                    <span className="text-muted-foreground">
                      (se registrará como cargo "Saldo anterior" y liquidará los pedidos previos con un traslado).
                    </span>
                  </span>
                </label>
              </div>
            )}

            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Boxes className="size-3" />
              Se creará con una caja vacía lista para llenar.
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!clientId}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

