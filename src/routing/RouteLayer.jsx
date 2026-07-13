import { Fragment, useEffect } from "react";
import L from "leaflet";
import { Marker, Polyline, Tooltip, useMap } from "react-leaflet";

const ROUTE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function stopIcon(number, color) {
  return L.divIcon({
    className: "route-stop-icon",
    html: `<div class="route-stop-badge" style="background:${color}">${number}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

// Pans/zooms the map to reveal the planned stops whenever a new route plan
// is generated, since selected customers can be far from the map's current view.
function FitRouteBounds({ routePlan }) {
  const map = useMap();

  useEffect(() => {
    const positions = routePlan.cities.flatMap((cityRoute) =>
      cityRoute.stops.map((stop) => stop.coordinates)
    );

    if (positions.length === 0) return;

    if (positions.length === 1) {
      map.setView(positions[0], 12);
      return;
    }

    map.fitBounds(L.latLngBounds(positions), { padding: [60, 60], maxZoom: 13 });
  }, [routePlan, map]);

  return null;
}

export function RouteLayer({ routePlan }) {
  if (!routePlan || routePlan.cities.length === 0) return null;

  return (
    <>
      <FitRouteBounds routePlan={routePlan} />

      {routePlan.cities.map((cityRoute, cityIndex) => {
        const color = ROUTE_COLORS[cityIndex % ROUTE_COLORS.length];
        const positions = cityRoute.stops.map((stop) => stop.coordinates);
        const previousCity = routePlan.cities[cityIndex - 1];

        return (
          <Fragment key={cityRoute.city}>
            {previousCity && (
              <Polyline
                positions={[
                  previousCity.stops[previousCity.stops.length - 1].coordinates,
                  cityRoute.stops[0].coordinates,
                ]}
                pathOptions={{
                  color: "#64748b",
                  weight: 2,
                  opacity: 0.6,
                  dashArray: "2 10",
                }}
              />
            )}

            <Polyline
              positions={positions}
              pathOptions={{
                color,
                weight: 4,
                opacity: 0.85,
                dashArray: "8 6",
              }}
            />

            {cityRoute.stops.map((stop, index) => (
              <Marker
                key={`${cityRoute.city}-${index}`}
                position={stop.coordinates}
                icon={stopIcon(index + 1, color)}
                zIndexOffset={1000}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  {index + 1}. {stop.company}
                </Tooltip>
              </Marker>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
