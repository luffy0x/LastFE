import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Dossier } from "@/features/content/components/Dossier";
import { getContentRepository } from "@/features/content/repository";

export default async function ContentPage({ params }: PageProps<"/content/[id]">) {
  await connection();
  const { id } = await params;
  const record = await getContentRepository().get(id);
  if (!record || record.status === "withdrawn") notFound();

  return (
    <main id="main-content" className="dossier-page">
      <Dossier record={record} />
    </main>
  );
}
