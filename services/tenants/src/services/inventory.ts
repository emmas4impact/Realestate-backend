import { logger } from "@realestate/shared";

const inventoryBase = process.env.INVENTORY_SERVICE_URL ?? "";

interface InventoryItem {
  id?: string;
  availableQuantity?: number;
  available_quantity?: number;
}

export type InventoryMutationResult =
  | { ok: true }
  | { ok: false; status: 409 | 503; message: string };

async function findInventoryForProperty(propertyId: string, requireAvailable: boolean): Promise<InventoryItem | InventoryMutationResult> {
  if (!inventoryBase) {
    return { ok: false, status: 503, message: "Inventory service URL is not configured" };
  }

  const baseUrl = inventoryBase.replace(/\/$/, "");
  const listRes = await fetch(`${baseUrl}/inventories?propertyId=${encodeURIComponent(propertyId)}`, {
    headers: { "bg-api-key": process.env.BG_API_Key ?? "" },
  });

  if (!listRes.ok) {
    logger.warn("Inventory lookup failed", {
      service: "tenants",
      dependency: "inventory",
      status: listRes.status,
      propertyId,
    });
    if (listRes.status === 401 || listRes.status === 403) {
      return { ok: false, status: 503, message: "Inventory service API key is not configured correctly" };
    }
    return { ok: false, status: 503, message: "Inventory service is unavailable" };
  }

  const body = (await listRes.json()) as { data?: InventoryItem[] };
  const item = body.data?.find((entry) => {
    if (!entry.id) {
      return false;
    }
    if (requireAvailable) {
      const available = entry.availableQuantity ?? entry.available_quantity ?? 0;
      return available > 0;
    }
    return true;
  });

  if (!item?.id) {
    return {
      ok: false,
      status: 409,
      message: requireAvailable ? "No available inventory for this listing" : "No inventory found for this listing",
    };
  }

  return item;
}

async function mutateInventoryForProperty(propertyId: string, action: "decrement" | "increment"): Promise<InventoryMutationResult> {
  try {
    const item = await findInventoryForProperty(propertyId, action === "decrement");
    if ("ok" in item) {
      return item;
    }
    const inventoryId = item.id;
    if (!inventoryId) {
      return { ok: false, status: 409, message: "No inventory found for this listing" };
    }
    const baseUrl = inventoryBase.replace(/\/$/, "");
    const endpoint = action === "decrement" ? "decrement-available" : "increment-available";
    const inventoryRes = await fetch(`${baseUrl}/inventories/${encodeURIComponent(inventoryId)}/${endpoint}`, {
      method: "PATCH",
      headers: {
        "bg-api-key": process.env.BG_API_Key ?? "",
        "content-type": "application/json",
      },
      body: JSON.stringify({ amount: 1 }),
    });

    if (!inventoryRes.ok) {
      logger.warn(`Inventory ${action} failed`, {
        service: "tenants",
        dependency: "inventory",
        status: inventoryRes.status,
        propertyId,
        inventoryId,
      });
      if (inventoryRes.status === 401 || inventoryRes.status === 403) {
        return { ok: false, status: 503, message: "Inventory service API key is not configured correctly" };
      }
      return { ok: false, status: 503, message: `Unable to ${action} inventory` };
    }

    return { ok: true };
  } catch (error) {
    logger.warn("Inventory service request failed", {
      service: "tenants",
      dependency: "inventory",
      propertyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, status: 503, message: "Inventory service is unavailable" };
  }
}

export async function consumeInventoryForProperty(propertyId: string): Promise<InventoryMutationResult> {
  return mutateInventoryForProperty(propertyId, "decrement");
}

export async function releaseInventoryForProperty(propertyId: string): Promise<InventoryMutationResult> {
  return mutateInventoryForProperty(propertyId, "increment");
}
