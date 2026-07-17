// Bridges the backend's relational shape (Customer -> many Locations) to the
// flat row shape the UI (search, filters, dashboard, map, route planning)
// works with.
//
// One row per location (a customer with 2 locations = 2 rows, matching how
// the same company appearing at two different events already produced two
// separate rows before the backend migration). A customer with zero
// locations still produces one row with a blank city, so nothing is
// silently dropped from exports - the display layer separately filters
// those out since they have no coordinates to plot.
export function expandCustomerToRows(customer) {
  const base = {
    customerId: customer.id,
    company: customer.companyName,
    person: customer.contactPerson || "",
    designation: customer.designation || "",
    email: customer.email || "",
    phone: customer.phone || "",
    application: customer.applicationNotes || "",
    industryId: customer.industryId || "",
    industryName: customer.industry?.name || "",
    isManual: !customer.importTag,
  };

  if (!customer.locations || customer.locations.length === 0) {
    return [{ ...base, id: customer.id, locationId: null, city: "", locationType: "PLANT" }];
  }

  return customer.locations.map((location) => ({
    ...base,
    id: location.id,
    locationId: location.id,
    city: location.city,
    locationType: location.type,
    addressLine: location.addressLine || "",
    googleMapsUrl: location.googleMapsUrl || "",
    realLatitude: location.latitude,
    realLongitude: location.longitude,
  }));
}
