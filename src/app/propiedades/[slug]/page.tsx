import PropertyDetailClient from "@/components/PropertyDetailClient";
export default async function PropertyDetailPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PropertyDetailClient slug={slug}/>; }
