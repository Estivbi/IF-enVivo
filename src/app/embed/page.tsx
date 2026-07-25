import type { Metadata } from "next";
import { EmbedMap } from "@/components/embed-map";

export const metadata: Metadata = {
  title: "FOCOS — Mapa de incendios en España",
  robots: { index: false, follow: false },
};

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <EmbedMap fireId={id} />;
}
