/**
 * Fetch property (for availability) and price by listing type from property/price services.
 * Listings can only be created for available properties; price is taken from price service by type (rent | sales).
 */

const propertyBase = process.env.PROPERTY_SERVICE_URL ?? "";
const priceBase = process.env.PRICE_SERVICE_URL ?? "";

export interface PropertyResponse {
  id: string;
  availability?: boolean;
  [key: string]: unknown;
}

export async function fetchProperty(propertyId: string): Promise<PropertyResponse | null> {
  if (!propertyBase) return null;
  try {
    const res = await fetch(`${propertyBase.replace(/\/$/, "")}/properties/${encodeURIComponent(propertyId)}`, {
      headers: { "bg-api-key": process.env.BG_API_Key ?? "" },
    });
    if (!res.ok) return null;
    return (await res.json()) as PropertyResponse;
  } catch {
    return null;
  }
}

/** Map listing type "sales" to price type "sale"; "rent" stays "rent". */
function priceTypeForListingType(listingType: string): string {
  return listingType === "sales" ? "sale" : listingType;
}

export async function fetchPriceAmountForType(propertyId: string, listingType: string): Promise<number | null> {
  if (!priceBase) return null;
  try {
    const res = await fetch(
      `${priceBase.replace(/\/$/, "")}/prices?propertyId=${encodeURIComponent(propertyId)}`,
      { headers: { "bg-api-key": process.env.BG_API_Key ?? "" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { type?: string; amount?: number }[] };
    const list = Array.isArray(data?.data) ? data.data : [];
    const targetType = priceTypeForListingType(listingType);
    const match = list.find((p) => (p.type ?? "").toLowerCase() === targetType.toLowerCase());
    return match != null && typeof match.amount === "number" ? match.amount : null;
  } catch {
    return null;
  }
}
