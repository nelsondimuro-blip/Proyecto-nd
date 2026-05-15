import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grupo TN — Fintech del metro cuadrado",
  description:
    "Del terreno a la llave, pagá en TN TOUP. Cotización integral con IA, respaldada por la cadena TN.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="bg-tn text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-xl font-bold">
              Grupo TN
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/cotizar" className="hover:text-tn-accent">
                Cotizar
              </Link>
              <Link href="/propiedades" className="hover:text-tn-accent">
                Propiedades
              </Link>
              <Link href="/wallet" className="hover:text-tn-accent">
                Wallet TOUP
              </Link>
              <Link href="/admin" className="hover:text-tn-accent">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-slate-600">
            <p>
              <strong>TN TOUP</strong>: 1 TOUP = 1 rollo de cable Trefilcon 1×2,5 mm² × 100 m.
              Respaldado por stock real de TN Materiales.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
