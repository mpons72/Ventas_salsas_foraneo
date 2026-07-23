import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, orderTotals, formatMoney } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Boxes, ArrowRight, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Don Manuel — Inicio" },
      { name: "description", content: "Resumen rápido de pedidos, cajas y saldos pendientes." },
    ],
  }),
  component: Index,
});

function Index() {
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const clients = useStore((s) => s.clients);

  const totals = orders.reduce(
    (acc, o) => {
      const t = orderTotals(o, products);
      acc.boxes += t.totalBoxes;
      acc.pieces += t.totalPieces;
      acc.balance += t.balance;
      acc.sales += t.total;
      return acc;
    },
    { boxes: 0, pieces: 0, balance: 0, sales: 0 }
  );

  const recent = orders.slice(0, 5);

  return (
    <AppShell>
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hola 👋</h1>
          <p className="text-sm text-muted-foreground">
            Resumen de tu operación.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Pedidos" value={orders.length} />
          <Stat label="Clientes" value={clients.length} />
          <Stat label="Cajas totales" value={totals.boxes} />
          <Stat label="Piezas totales" value={totals.pieces} />
          <Stat
            label="Ventas"
            value={formatMoney(totals.sales)}
            tone="success"
            wide
          />
          <Stat
            label="Saldo por cobrar"
            value={formatMoney(totals.balance)}
            tone={totals.balance > 0 ? "warning" : "muted"}
            wide
          />
        </div>

        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link to="/pedidos">
              <Plus /> Nuevo pedido
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to="/clientes">Clientes</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pedidos recientes</CardTitle>
            <Link
              to="/pedidos"
              className="text-xs text-primary inline-flex items-center gap-1"
            >
              Ver todos <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                Aún no hay pedidos. Crea el primero.
              </div>
            )}
            {recent.map((o) => {
              const client = clients.find((c) => c.id === o.clientId);
              const t = orderTotals(o, products);
              return (
                <Link
                  key={o.id}
                  to="/pedidos/$id"
                  params={{ id: o.id }}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <Boxes className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      Pedido #{o.number} · {client?.name ?? "Sin cliente"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.totalBoxes} cajas · {t.totalPieces} pzs
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {formatMoney(t.total)}
                    </div>
                    {t.balance > 0 && (
                      <div className="text-xs text-warning-foreground bg-warning rounded-full px-2 py-0.5 inline-block">
                        Saldo {formatMoney(t.balance)}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  tone = "default",
  wide = false,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "muted";
  wide?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success-foreground border-success/20"
      : tone === "warning"
      ? "bg-warning/15 border-warning/30"
      : tone === "muted"
      ? "bg-muted text-muted-foreground"
      : "bg-card";
  return (
    <div
      className={`rounded-2xl border p-4 ${toneClass} ${
        wide ? "col-span-2" : ""
      }`}
    >
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
