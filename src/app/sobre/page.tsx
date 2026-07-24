import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Sobre FOCOS — Detección de incendios con datos NASA FIRMS",
  description:
    "Qué es FOCOS, cómo funciona la detección satelital de incendios con NASA FIRMS y VIIRS, y cuáles son sus limitaciones.",
};

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
            <Image src="/focosif-svg.svg" alt="" width={32} height={32} aria-hidden />
            <span className="text-lg font-semibold text-white">FOCOS</span>
          </Link>
          <nav className="flex gap-4 text-sm text-gray-400">
            <Link href="/sobre" className="text-orange-400">Sobre</Link>
            <Link href="/aviso-legal" className="hover:text-gray-200 transition">Aviso legal</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        {/* Hero */}
        <div className="mb-10 flex items-center gap-4">
          <Image src="/focosif-svg.svg" alt="Logo FOCOS" width={56} height={56} />
          <div>
            <h1 className="text-3xl font-bold text-white">¿Qué es FOCOS?</h1>
            <p className="mt-1 text-gray-400">Detección de incendios forestales en tiempo real</p>
          </div>
        </div>

        <div className="space-y-10 text-gray-300 leading-relaxed">

          {/* Qué es */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">El problema que resuelve</h2>
            <p>
              Durante un incendio forestal, saber si hay focos activos cerca —y dónde exactamente—
              es información crítica. Las fuentes oficiales (112, Protección Civil) son la referencia
              definitiva, pero sus comunicados tardan minutos u horas en publicarse.
            </p>
            <p className="mt-3">
              FOCOS no pretende reemplazar al 112. Pretende ser el primer lugar donde un ciudadano
              puede ver, en un mapa, si los satélites han detectado actividad térmica en una zona
              concreta de España en las últimas horas.
            </p>
          </section>

          {/* Cómo funciona */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Cómo funciona</h2>
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                <h3 className="mb-1 font-medium text-orange-300">1. Satélite NASA FIRMS + VIIRS</h3>
                <p className="text-sm">
                  El satélite Suomi NPP de NASA orbita la Tierra cada ~100 minutos y toma
                  imágenes infrarrojas. El sensor VIIRS detecta anomalías térmicas (hotspots)
                  con una resolución de 375 metros por píxel — suficiente para identificar un
                  incendio forestal activo.
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                <h3 className="mb-1 font-medium text-orange-300">2. NASA FIRMS API</h3>
                <p className="text-sm">
                  La NASA publica esos hotspots en abierto a través de{" "}
                  <a
                    href="https://firms.modaps.eosdis.nasa.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:underline"
                  >
                    FIRMS (Fire Information for Resource Management System)
                  </a>
                  . FOCOS consulta esta API cada hora y guarda los datos en España.
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                <h3 className="mb-1 font-medium text-orange-300">3. Agrupación en eventos</h3>
                <p className="text-sm">
                  Los hotspots individuales (puntos de satélite) se agrupan por proximidad
                  geográfica para formar &ldquo;eventos de incendio&rdquo;. Un evento puede tener docenas
                  de hotspots si el fuego es grande. Esta agrupación es automática y puede
                  cometer errores: incendios muy cercanos pueden aparecer como uno, o uno grande
                  puede verse como varios.
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
                <h3 className="mb-1 font-medium text-orange-300">4. Geolocalización</h3>
                <p className="text-sm">
                  Las coordenadas del satélite se transforman en nombres de municipio y provincia
                  usando OpenStreetMap Nominatim. Es una aproximación: el centro del incendio
                  puede estar entre varios municipios.
                </p>
              </div>
            </div>
          </section>

          {/* Limitaciones */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Limitaciones importantes</h2>
            <ul className="space-y-2 text-sm">
              {[
                "Retraso de 1 a 3 horas respecto al momento real del incendio — el satélite tarda en pasar y la NASA en publicar los datos.",
                "Las nubes bloquean la visión del satélite. Un incendio cubierto de nubes puede no aparecer.",
                "Un campo recién quemado (brasa, no llama) puede aparecer como hotspot aunque no haya fuego activo.",
                "Un incendio muy pequeño o muy nuevo puede no ser detectado si ocurrió entre dos pasadas del satélite.",
                "Los nombres de municipio y provincia son aproximaciones automáticas, no verificadas por humanos.",
                "La clasificación activo/inactivo se basa en si ha habido hotspots nuevos en las últimas 24h, no en el estado real del incendio.",
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-orange-500">⚠</span>
                  <span className="text-gray-300">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Fuentes */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Fuentes de datos</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">
                  NASA FIRMS — Fire Information for Resource Management System
                </a>
              </li>
              <li>
                <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">
                  OpenStreetMap Nominatim — geocodificación inversa
                </a>
              </li>
              <li>
                <a href="https://basemaps.cartocdn.com/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">
                  CartoDB Basemaps — mapa de fondo (Positron)
                </a>
              </li>
              <li>
                <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">
                  Esri World Imagery — vista satélite
                </a>
              </li>
            </ul>
          </section>

          {/* Código */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Código abierto</h2>
            <p className="text-sm">
              FOCOS es un proyecto de código abierto. Puedes ver el código, reportar errores
              o contribuir en{" "}
              <a
                href="https://github.com/Estivbi/IF-enVivo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline"
              >
                github.com/Estivbi/IF-enVivo
              </a>
              .
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6 text-center text-xs text-gray-500">
        <p>
          <Link href="/" className="hover:text-gray-300 transition">← Volver al mapa</Link>
          {" · "}
          <Link href="/aviso-legal" className="hover:text-gray-300 transition">Aviso legal</Link>
        </p>
        <p className="mt-2">
          Datos NASA FIRMS · OpenStreetMap · FOCOS no es un servicio de emergencias
        </p>
      </footer>
    </div>
  );
}
