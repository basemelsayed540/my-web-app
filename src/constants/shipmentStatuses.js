export const SHIPMENT_STATUS_GROUPS = {
  delivered: ["\u062a\u0645 \u0627\u0644\u062a\u0633\u0644\u064a\u0645", "\u062a\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644", "\u062a\u0645"],
  shipping: ["\u0634\u062d\u0646", "\u0642\u064a\u062f \u0627\u0644\u062a\u0648\u0635\u064a\u0644"],
  cancelled: ["\u0625\u0644\u063a\u0627\u0621", "\u0627\u0644\u063a\u0627\u0621", "\u0645\u0644\u063a\u064a"],
};

export function isStatusInGroup(status, group) {
  return SHIPMENT_STATUS_GROUPS[group]?.includes(status) ?? false;
}
