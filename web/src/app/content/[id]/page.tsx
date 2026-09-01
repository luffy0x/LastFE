import { notFound } from "next/navigation";
import { Dossier } from "@/features/content/components/Dossier";
import { getContentRepository } from "@/features/content/repository";

export async function generateStaticParams() {
  const page = await getContentRepository().list({ page: 1, pageSize: 20 });
  return page.items.map(({ id }) => ({ id }));
}

export default async function ContentPage({ params }: PageProps<"/content/[id]">) {
  const { id } = await params;
  const record = await getContentRepository().get(id);
  if (!record || record.status === "withdrawn") notFound();

  return (
    <main id="main-content" className="dossier-page">
      <Dossier record={record} />
    </main>
  );
}
