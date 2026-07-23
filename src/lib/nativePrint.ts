import { registerPlugin } from "@capacitor/core";
import { isNative } from "./nativeIO";

export interface PrintPdfPlugin {
  print(options: { base64: string; jobName?: string }): Promise<{ started: boolean }>;
}

const PrintPdf = registerPlugin<PrintPdfPlugin>("PrintPdf");

/**
 * Imprime un PDF ya generado (en base64).
 * En Android: abre el diálogo nativo de impresión (permite elegir impresora,
 * guardar como PDF, etc). window.print() NO funciona dentro de un WebView de
 * Capacitor, por eso este plugin nativo es necesario.
 * En web: no hay plugin nativo disponible, así que se debe usar window.print()
 * como fallback (el llamador decide eso).
 */
export async function printPdfBase64(base64: string, jobName: string): Promise<boolean> {
  if (!isNative()) return false;
  await PrintPdf.print({ base64, jobName });
  return true;
}
