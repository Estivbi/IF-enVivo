import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Aviso Legal — FOCOS",
  description:
    "Aviso legal, condiciones de uso y política de privacidad de FOCOS, herramienta de detección de incendios forestales.",
};

const YEAR = new Date().getFullYear();

export default function AvisoLegalPage() {
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
            <Link href="/sobre" className="hover:text-gray-200 transition">Sobre</Link>
            <Link href="/aviso-legal" className="text-orange-400">Aviso legal</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold text-white">Aviso Legal</h1>
        <p className="mb-10 text-sm text-gray-500">Última actualización: julio de {YEAR}</p>

        <div className="space-y-10 text-gray-300 leading-relaxed text-sm">

          {/* 1. Identificación */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">1. Identificación del titular</h2>
            <p>
              FOCOS es un proyecto personal de código abierto, publicado bajo licencia MIT,
              disponible en{" "}
              <a
                href="https://github.com/Estivbi/IF-enVivo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline"
              >
                github.com/Estivbi/IF-enVivo
              </a>
              . No constituye una empresa ni un servicio comercial.
            </p>
          </section>

          {/* 2. Objeto */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">2. Objeto y finalidad</h2>
            <p>
              FOCOS es una herramienta informativa que muestra en un mapa los hotspots
              (anomalías térmicas) detectados por el satélite VIIRS de NASA en el territorio
              español, obtenidos a través de la API pública de NASA FIRMS.
            </p>
            <p className="mt-3">
              La información se ofrece exclusivamente con fines de divulgación e información
              ciudadana. <strong className="text-white">No es un servicio de emergencias
              ni sustituye en ningún caso al 112 o a los servicios de Protección Civil.</strong>
            </p>
          </section>

          {/* 3. Limitación de responsabilidad */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">3. Limitación de responsabilidad</h2>
            <div className="rounded-lg border border-orange-900/50 bg-orange-950/30 p-4 text-orange-200">
              <p className="font-medium">⚠ Aviso importante</p>
              <p className="mt-2">
                Los datos mostrados tienen un retraso de entre 1 y 3 horas respecto al tiempo
                real y pueden contener errores, omisiones o falsos positivos debidos a las
                limitaciones técnicas de la detección satelital.
              </p>
            </div>
            <ul className="mt-4 space-y-2">
              {[
                "El titular no garantiza la exactitud, integridad, actualidad ni disponibilidad de la información mostrada.",
                "El titular no asume ninguna responsabilidad por decisiones tomadas en base a los datos de esta herramienta.",
                "Ante cualquier situación de emergencia, el usuario debe contactar inmediatamente con el 112.",
                "La disponibilidad del servicio no está garantizada. Pueden producirse interrupciones por mantenimiento o por la caída de fuentes de datos externas (NASA FIRMS, servicios de mapas).",
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-gray-500">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 4. Propiedad intelectual */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">4. Propiedad intelectual</h2>
            <p>
              El código fuente de FOCOS está publicado bajo licencia{" "}
              <a
                href="https://opensource.org/licenses/MIT"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline"
              >
                MIT
              </a>
              , lo que permite su uso, modificación y distribución con las condiciones establecidas
              en dicha licencia.
            </p>
            <p className="mt-3">
              Los datos de incendios provienen de NASA FIRMS, un servicio público del gobierno
              de los Estados Unidos. Las imágenes de mapa base son propiedad de CartoDB y Esri,
              sujetas a sus respectivas condiciones de uso.
            </p>
          </section>

          {/* 5. Privacidad */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">5. Privacidad y cookies</h2>
            <p>
              FOCOS <strong className="text-white">no recoge datos personales</strong> de los
              usuarios. No existe registro de usuarios, formularios de contacto ni sistemas
              de identificación.
            </p>
            <p className="mt-3">
              El servicio puede utilizar cookies técnicas propias de la plataforma de alojamiento
              (Vercel) para el correcto funcionamiento de la aplicación. No se utilizan cookies
              de seguimiento, publicidad ni analítica de terceros.
            </p>
            <p className="mt-3">
              Las consultas realizadas al servidor para obtener datos de incendios no contienen
              información de identificación personal.
            </p>
          </section>

          {/* 6. Fuentes de datos */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">6. Fuentes de datos y atribuciones</h2>
            <ul className="space-y-2">
              <li>
                <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline font-medium">
                  NASA FIRMS
                </a>{" "}
                — Datos de hotspots VIIRS. Uso gratuito sujeto a las{" "}
                <a href="https://firms.modaps.eosdis.nasa.gov/usfs/firms_data_use_agreement.pdf" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">
                  condiciones de la NASA
                </a>.
              </li>
              <li>
                <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline font-medium">
                  OpenStreetMap Nominatim
                </a>{" "}
                — Geocodificación. Datos © OpenStreetMap contributors, licencia ODbL.
              </li>
              <li>
                <a href="https://carto.com/basemaps/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline font-medium">
                  CartoDB Positron
                </a>{" "}
                — Mapa base. © CARTO, © OpenStreetMap contributors.
              </li>
              <li>
                <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline font-medium">
                  Esri World Imagery
                </a>{" "}
                — Vista satélite. © Esri, Maxar, Earthstar Geographics.
              </li>
            </ul>
          </section>

          {/* 7. Ley aplicable */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">7. Ley aplicable</h2>
            <p>
              Este aviso legal se rige por la legislación española. En caso de controversia,
              las partes se someten a los juzgados y tribunales competentes de España,
              conforme a la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la
              Información y de Comercio Electrónico (LSSI-CE).
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6 text-center text-xs text-gray-500">
        <p>
          <Link href="/" className="hover:text-gray-300 transition">← Volver al mapa</Link>
          {" · "}
          <Link href="/sobre" className="hover:text-gray-300 transition">Sobre FOCOS</Link>
        </p>
        <p className="mt-2">© {YEAR} FOCOS · MIT License</p>
      </footer>
    </div>
  );
}
