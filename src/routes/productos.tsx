import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, type Product } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/productos")({
  head: () => ({
    meta: [
      { title: "Productos · Don Manuel" },
      { name: "description", content: "Catálogo editable de productos y piezas por caja." },
    ],
  }),
  component: ProductosPage,
});

function ProductosPage() {
  const products = useStore((s) => s.products);
  const removeProduct = useStore((s) => s.removeProduct);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo y precios.
          </p>
        </div>
        <ProductDialog>
          <Button size="sm"><Plus /> Nuevo</Button>
        </ProductDialog>
      </div>

      <div className="space-y-2">
        {products.length === 0 && (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Sin productos.
          </CardContent></Card>
        )}
        {products.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.piecesPerBox} pzs/caja
                  {p.unitPrice > 0 && ` · $${p.unitPrice.toFixed(2)} c/u`}
                </div>
              </div>
              <ProductDialog product={p}>
                <Button size="icon" variant="ghost"><Pencil /></Button>
              </ProductDialog>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm(`¿Eliminar "${p.name}"?`)) removeProduct(p.id);
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

function ProductDialog({
  product,
  children,
}: {
  product?: Product;
  children: React.ReactNode;
}) {
  const upsert = useStore((s) => s.upsertProduct);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product?.name ?? "");
  const [pieces, setPieces] = useState(String(product?.piecesPerBox ?? 60));
  const [price, setPrice] = useState(String(product?.unitPrice ?? 0));

  const submit = () => {
    if (!name.trim()) return;
    upsert({
      id: product?.id ?? crypto.randomUUID(),
      name: name.trim().slice(0, 60),
      piecesPerBox: Math.max(1, parseInt(pieces) || 60),
      unitPrice: Math.max(0, parseFloat(price) || 0),
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Piezas por caja</Label>
              <Input
                inputMode="numeric"
                value={pieces}
                onChange={(e) => setPieces(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <Label>Precio por pieza</Label>
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </div>
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
