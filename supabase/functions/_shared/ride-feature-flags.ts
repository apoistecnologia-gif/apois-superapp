import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function featureForCategory(category: unknown): {
  key: "feature_guincho_enabled" | "feature_fretes_enabled";
  error: "feature_guincho_unavailable" | "feature_fretes_unavailable";
} | null {
  const normalized = String(category ?? "").trim().toLowerCase();
  if (normalized === "guincho") {
    return { key: "feature_guincho_enabled", error: "feature_guincho_unavailable" };
  }
  if (normalized === "fretes") {
    return { key: "feature_fretes_enabled", error: "feature_fretes_unavailable" };
  }
  return null;
}

function enabled(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

export async function disabledRideFeatureError(
  admin: SupabaseClient,
  category: unknown,
): Promise<string | null> {
  const feature = featureForCategory(category);
  if (!feature) return null;

  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", feature.key)
    .maybeSingle();

  if (error || !enabled(data?.value)) return feature.error;
  return null;
}
