const inventoryBase = process.env.INVENTORY_SERVICE_URL ?? "";
const priceBase = process.env.PRICE_SERVICE_URL ?? "";

export async function fetchInventoryForProperty(propertyId: string): Promise<unknown[]> {
  if (!inventoryBase) return [];
  try {
    const res = await fetch(`${inventoryBase.replace(/\/$/, "")}/inventory?propertyId=${encodeURIComponent(propertyId)}`, {
      headers: { "bg-api-key": process.env.BG_API_Key ?? "" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: unknown[] };
    return Array.isArray(data.data) ? data.data : [];
  } catch {
    return [];
  }
}

export async function fetchPricesForProperty(propertyId: string): Promise<unknown[]> {
  if (!priceBase) return [];
  try {
    const res = await fetch(`${priceBase.replace(/\/$/, "")}/prices?propertyId=${encodeURIComponent(propertyId)}`, {
      headers: { "bg-api-key": process.env.BG_API_Key ?? "" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: unknown[] };
    return Array.isArray(data.data) ? data.data : [];
  } catch {
    return [];
  }
}
