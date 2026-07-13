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
import { loadLeads } from "./utils/loadLeads";
import { jitterCoordinates } from "./utils/geoJitter";
import { CITY_COORDINATES } from "./utils/cityCoordinates";
import { buildRoutePlan } from "./routing/buildRoutePlan";
import { RouteLayer } from "./routing/RouteLayer";
import { formatDistance, formatDuration } from "./routing/geo";
import {
  getManualLeads,
  addManualLead,
  updateManualLead,
  deleteManualLead,
} from "./leads/manualLeadsStore";
import { LeadFormModal } from "./leads/LeadFormModal";
import { exportLeadsToExcel } from "./leads/exportLeads";

function getMarkerIcon(source) {
  const colorMap = {
    "IMTEX": "#3b82f6",
    "ET Expo": "#10b981",
    "Chennai Expo": "#ef4444",
  };
  
  const color = colorMap[source] || "#3b82f6";
  
  return L.icon({
    iconUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${encodeURIComponent(color)}'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'/%3E%3C/svg%3E`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

function App() {
  const [excelLeads, setExcelLeads] = useState([]);
  const [manualLeads, setManualLeads] = useState(() => getManualLeads());
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("All");
  const [selectedSource, setSelectedSource] = useState("All");
  const [selectedCompanies, setSelectedCompanies] = useState(new Set());
  const [routePlan, setRoutePlan] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  const getCompanyKey = (company, city, email) => 
    `${company}|${city}|${email}`;

  useEffect(() => {
    const saved = localStorage.getItem("visitList");
    if (saved) {
      try {
        setSelectedCompanies(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error("Failed to load visit list:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("visitList", JSON.stringify([...selectedCompanies]));
  }, [selectedCompanies]);

  const toggleCompanySelection = (company, city, email) => {
    const key = getCompanyKey(company, city, email);
    const newSet = new Set(selectedCompanies);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedCompanies(newSet);
  };

  const planRoute = () => {
    if (selectedCompanies.size === 0) {
      alert("Please select at least one company");
      return;
    }

    const selected = customers.filter((customer) =>
      selectedCompanies.has(
        getCompanyKey(customer.company, customer.city, customer.email)
      )
    );

    setRoutePlan(buildRoutePlan(selected));
    setShowRoute(true);
  };

  useEffect(() => {
    async function fetchData() {
      const leads = await loadLeads();
      setExcelLeads(leads);
    }

    fetchData();
  }, []);

  const allLeads = [...excelLeads, ...manualLeads];

  const customers = allLeads
    .map((lead) => {
      const city = (lead.city || "").trim();
      const base = CITY_COORDINATES[city];

      return {
        ...lead,
        city,
        coordinates: base
          ? jitterCoordinates(base, `${lead.company}|${city}|${lead.email}`)
          : undefined,
      };
    })
    .filter((lead) => lead.coordinates);

  const cityOptions = useMemo(
    () => Object.keys(CITY_COORDINATES).sort(),
    []
  );

  const handleAddLeadClick = () => {
    setEditingLead(null);
    setIsLeadModalOpen(true);
  };

  const handleEditLeadClick = (lead) => {
    setEditingLead(lead);
    setIsLeadModalOpen(true);
  };

  const handleDeleteLead = (lead) => {
    if (!window.confirm(`Delete lead "${lead.company}"? This cannot be undone.`)) {
      return;
    }

    const key = getCompanyKey(lead.company, lead.city, lead.email);
    setManualLeads(deleteManualLead(lead.id));

    setSelectedCompanies((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleSaveLead = (fields) => {
    if (editingLead) {
      const oldKey = getCompanyKey(editingLead.company, editingLead.city, editingLead.email);
      const newKey = getCompanyKey(fields.company, fields.city, fields.email);

      setManualLeads(updateManualLead(editingLead.id, fields));

      if (oldKey !== newKey) {
        setSelectedCompanies((prev) => {
          if (!prev.has(oldKey)) return prev;
          const next = new Set(prev);
          next.delete(oldKey);
          next.add(newKey);
          return next;
        });
      }
    } else {
      setManualLeads(addManualLead(fields));
    }

    setIsLeadModalOpen(false);
    setEditingLead(null);
  };

  const handleCloseLeadModal = () => {
    setIsLeadModalOpen(false);
    setEditingLead(null);
  };

  const cities = useMemo(() => {
    return [
      "All",
      ...new Set(customers.map((c) => c.city).sort()),
    ];
  }, [customers]);

  const sources = useMemo(() => {
    return [
      "All",
      ...new Set(customers.map((c) => c.source)),
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
      customer.city === selectedCity;

    const matchesSource =
      selectedSource === "All" ||
      customer.source === selectedSource;

    return (
      matchesSearch &&
      matchesCity &&
      matchesSource
    );
  });

  const stats = {
    total: customers.length,
    cities: new Set(customers.map((c) => c.city)).size,
    imtex: customers.filter(
      (c) => c.source === "IMTEX"
    ).length,
    et: customers.filter(
      (c) => c.source === "ET Expo"
    ).length,
    chennai: customers.filter(
      (c) => c.source === "Chennai Expo"
    ).length,
  };
    return (
    <div className="app-container">
      <div className="app-header">
        <h1>🚗 Mowito Customer Travel Planner</h1>
      </div>

      <div className="dashboard">
        <Card title="Total Leads" value={stats.total} />
        <Card title="Cities Covered" value={stats.cities} />
        <Card title="IMTEX" value={stats.imtex} />
        <Card title="ET Expo" value={stats.et} />
        <Card title="Chennai Expo" value={stats.chennai} />
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
          value={selectedSource}
          onChange={(e) =>
            setSelectedSource(e.target.value)
          }
        >
          {sources.map((source) => (
            <option key={source}>{source}</option>
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
          <h2>Customers ({filteredCustomers.length} | {selectedCompanies.size} selected)</h2>

          {filteredCustomers.map((customer, index) => {
            const companyKey = getCompanyKey(customer.company, customer.city, customer.email);
            const isSelected = selectedCompanies.has(companyKey);
            return (
              <div key={index} className="customer-item">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCompanySelection(customer.company, customer.city, customer.email)}
                    style={{ marginTop: "2px", cursor: "pointer" }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong>{customer.company}</strong>
                    <div className="customer-item-person">{customer.person}</div>
                    <div className="customer-item-city">{customer.city}</div>
                    <div className="customer-item-source">{customer.source}</div>
                  </div>
                  {customer.isManual && (
                    <div className="customer-item-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title="Edit lead"
                        onClick={() => handleEditLeadClick(customer)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title="Delete lead"
                        onClick={() => handleDeleteLead(customer)}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {selectedCompanies.size > 0 && (
            <>
              <button className="plan-route-button" onClick={planRoute}>
                📍 Plan Route ({selectedCompanies.size})
              </button>

              {showRoute && routePlan && (
                <div className="route-panel">
                  <div className="route-panel-header">
                    <span>Route Plan</span>
                    <button
                      className="route-panel-close"
                      onClick={() => setShowRoute(false)}
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
                (customer, index) => (
                  <Marker
                    key={index}
                    position={customer.coordinates}
                    icon={getMarkerIcon(customer.source)}
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

                      {customer.city}

                      <br />
                      <br />

                      <b>Source</b>

                      <br />

                      {customer.source}

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