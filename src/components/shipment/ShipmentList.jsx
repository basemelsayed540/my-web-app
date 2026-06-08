import { ShipmentCard } from "./ShipmentCard";

export function ShipmentList({ shipments, emptyText, showSender, showRep }) {
  if (!shipments.length) {
    return <div className="empty-state">{emptyText}</div>;
  }

  return (
    <div className="shipment-list">
      {shipments.map((shipment) => (
        <ShipmentCard
          key={shipment.code || shipment.id}
          shipment={shipment}
          showSender={showSender}
          showRep={showRep}
        />
      ))}
    </div>
  );
}
