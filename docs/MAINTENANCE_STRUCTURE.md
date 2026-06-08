# Maintenance Structure

This folder documents the recommended source layout for the shipment app.
The current repository contains a built static app only, so the compiled files
in `assets/` should stay untouched unless a fresh build replaces them.

## Target Layout

```text
src/
  app/
    App.jsx
    routes.jsx
    providers.jsx
  components/
    layout/
    shipment/
    ui/
  constants/
    roles.js
    routes.js
    shipmentFields.js
    shipmentStatuses.js
  context/
    AuthContext.jsx
    ThemeContext.jsx
  features/
    admin/
    queries/
    rep/
    sender/
  services/
    supabaseClient.js
    shipmentsService.js
    usersService.js
  utils/
    formatters.js
    shipmentMappers.js
```

## Smart Split

- `features/` owns page-level behavior for each role.
- `components/` owns reusable visual pieces, not business rules.
- `services/` is the only place that talks to Supabase.
- `constants/` keeps Arabic database field names and role names in one place.
- `utils/` converts raw database rows into predictable app data.
- `context/` keeps shared session and theme state.

## Database Field Mapping

Avoid repeating Arabic column names directly across pages.

```js
export const SHIPMENT_FIELDS = {
  code: "كود الشحنة",
  customerName: "اسم العميل",
  phone: "الهاتف",
  alternatePhone: "هاتف بديل",
  address: "العنوان",
  sender: "الراسل",
  rep: "المندوب",
  status: "الحالة",
  amount: "المبلغ",
  notes: "ملاحظات",
  date: "التاريخ",
  updatedAt: "تاريخ التحديث",
};
```

Then pages should read data through helpers:

```js
const code = getShipmentValue(row, "code");
const status = getShipmentValue(row, "status");
```

## Reusable Shipment Pieces

The `queries` and `sender` pages share most of their UI. Prefer extracting:

- `ShipmentStats`
- `ShipmentSearchFilters`
- `ShipmentCard`
- `ShipmentList`
- `StatusBadge`
- `AmountText`

The page should only decide what data to load and which columns are visible.

## Refactor Order

1. Restore or add the original React source project.
2. Move Supabase setup into `services/supabaseClient.js`.
3. Move role and route logic into `constants/roles.js` and `app/routes.jsx`.
4. Extract shipment field names and mappers.
5. Extract shared shipment list components.
6. Split pages by role under `features/`.
7. Rebuild and replace only the generated `assets/` files.

