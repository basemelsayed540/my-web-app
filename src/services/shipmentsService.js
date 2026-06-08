import { SHIPMENT_FIELDS } from "../constants/shipmentFields";

const SHIPMENTS_TABLE = "abdo";

export async function fetchShipments(supabase, { limit = 500 } = {}) {
  const { data, error } = await supabase.from(SHIPMENTS_TABLE).select("*").limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchShipmentsBySender(supabase, sender, { limit = 500 } = {}) {
  const { data, error } = await supabase
    .from(SHIPMENTS_TABLE)
    .select("*")
    .eq(SHIPMENT_FIELDS.sender, sender)
    .limit(limit);

  if (error) throw error;
  return data || [];
}
