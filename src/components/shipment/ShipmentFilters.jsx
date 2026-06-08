export function ShipmentFilters({ search, status, statuses, onSearchChange, onStatusChange, placeholder }) {
  return (
    <div className="shipment-filters">
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={placeholder}
      />
      <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
        <option value="\u0627\u0644\u0643\u0644">\u0627\u0644\u0643\u0644</option>
        {statuses.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}
