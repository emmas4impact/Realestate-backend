import NodeGeocoder from "node-geocoder";

const options = {
  provider: "google" as const,
  httpAdapter: "https" as const,
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null,
};

const geocoder = NodeGeocoder(options);

export async function geocodeAddress(address: string): Promise<{
  type: "Point";
  coordinates: [number, number];
  formattedAddress?: string;
} | null> {
  if (!address?.trim()) return null;
  try {
    const result = await geocoder.geocode(address);
    if (!result?.length) return null;
    const [lon, lat] = [result[0].longitude ?? 0, result[0].latitude ?? 0];
    return {
      type: "Point",
      coordinates: [lon, lat],
      formattedAddress: result[0].formattedAddress,
    };
  } catch {
    return null;
  }
}
