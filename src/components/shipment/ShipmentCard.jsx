import { formatAmount } from "../../utils/formatters";

export function ShipmentCard({ shipment, showSender = true, showRep = true }) {
  return (
    <article className="shipment-card">
      <header>
        <div>
          <h3>{shipment.customerName}</h3>
          <p dir="ltr">{shipment.phone}</p>
        </div>
        <span>{shipment.status}</span>
      </header>

      <dl>
        <Info label="\u0643\u0648\u062f \u0627\u0644\u0634\u062d\u0646\u0629" value={shipment.code} />
        {showSender && <Info label="\u0627\u0644\u0631\u0627\u0633\u0644" value={shipment.sender} />}
        {showRep && <Info label="\u0627\u0644\u0645\u0646\u062f\u0648\u0628" value={shipment.rep} />}
        <Info label="\u0627\u0644\u0645\u0628\u0644\u063a" value={formatAmount(shipment.amount)} />
        <Info label="\u0627\u0644\u062a\u0627\u0631\u064a\u062e" value={shipment.date || "-"} />
      </dl>

      {shipment.address && <p>{shipment.address}</p>}
      {shipment.notes && <p>{shipment.notes}</p>}
    </article>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
}
