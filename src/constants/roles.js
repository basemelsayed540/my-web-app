import { APP_ROUTES } from "./routes";

export const ROLES = {
  admin: "admin",
  rep: "rep",
  queries: "queries",
  inquiry: "inquiry",
  inquiryArabic: "\u0627\u0633\u062a\u0639\u0644\u0627\u0645\u0627\u062a",
  sender: "sender",
  merchant: "merchant",
  senderArabic: "\u0631\u0627\u0633\u0644",
};

export function getDefaultRouteForRole(role) {
  if (role === ROLES.admin) return APP_ROUTES.admin;
  if ([ROLES.queries, ROLES.inquiry, ROLES.inquiryArabic].includes(role)) return APP_ROUTES.queries;
  if ([ROLES.sender, ROLES.merchant, ROLES.senderArabic].includes(role)) return APP_ROUTES.sender;
  return APP_ROUTES.rep;
}
