/**
 * Shared API types - aligned with OpenAPI and REST conventions.
 * Used across listings, users, and tenants services.
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface StandardApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/** ISO 19115-style geographic metadata (simplified) */
export interface GeographicMetadata {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
  formattedAddress?: string;
  crs?: string; // e.g. "EPSG:4326"
}

/** JSON-LD context for property (SEO / linked data) */
export const PROPERTY_JSON_LD_CONTEXT = "https://schema.org";
