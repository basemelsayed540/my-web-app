window.RepsShipmentUtils = (() => {
    function normalizeRecord(record) {
        return normalizeShipmentRecordHeaders(record);
    }

    function toServerPayload(payload) {
        return buildShipmentServerPayload(payload);
    }

    return {
        normalizeRecord,
        toServerPayload,
    };
})();
