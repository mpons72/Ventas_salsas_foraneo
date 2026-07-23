import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Product = {
  id: string;
  name: string;
  unitPrice: number;       // precio por pieza
  piecesPerBox: number;    // piezas por caja por defecto
};

export type Client = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type BoxItem = {
  productId: string;
  pieces: number;
  /**
   * Precio por pieza congelado al momento de agregar el producto al pedido.
   * Los cambios posteriores al catálogo NO afectan pedidos existentes.
   */
  unitPrice?: number;
};


export type Box = {
  id: string;
  items: BoxItem[];
};

export type ExtraCharge = {
  id: string;
  date: string;          // ISO
  concept: string;       // ej "Paquetería"
  amount: number;        // positivo = cargo
};

export type Payment = {
  id: string;
  date: string;          // ISO
  amount: number;        // positivo = abono
  method?: string;
  note?: string;
};

export type Order = {
  id: string;
  number: number;            // consecutivo
  name?: string;             // nombre opcional del pedido
  clientId: string;
  createdAt: string;         // ISO
  shipDate?: string;         // ISO
  status: "abierto" | "enviado" | "pagado" | "cancelado";
  boxes: Box[];
  extras: ExtraCharge[];
  payments: Payment[];
  notes?: string;
  /**
   * Precios congelados a NIVEL DE PEDIDO.
   * productId -> precio unitario capturado la PRIMERA vez que ese producto
   * se agrega al pedido (en cualquier caja). Nunca se sobreescribe mientras
   * el pedido exista, aunque las piezas bajen a 0 y se vuelvan a agregar,
   * aunque cambien las cajas, o aunque cambie el precio del catálogo.
   */
  priceSnapshot: Record<string, number>;
};

export type Theme = "light" | "dark" | "system";

type State = {
  products: Product[];
  clients: Client[];
  orders: Order[];
  orderCounter: number;
  theme: Theme;

  setTheme: (t: Theme) => void;

  upsertProduct: (p: Product) => void;
  removeProduct: (id: string) => void;

  upsertClient: (c: Client) => void;
  removeClient: (id: string) => void;

  createOrder: (clientId: string) => Order;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  setOrderNumber: (id: string, number: number) => void;
  removeOrder: (id: string) => void;

  addBox: (orderId: string) => void;
  removeBox: (orderId: string, boxId: string) => void;
  setBoxItem: (orderId: string, boxId: string, productId: string, pieces: number) => void;

  addPayment: (orderId: string, p: Omit<Payment, "id">) => void;
  removePayment: (orderId: string, id: string) => void;

  addExtra: (orderId: string, e: Omit<ExtraCharge, "id">) => void;
  removeExtra: (orderId: string, id: string) => void;

  resetAll: () => void;
};

const uid = () =>
  (globalThis.crypto?.randomUUID?.() as string) ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

const SEED_PRODUCTS: Product[] = [
  { id: uid(), name: "Taquera", unitPrice: 0, piecesPerBox: 60 },
  { id: uid(), name: "Árbol", unitPrice: 0, piecesPerBox: 60 },
  { id: uid(), name: "Jalapeño", unitPrice: 0, piecesPerBox: 60 },
  { id: uid(), name: "Árbol Quemado", unitPrice: 0, piecesPerBox: 60 },
  { id: uid(), name: "Matona", unitPrice: 0, piecesPerBox: 60 },
  { id: uid(), name: "Chipotle", unitPrice: 0, piecesPerBox: 60 },
];

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      products: SEED_PRODUCTS,
      clients: [],
      orders: [],
      orderCounter: 0,
      theme: "system",

      setTheme: (t) => set({ theme: t }),

      upsertProduct: (p) =>
        set((s) => {
          const i = s.products.findIndex((x) => x.id === p.id);
          const products = [...s.products];
          if (i >= 0) products[i] = p;
          else products.push(p);
          return { products };
        }),
      removeProduct: (id) =>
        set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      upsertClient: (c) =>
        set((s) => {
          const i = s.clients.findIndex((x) => x.id === c.id);
          const clients = [...s.clients];
          if (i >= 0) clients[i] = c;
          else clients.push(c);
          return { clients };
        }),
      removeClient: (id) =>
        set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),

      createOrder: (clientId) => {
        const number = get().orderCounter + 1;
        const order: Order = {
          id: uid(),
          number,
          clientId,
          createdAt: new Date().toISOString(),
          status: "abierto",
          boxes: [{ id: uid(), items: [] }],
          extras: [],
          payments: [],
          priceSnapshot: {},
        };
        set((s) => ({ orders: [order, ...s.orders], orderCounter: number }));
        return order;
      },
      updateOrder: (id, patch) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        })),
      // Permite renumerar un pedido manualmente (ej. para llenar el hueco que
      // deja un pedido borrado). Si el nuevo número es mayor al consecutivo
      // actual, se sube el consecutivo para que los pedidos nuevos sigan
      // generándose sin chocar con éste.
      setOrderNumber: (id, number) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, number } : o)),
          orderCounter: Math.max(s.orderCounter, number),
        })),
      removeOrder: (id) =>
        set((s) => ({ orders: s.orders.filter((o) => o.id !== id) })),

      addBox: (orderId) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, boxes: [...o.boxes, { id: uid(), items: [] }] }
              : o
          ),
        })),
      removeBox: (orderId, boxId) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, boxes: o.boxes.filter((b) => b.id !== boxId) }
              : o
          ),
        })),
      setBoxItem: (orderId, boxId, productId, pieces) =>
        set((s) => {
          const product = s.products.find((p) => p.id === productId);
          const currentPrice = product?.unitPrice ?? 0;
          return {
            orders: s.orders.map((o) => {
              if (o.id !== orderId) return o;
              // Congela el precio a NIVEL DE PEDIDO la primera vez que este
              // producto aparece en cualquier caja del pedido. Nunca se
              // vuelve a tocar mientras el pedido exista.
              const snap = o.priceSnapshot ?? {};
              const nextSnap =
                pieces > 0 && !(productId in snap)
                  ? { ...snap, [productId]: currentPrice }
                  : snap;
              return {
                ...o,
                priceSnapshot: nextSnap,
                boxes: o.boxes.map((b) => {
                  if (b.id !== boxId) return b;
                  const items = b.items.filter((i) => i.productId !== productId);
                  if (pieces > 0) items.push({ productId, pieces });
                  return { ...b, items };
                }),
              };
            }),
          };
        }),


      addPayment: (orderId, p) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, payments: [...o.payments, { id: uid(), ...p }] }
              : o
          ),
        })),
      removePayment: (orderId, id) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, payments: o.payments.filter((p) => p.id !== id) }
              : o
          ),
        })),

      addExtra: (orderId, e) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, extras: [...o.extras, { id: uid(), ...e }] }
              : o
          ),
        })),
      removeExtra: (orderId, id) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, extras: o.extras.filter((x) => x.id !== id) }
              : o
          ),
        })),

      resetAll: () =>
        set({ products: SEED_PRODUCTS, clients: [], orders: [], orderCounter: 0 }),
    }),
    {
      name: "don-manuel-ventas-v1",
      onRehydrateStorage: () => (state) => {
        // Migración única: para pedidos creados antes del snapshot a nivel
        // de pedido, sembramos priceSnapshot con el precio congelado que
        // hubiera quedado en cada ítem, y si tampoco existe, usamos el
        // precio actual del catálogo como último recurso. A partir de aquí,
        // ese precio queda fijo para siempre en el pedido.
        if (!state) return;
        const pmap = new Map(state.products.map((p) => [p.id, p]));
        state.orders = state.orders.map((o) => {
          const snap: Record<string, number> = { ...(o.priceSnapshot ?? {}) };
          for (const b of o.boxes) {
            for (const it of b.items) {
              if (!(it.productId in snap)) {
                snap[it.productId] =
                  (it as { unitPrice?: number }).unitPrice ??
                  pmap.get(it.productId)?.unitPrice ??
                  0;
              }
            }
          }
          return { ...o, priceSnapshot: snap };
        });
      },
    }
  )
);

// ===== Helpers de cálculo =====
export function orderTotals(order: Order, products: Product[]) {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const snap = order.priceSnapshot ?? {};
  let totalPieces = 0;
  let subtotal = 0;
  for (const box of order.boxes) {
    for (const it of box.items) {
      totalPieces += it.pieces;
      // El precio SIEMPRE sale del snapshot del pedido. Solo si no existe
      // (pedidos legacy que aún no se han migrado en esta sesión) cae al
      // precio congelado por ítem, y como último recurso al catálogo.
      const unit =
        snap[it.productId] ??
        (it as { unitPrice?: number }).unitPrice ??
        productMap.get(it.productId)?.unitPrice ??
        0;
      subtotal += it.pieces * unit;
    }
  }

  const extras = order.extras.reduce((s, e) => s + e.amount, 0);
  const paid = order.payments.reduce((s, p) => s + p.amount, 0);
  const total = subtotal + extras;
  const balance = total - paid;
  return {
    totalBoxes: order.boxes.length,
    totalPieces,
    subtotal,
    extras,
    total,
    paid,
    balance,
  };
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n || 0);
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}
