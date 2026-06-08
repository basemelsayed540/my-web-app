import { SHIPMENT_FIELDS } from "../constants/shipmentFields";

export function getShipmentValue(row, key, fallback = "") {
  return row?.[SHIPMENT_FIELDS[key]] ?? fallback;
}

export function mapShipment(row) {
  return {
    id: row.id,
    code: getShipmentValue(row, "code", row.id),
    customerName: getShipmentValue(row, "customerName", "\u0628\u062f\u0648\u0646 \u0627\u0633\u0645"),
    phone: getShipmentValue(row, "phone"),
    alternatePhone: getShipmentValue(row, "alternatePhone"),
    address: getShipmentValue(row, "address"),
    sender: getShipmentValue(row, "sender"),
    rep: getShipmentValue(row, "rep"),
    status: getShipmentValue(row, "status", "\u063a\u064a\u0631 \u0645\u062d\u062f\u062f"),
    amount: Number(getShipmentValue(row, "amount", 0)) || 0,
    notes: getShipmentValue(row, "notes"),
    date: getShipmentValue(row, "date", getShipmentValue(row, "updatedAt")),
    raw: row,
  };
}
