import { Fragment, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-markercluster/styles";
import "./App.css";
import { jitterCoordinates } from "./utils/geoJitter";
import { CITY_COORDINATES, canonicalCity } from "./utils/cityCoordinates";
import { buildRoutePlan } from "./routing/buildRoutePlan";
import { RouteLayer } from "./routing/RouteLayer";
import { formatDistance, formatDuration } from "./routing/geo";
import { LeadFormModal } from "./leads/LeadFormModal";
import { exportLeadsToExcel } from "./leads/exportLeads";
import { isLoggedIn, fetchCurrentUser, logout } from "./api/auth";
import { fetchAllCustomers, createCustomer, updateCustomer } from "./api/customers";
import { createLocation, updateLocation, deleteLocation } from "./api/locations";
import { fetchIndustries } from "./api/industries";
import { fetchRoadRoute } from "./api/routes";
import { expandCustomerToRows } from "./api/customerMapper";
import { LoginForm } from "./auth/LoginForm";

const MARKER_COLOR_PALETTE = [
  "#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];
const UNASSIGNED_COLOR = "#94a3b8";

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const markerIconCache = new Map();

function getMarkerIcon(industryName) {
  const key = industryName || "";
  if (markerIconCache.has(key)) return markerIconCache.get(key);

  const color = industryName
    ? MARKER_COLOR_PALETTE[hashString(industryName) % MARKER_COLOR_PALETTE.length]
    : UNASSIGNED_COLOR;

  const icon = L.icon({
    iconUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${encodeURIComponent(color)}'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'/%3E%3C/svg%3E`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  markerIconCache.set(key, icon);
  return icon;
}

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [rawCustomers, setRawCustomers] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("All");
  const [selectedIndustry, setSelectedIndustry] = useState("All");
  const [selectedIds, setSelectedIds] = useState(() => {
    try {
      const saved = localStorage.getItem("visitList");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      console.error("Failed to load visit list:", e);
      return new Set();
    }
  });
  const [routePlan, setRoutePlan] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  const [isPlanningRoute, setIsPlanningRoute] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      if (!isLoggedIn()) {
        setAuthChecked(true);
        return;
      }
      try {
        const user = await fetchCurrentUser();
        setCurrentUser(user);
      } catch {
        logout();
      }
      setAuthChecked(true);
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    async function fetchData() {
      const [all, allIndustries] = await Promise.all([fetchAllCustomers(), fetchIndustries()]);
      setRawCustomers(all);
      setIndustries(allIndustries);
    }
    fetchData();
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem("visitList", JSON.stringify([...selectedIds]));
  }, [selectedIds]);

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const planRoute = async () => {
    if (selectedIds.size === 0) {
      alert("Please select at least one company");
      return;
    }

    const selected = customers.filter((customer) => selectedIds.has(customer.id));

    setIsPlanningRoute(true);
    try {
      const plan = await buildRoutePlan(selected, { getRoadRoute: fetchRoadRoute });
      setRoutePlan(plan);
      setShowRoute(true);
    } finally {
      setIsPlanningRoute(false);
    }
  };

  const clearRoute = () => {
    setSelectedIds(new Set());
    setRoutePlan(null);
    setShowRoute(false);
  };

  // Every row here corresponds to one Location (a customer with 2 locations
  // shows as 2 rows), matching how the same company appearing at two events
  // already produced two separate rows before this migration. Customers with
  // no location (no city to plot) are filtered out here, same as leads with
  // an unrecognized city always were.
  const customers = rawCustomers
    .flatMap(expandCustomerToRows)
    .map((row) => {
      const hasRealCoordinates = row.realLatitude != null && row.realLongitude != null;
      const base = hasRealCoordinates
        ? [row.realLatitude, row.realLongitude]
        : CITY_COORDINATES[row.city];

      const coordinates = hasRealCoordinates
        ? base
        : base
        ? jitterCoordinates(base, `${row.company}|${row.city}|${row.email}`)
        : undefined;

      return { ...row, coordinates };
    })
    .filter((row) => row.coordinates);

  // Unfiltered, one row per location (or one blank-city row for customers
  // with none) - so exporting never silently loses a customer just because
  // it isn't currently plottable on the map.
  const allLeads = rawCustomers.flatMap(expandCustomerToRows);

  const handleAddLeadClick = () => {
    setEditingLead(null);
    setIsLeadModalOpen(true);
  };

  const handleEditLeadClick = (lead) => {
    setEditingLead(lead);
    setIsLeadModalOpen(true);
  };

  const handleDeleteLead = async (lead) => {
    if (!window.confirm(`Delete lead "${lead.company}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteLocation(lead.locationId);
    } catch (err) {
      alert(err.message || "Failed to delete lead");
      return;
    }

    setRawCustomers((prev) =>
      prev.map((c) =>
        c.id !== lead.customerId
          ? c
          : { ...c, locations: c.locations.filter((loc) => loc.id !== lead.locationId) }
      )
    );

    setSelectedIds((prev) => {
      if (!prev.has(lead.id)) return prev;
      const next = new Set(prev);
      next.delete(lead.id);
      return next;
    });
  };

  const handleSaveLead = async (fields) => {
    const customerFields = {
      companyName: fields.company,
      contactPerson: fields.person || undefined,
      designation: fields.designation || undefined,
      email: fields.email || undefined,
      phone: fields.phone || undefined,
      applicationNotes: fields.application || undefined,
      industryId: fields.industryId || undefined,
    };

    const locationFields = {
      type: fields.locationType,
      city: fields.city,
      addressLine: fields.addressLine || undefined,
      googleMapsUrl: fields.googleMapsUrl || undefined,
      latitude: fields.latitude ?? undefined,
      longitude: fields.longitude ?? undefined,
    };

    try {
      if (editingLead) {
        const customer = await updateCustomer(editingLead.customerId, customerFields);
        const location = await updateLocation(editingLead.locationId, locationFields);

        setRawCustomers((prev) =>
          prev.map((c) =>
            c.id !== customer.id
              ? c
              : {
                  ...c,
                  ...customer,
                  locations: c.locations.map((loc) => (loc.id === location.id ? location : loc)),
                }
          )
        );
      } else {
        const customer = await createCustomer(customerFields);
        const location = await createLocation(customer.id, locationFields);

        setRawCustomers((prev) => [...prev, { ...customer, locations: [location] }]);
      }
    } catch (err) {
      alert(err.message || "Failed to save lead");
      return;
    }

    setIsLeadModalOpen(false);
    setEditingLead(null);
  };

  const handleCloseLeadModal = () => {
    setIsLeadModalOpen(false);
    setEditingLead(null);
  };

  const cityOptions = useMemo(
    () => Object.keys(CITY_COORDINATES).sort(),
    []
  );

  const cities = useMemo(() => {
    return [
      "All",
      ...new Set(customers.map((c) => canonicalCity(c.city)).sort()),
    ];
  }, [customers]);

  const industryOptions = useMemo(() => {
    return [
      "All",
      ...new Set(customers.map((c) => c.industryName || "Unassigned")),
    ];
  }, [customers]);

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.company
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      customer.person
        ?.toLowerCase()
        .includes(search.toLowerCase());

    const matchesCity =
      selectedCity === "All" ||
      canonicalCity(customer.city) === selectedCity;

    const matchesIndustry =
      selectedIndustry === "All" ||
      (customer.industryName || "Unassigned") === selectedIndustry;

    return (
      matchesSearch &&
      matchesCity &&
      matchesIndustry
    );
  });

  const stats = {
    total: customers.length,
    cities: new Set(customers.map((c) => canonicalCity(c.city))).size,
  };

  if (!authChecked) {
    return null;
  }

  if (!currentUser) {
    return <LoginForm onLoginSuccess={setCurrentUser} />;
  }

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>🚗 Mowito Customer Travel Planner</h1>
        <div className="user-badge">
          <span>{currentUser.name}</span>
          <button
            type="button"
            onClick={() => {
              logout();
              setCurrentUser(null);
              setRawCustomers([]);
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="dashboard">
        <Card title="Total Leads" value={stats.total} />
        <Card title="Cities Covered" value={stats.cities} />
      </div>

      <div className="filters-container">
        <input
          className="search-input"
          value={search}
          placeholder="Search Company / Contact..."
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="select-field"
          value={selectedCity}
          onChange={(e) =>
            setSelectedCity(e.target.value)
          }
        >
          {cities.map((city) => (
            <option key={city}>{city}</option>
          ))}
        </select>

        <select
          className="select-field"
          value={selectedIndustry}
          onChange={(e) =>
            setSelectedIndustry(e.target.value)
          }
        >
          {industryOptions.map((industry) => (
            <option key={industry}>{industry}</option>
          ))}
        </select>
      </div>

      <div className="lead-toolbar">
        <button
          className="export-leads-button"
          onClick={() => exportLeadsToExcel(allLeads)}
        >
          ⬇️ Export All Leads
        </button>
      </div>

      <div className="content-layout">
        <div className="sidebar">
          <h2>Customers ({filteredCustomers.length} | {selectedIds.size} selected)</h2>

          {filteredCustomers.map((customer) => {
            const isSelected = selectedIds.has(customer.id);
            return (
              <div key={customer.id} className="customer-item">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(customer.id)}
                    aria-label={`Select ${customer.company} for route planning`}
                    style={{ marginTop: "2px", cursor: "pointer" }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong>{customer.company}</strong>
                    <div className="customer-item-person">{customer.person}</div>
                    <div className="customer-item-city">{customer.city}</div>
                    <div className="customer-item-source">{customer.industryName || "Unassigned"}</div>
                  </div>
                  <div className="customer-item-actions">
                    <button
                      type="button"
                      className="icon-button"
                      title="Edit lead"
                      onClick={() => handleEditLeadClick(customer)}
                    >
                      ✏️
                    </button>
                    {customer.isManual && (
                      <button
                        type="button"
                        className="icon-button"
                        title="Delete lead"
                        onClick={() => handleDeleteLead(customer)}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {(selectedIds.size > 0 || routePlan) && (
            <>
              <div className="route-actions-row">
                {selectedIds.size > 0 && (
                  <button className="plan-route-button" onClick={planRoute} disabled={isPlanningRoute}>
                    {isPlanningRoute ? "Planning route..." : `📍 Plan Route (${selectedIds.size})`}
                  </button>
                )}
                {(selectedIds.size > 0 || routePlan) && (
                  <button className="clear-route-button" onClick={clearRoute} disabled={isPlanningRoute}>
                    🔄 Clear Route
                  </button>
                )}
              </div>

              {showRoute && routePlan && (
                <div className="route-panel">
                  <div className="route-panel-header">
                    <span>Route Plan</span>
                    <button
                      className="route-panel-close"
                      onClick={() => setShowRoute(false)}
                      aria-label="Close route plan"
                    >
                      ×
                    </button>
                  </div>

                  <div className="route-summary">
                    <div className="route-summary-item">
                      <span className="route-summary-label">Total Distance</span>
                      <span className="route-summary-value">
                        {formatDistance(routePlan.totalDistanceKm)}
                      </span>
                    </div>
                    <div className="route-summary-item">
                      <span className="route-summary-label">Est. Travel Time</span>
                      <span className="route-summary-value">
                        {formatDuration(routePlan.totalDurationHours)}
                      </span>
                    </div>
                  </div>

                  {routePlan.cities.map((cityRoute, cityIndex) => (
                    <Fragment key={cityRoute.city}>
                      {cityRoute.travelFromPrevious && (
                        <div className="route-intercity-leg">
                          🚗 {formatDistance(cityRoute.travelFromPrevious.distanceKm)} · {formatDuration(cityRoute.travelFromPrevious.durationHours)} to {cityRoute.city}
                        </div>
                      )}
                      <div className="route-city-group">
                        <div className="route-city-header">
                          <span>{cityIndex + 1}. {cityRoute.city} ({cityRoute.stops.length})</span>
                          <span className="route-city-meta">
                            {formatDistance(cityRoute.distanceKm)} · {formatDuration(cityRoute.durationHours)}
                            {cityRoute.stops.length > 1 && (
                              <span className={cityRoute.usedRoadRouting ? "route-mode-real" : "route-mode-estimated"}>
                                {cityRoute.usedRoadRouting ? " · via road" : " · estimated"}
                              </span>
                            )}
                          </span>
                        </div>
                        {cityRoute.stops.map((customer, idx) => (
                          <div key={idx} className="route-stop">
                            <div className="route-stop-company">
                              {idx + 1}. {customer.company}
                            </div>
                            <div className="route-stop-person">{customer.person}</div>
                          </div>
                        ))}
                      </div>
                    </Fragment>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="map-container">
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{
              height: "100%",
              width: "100%",
              borderRadius: "12px",
            }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MarkerClusterGroup>
              {filteredCustomers.map(
                (customer) => (
                  <Marker
                    key={customer.id}
                    position={customer.coordinates}
                    icon={getMarkerIcon(customer.industryName)}
                  >
                  <Popup>
                    <div
                      style={{
                        minWidth: "250px",
                      }}
                    >
                      <h3>{customer.company}</h3>

                      <hr />

                      <b>Contact</b>

                      <br />

                      {customer.person}

                      <br />
                      <br />

                      <b>City</b>

                      <br />

                      {customer.city} {customer.locationType === "CORPORATE_HQ" ? "(Corporate HQ)" : "(Plant)"}

                      <br />
                      <br />

                      {customer.addressLine && (
                        <>
                          <b>Address</b>

                          <br />

                          {customer.addressLine}

                          <br />
                          <br />
                        </>
                      )}

                      <b>Industry</b>

                      <br />

                      {customer.industryName || "Unassigned"}

                      <br />
                      <br />

                      <b>Email</b>

                      <br />

                      {customer.email || "-"}

                      <br />
                      <br />

                      <b>Phone</b>

                      <br />

                      {customer.phone || "-"}

                      <br />
                      <br />

                      <b>Application</b>

                      <br />

                      {customer.application || "-"}

                      {customer.googleMapsUrl && (
                        <>
                          <br />
                          <br />
                          <a href={customer.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                            View on Google Maps
                          </a>
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            )}
            </MarkerClusterGroup>

            {showRoute && <RouteLayer routePlan={routePlan} />}
          </MapContainer>
        </div>
      </div>

      <button
        className="fab-add-lead"
        onClick={handleAddLeadClick}
        title="Add Lead"
      >
        ＋
      </button>

      {isLeadModalOpen && (
        <LeadFormModal
          cityOptions={cityOptions}
          industries={industries}
          initialValues={editingLead}
          onSave={handleSaveLead}
          onClose={handleCloseLeadModal}
        />
      )}
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="card">
      <div className="card-label">{title}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}

export default App;
