import { Link, useRouterState } from "@tanstack/react-router";
import { Boxes, Home, Package, Settings, Users } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useStore, applyTheme } from "@/lib/store";

const nav = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/pedidos", label: "Pedidos", icon: Boxes },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/configuracion", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="no-print sticky top-0 z-30 border-b bg-card/80 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-3xl px-4 pt-3 pb-2 flex items-center gap-3">
          <img
            src="/icon-192.png"
            alt="La Salsoa Foráneo"
            className="size-9 rounded-xl object-cover shadow-sm"
          />
          <div className="leading-tight flex-1">
            <div className="font-semibold">La Salsoa</div>
            <div className="text-xs text-muted-foreground">Ventas foráneo</div>
          </div>
        </div>
        <nav className="mx-auto max-w-3xl grid grid-cols-5 px-1">
          {nav.map((n) => {
            const active =
              n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors border-b-2 ${
                  active
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                <Icon className="size-5" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
