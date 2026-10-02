import PropertyForm from "@/components/admin/PropertyForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewPropertyPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("property_types").select("id,label").order("sort_order");
  return <PropertyForm propertyTypes={data || []}/>;
}
