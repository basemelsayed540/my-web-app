import { isStatusInGroup } from "../../constants/shipmentStatuses";
import { formatAmount } from "../../utils/formatters";

export function ShipmentStats({ shipments, showAmount = false, resultCount }) {
  const delivered = shipments.filter((shipment) => isStatusInGroup(shipment.status, "delivered")).length;
  const shipping = shipments.filter((shipment) => isStatusInGroup(shipment.status, "shipping")).length;
  const cancelled = shipments.filter((shipment) => isStatusInGroup(shipment.status, "cancelled")).length;
  const amount = shipments.reduce((total, shipment) => total + shipment.amount, 0);

  return (
    <div className="shipment-stats">
      <StatCard label={resultCount == null ? "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0634\u062d\u0646\u0627\u062a" : "\u0646\u062a\u0627\u0626\u062c \u0627\u0644\u0628\u062d\u062b"} value={resultCount ?? shipments.length} />
      <StatCard label="\u062a\u0645 \u0627\u0644\u062a\u0633\u0644\u064a\u0645" value={delivered} tone="success" />
      <StatCard label="\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646" value={shipping} tone="info" />
      <StatCard label="\u0625\u0644\u063a\u0627\u0621" value={cancelled} tone="danger" />
      {showAmount && <StatCard label="\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0628\u0627\u0644\u063a" value={formatAmount(amount)} tone="warning" />}
    </div>
  );
}

function StatCard({ label, value, tone = "default" }) {
  return (
    <section className={`stat-card stat-card--${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </section>
  );
}
