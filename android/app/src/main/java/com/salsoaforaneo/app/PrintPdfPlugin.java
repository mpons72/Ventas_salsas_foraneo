package com.salsoaforaneo.app;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Imprime un PDF ya generado (recibido en base64 desde JS/jsPDF) usando el
 * sistema de impresión nativo de Android (PrintManager).
 *
 * Por qué existe este plugin: window.print() no está implementado dentro del
 * WebView que usa Capacitor, así que sin esto el botón "Imprimir" no hace
 * nada en la app empacada (aunque funcione bien en el navegador de escritorio).
 */
@CapacitorPlugin(name = "PrintPdf")
public class PrintPdfPlugin extends Plugin {

    @PluginMethod
    public void print(PluginCall call) {
        String base64 = call.getString("base64");
        String jobName = call.getString("jobName", "Documento");

        if (base64 == null || base64.isEmpty()) {
            call.reject("Falta el contenido base64 del PDF");
            return;
        }

        try {
            byte[] pdfBytes = Base64.decode(base64, Base64.DEFAULT);

            File tempFile = File.createTempFile("print_", ".pdf", getContext().getCacheDir());
            try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                fos.write(pdfBytes);
            }

            Context context = getContext();
            PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
            if (printManager == null) {
                call.reject("El servicio de impresión no está disponible en este dispositivo");
                return;
            }

            printManager.print(jobName, new PdfDocumentAdapter(tempFile), new PrintAttributes.Builder().build());

            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (IOException e) {
            call.reject("Error al preparar el PDF para imprimir: " + e.getMessage(), e);
        } catch (Exception e) {
            call.reject("Error al imprimir: " + e.getMessage(), e);
        }
    }

    /** Adapter mínimo que solo transmite bytes de un PDF ya construido al sistema de impresión. */
    private static class PdfDocumentAdapter extends PrintDocumentAdapter {
        private final File pdfFile;

        PdfDocumentAdapter(File pdfFile) {
            this.pdfFile = pdfFile;
        }

        @Override
        public void onLayout(
                PrintAttributes oldAttributes,
                PrintAttributes newAttributes,
                CancellationSignal cancellationSignal,
                LayoutResultCallback callback,
                Bundle extras
        ) {
            if (cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }
            PrintDocumentInfo info = new PrintDocumentInfo.Builder(pdfFile.getName())
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                    .build();
            callback.onLayoutFinished(info, true);
        }

        @Override
        public void onWrite(
                PageRange[] pages,
                ParcelFileDescriptor destination,
                CancellationSignal cancellationSignal,
                WriteResultCallback callback
        ) {
            try (InputStream in = new FileInputStream(pdfFile);
                 OutputStream out = new FileOutputStream(destination.getFileDescriptor())) {
                byte[] buf = new byte[8192];
                int bytesRead;
                while ((bytesRead = in.read(buf)) >= 0) {
                    if (cancellationSignal.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    out.write(buf, 0, bytesRead);
                }
                callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
            } catch (IOException e) {
                callback.onWriteFailed(e.getMessage());
            }
        }

        @Override
        public void onFinish() {
            super.onFinish();
            // Limpiar el temporal una vez que el sistema de impresión terminó de leerlo.
            //noinspection ResultOfMethodCallIgnored
            pdfFile.delete();
        }
    }
}
