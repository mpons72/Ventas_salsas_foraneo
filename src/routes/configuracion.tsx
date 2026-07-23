import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useStore, applyTheme, type Theme } from "@/lib/store";
import { Download, Moon, Sun, Upload, Monitor } from "lucide-react";
import { useRef, useState } from "react";
import { saveAndShareFile } from "@/lib/nativeIO";

export const Route = createFileRoute("/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración · La Salsoa Foráneo" },
      { name: "description", content: "Tema y respaldos." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  const exportBackup = async () => {
    const state = useStore.getState();
    const payload = {
      _app: "venta-salsoa-foraneo",
      _version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        products: state.products,
        clients: state.clients,
        orders: state.orders,
        orderCounter: state.orderCounter,
      },
    };
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const hh = String(today.getHours()).padStart(2, "0");
    const mi = String(today.getMinutes()).padStart(2, "0");
    const filename = `backup_venta_salsoa_foraneo_${yyyy}-${mm}-${dd}_${hh}${mi}.json`;

    setExporting(true);
    try {
      await saveAndShareFile({
        filename,
        data: JSON.stringify(payload, null, 2),
        mimeType: "application/json",
      });
      setMsg(`Respaldo listo: ${filename}. Elige dónde guardarlo o enviarlo (Drive, OneDrive, WhatsApp, etc).`);
    } catch (e) {
      setMsg("No se pudo generar el respaldo: " + ((e as Error)?.message ?? "error desconocido"));
    } finally {
      setExporting(false);
    }
  };

  const onImport = async (file: File) => {
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt);
      const data = parsed?.data ?? parsed;
      if (!data || !Array.isArray(data.products) || !Array.isArray(data.clients) || !Array.isArray(data.orders)) {
        throw new Error("Formato inválido");
      }
      if (!confirm("Esto reemplazará TODOS los datos actuales con los del respaldo. ¿Continuar?")) return;
      useStore.setState({
        products: data.products,
        clients: data.clients,
        orders: data.orders,
        orderCounter: data.orderCounter ?? data.orders.length ?? 0,
      });
      setMsg("Respaldo restaurado correctamente.");
    } catch (e) {
      setMsg("Error al importar: archivo .json inválido.");
    }
  };

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ];

  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-1">Configuración</h1>
      <p className="text-sm text-muted-foreground mb-4">Tema y respaldo de datos.</p>

      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Tema</Label>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.value;
              return (
                <Button
                  key={opt.value}
                  variant={active ? "default" : "outline"}
                  onClick={() => {
                    setTheme(opt.value);
                    applyTheme(opt.value);
                  }}
                  className="flex-col h-auto py-3 gap-1"
                >
                  <Icon className="size-5" />
                  <span className="text-xs">{opt.label}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-sm font-semibold">Respaldo de datos</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Genera o restaura un archivo <code>.json</code> con todos tus productos,
              clientes y pedidos.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={exportBackup} variant="default" disabled={exporting}>
              <Download /> {exporting ? "Generando…" : "Generar respaldo"}
            </Button>
            <Button onClick={() => fileRef.current?.click()} variant="outline">
              <Upload /> Importar respaldo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = "";
              }}
            />
          </div>
          {msg && (
            <div className="text-xs rounded-md bg-muted p-2 text-muted-foreground">{msg}</div>
          )}
        </CardContent>
      </Card>

    </AppShell>
  );
}
