import { useEffect, useMemo, useState } from "react";
import { ShipmentFilters } from "../../components/shipment/ShipmentFilters";
import { ShipmentList } from "../../components/shipment/ShipmentList";
import { ShipmentStats } from "../../components/shipment/ShipmentStats";
import { useAuth } from "../../context/AuthContext";
import { fetchShipmentsBySender } from "../../services/shipmentsService";
import { useSupabase } from "../../services/supabaseClient";
import { mapShipment } from "../../utils/shipmentMappers";

export function SenderPage() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [search, setSearch] = useState(localStorage.getItem("sender_search") || "");
  const [status, setStatus] = useState(localStorage.getItem("sender_status") || "\u0627\u0644\u0643\u0644");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem("sender_search", search);
  }, [search]);

  useEffect(() => {
    localStorage.setItem("sender_status", status);
  }, [status]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const rows = await fetchShipmentsBySender(supabase, user?.username || "");
        if (isMounted) setShipments(rows.map(mapShipment));
      } catch (currentError) {
        if (isMounted) setError(currentError.message || "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0634\u062d\u0646\u0627\u062a");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [supabase, user?.username]);

  const statuses = useMemo(
    () => Array.from(new Set(shipments.map((shipment) => shipment.status).filter(Boolean))).sort(),
    [shipments],
  );

  const filteredShipments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return shipments.filter((shipment) => {
      const matchesStatus = status === "\u0627\u0644\u0643\u0644" || shipment.status === status;
      const matchesSearch =
        !term ||
        [shipment.code, shipment.customerName, shipment.phone, shipment.alternatePhone, shipment.address, shipment.rep]
          .some((value) => String(value || "").toLowerCase().includes(term));

      return matchesStatus && matchesSearch;
    });
  }, [shipments, search, status]);

  return (
    <main className="page page--sender" dir="rtl">
      <h1>\u0644\u0648\u062d\u0629 \u0627\u0644\u0631\u0627\u0633\u0644</h1>
      <ShipmentStats shipments={shipments} showAmount />
      <ShipmentFilters
        search={search}
        status={status}
        statuses={statuses}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        placeholder="\u0628\u062d\u062b \u0628\u0643\u0648\u062f \u0627\u0644\u0634\u062d\u0646\u0629 \u0623\u0648 \u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064a\u0644 \u0623\u0648 \u0627\u0644\u0647\u0627\u062a\u0641..."
      />
      {error && <div className="error-state">{error}</div>}
      {isLoading ? (
        <div className="loading-state">\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0634\u062d\u0646\u0627\u062a...</div>
      ) : (
        <ShipmentList shipments={filteredShipments} emptyText="\u0644\u0627 \u062a\u0648\u062c\u062f \u0634\u062d\u0646\u0627\u062a \u0645\u0637\u0627\u0628\u0642\u0629" showSender={false} showRep />
      )}
    </main>
  );
}
