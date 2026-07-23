import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, type Client, orderTotals, formatMoney } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, User } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · Don Manuel" },
      { name: "description", content: "Gestión de clientes y sus saldos pendientes." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const clients = useStore((s) => s.clients);
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const removeClient = useStore((s) => s.removeClient);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients
      .map((c) => {
        const cOrders = orders.filter((o) => o.clientId === c.id);
        const balance = cOrders.reduce(
          (s, o) => s + orderTotals(o, products).balance,
          0
        );
        return { c, count: cOrders.length, balance };
      })
      .filter(({ c }) => !term || c.name.toLowerCase().includes(term));
  }, [clients, orders, products, q]);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Tu cartera.</p>
        </div>
        <ClientDialog>
          <Button size="sm"><Plus /> Nuevo</Button>
        </ClientDialog>
      </div>

      <Input
        placeholder="Buscar cliente…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3"
      />

      <div className="space-y-2">
        {list.length === 0 && (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Sin clientes. Agrega el primero.
          </CardContent></Card>
        )}
        {list.map(({ c, count, balance }) => (
          <Card key={c.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="size-10 rounded-full bg-accent/30 grid place-items-center">
                <User className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {count} pedidos
                  {c.phone && ` · ${c.phone}`}
                </div>
              </div>
              {balance > 0 && (
                <span className="text-xs bg-warning text-warning-foreground rounded-full px-2 py-1">
                  {formatMoney(balance)}
                </span>
              )}
              <Link
                to="/pedidos"
                search={{ cliente: c.id } as never}
                className="text-xs text-primary px-2"
              >
                Pedidos
              </Link>
              <ClientDialog client={c}>
                <Button size="icon" variant="ghost"><Pencil /></Button>
              </ClientDialog>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm(`¿Eliminar a "${c.name}"?`)) removeClient(c.id);
                }}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

function ClientDialog({
  client,
  children,
}: {
  client?: Client;
  children: React.ReactNode;
}) {
  const upsert = useStore((s) => s.upsertClient);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(client?.name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");

  const submit = () => {
    if (!name.trim()) return;
    upsert({
      id: client?.id ?? crypto.randomUUID(),
      name: name.trim().slice(0, 80),
      phone: phone.trim().slice(0, 30) || undefined,
      address: address.trim().slice(0, 200) || undefined,
      notes: notes.trim().slice(0, 500) || undefined,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
            />
          </div>
          <div>
            <Label>Dirección / Paquetería</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
