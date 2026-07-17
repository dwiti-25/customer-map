import { estimateRoadKm, estimateIntracityHours, estimateIntercityHours } from "./geo";
import { optimizeRoute } from "./optimizeRoute";
import { canonicalCity } from "../utils/cityCoordinates";

// Grouped by canonical city name, not the raw stored string - otherwise
// "Bangalore" and "Bengaluru" (same place, different spelling) end up as two
// separate one-stop "cities," which not only inflates the visiting-city
// count but means they're never routed as an intra-city leg together (they'd
// only ever get the straight-line inter-city hop, which defeats real road
// routing for what is actually the same city).
function groupByCity(customers) {
  const groups = new Map();

  customers.forEach((customer) => {
    const key = canonicalCity(customer.city);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(customer);
  });

  return groups;
}

function legsFor(orderedStops) {
  const legs = [];
  for (let i = 0; i < orderedStops.length - 1; i++) {
    legs.push(
      estimateRoadKm(
        orderedStops[i].coordinates,
        orderedStops[i + 1].coordinates
      )
    );
  }
  return legs;
}

// Tries real road routing (via the injected getRoadRoute, when provided) for
// the visiting order within one city, falling back to the existing
// straight-line/haversine estimate if it's not available or fails - this is
// the "swap the routing algorithm later" seam the module was built around
// from the start.
async function computeIntracityRoute(stops, getRoadRoute) {
  if (getRoadRoute && stops.length >= 2) {
    const waypoints = stops.map((stop) => stop.coordinates);
    const roadRoute = await getRoadRoute(waypoints);

    if (roadRoute) {
      return {
        distanceKm: roadRoute.distanceKm,
        durationHours: roadRoute.durationHours,
        geometry: roadRoute.geometry,
        usedRoadRouting: true,
      };
    }
  }

  const legs = legsFor(stops);
  const distanceKm = legs.reduce((sum, km) => sum + km, 0);

  return {
    distanceKm,
    durationHours: estimateIntracityHours(distanceKm),
    geometry: null,
    usedRoadRouting: false,
  };
}

/**
 * Builds an optimized route plan for the given customers: customers are
 * grouped by city, ordered within each city, and the cities themselves are
 * sequenced into a sensible visiting order. Pass `getRoadRoute` (an async
 * function taking an array of [lat, lng] waypoints and returning
 * { distanceKm, durationHours, geometry } or null) to use real road routing
 * for the within-city leg; omit it (or let it fail/return null) to use the
 * existing straight-line estimate - this always works with zero network
 * dependency, matching prior behavior exactly.
 * Each customer must carry a `coordinates` field ([lat, lng]).
 */
export async function buildRoutePlan(customers, { getRoadRoute } = {}) {
  const groups = groupByCity(customers);

  const cityRoutes = await Promise.all(
    [...groups.entries()].map(async ([city, cityCustomers]) => {
      const stops = optimizeRoute(cityCustomers);
      const routeResult = await computeIntracityRoute(stops, getRoadRoute);

      return {
        city,
        stops,
        distanceKm: routeResult.distanceKm,
        durationHours: routeResult.durationHours,
        geometry: routeResult.geometry,
        usedRoadRouting: routeResult.usedRoadRouting,
        coordinates: stops[0].coordinates,
      };
    })
  );

  const orderedCityRoutes = optimizeRoute(cityRoutes);

  let totalDistanceKm = 0;
  let totalDurationHours = 0;

  const cities = orderedCityRoutes.map((route, index) => {
    let travelFromPrevious = null;

    if (index > 0) {
      const previousStops = orderedCityRoutes[index - 1].stops;
      const distanceKm = estimateRoadKm(
        previousStops[previousStops.length - 1].coordinates,
        route.stops[0].coordinates
      );
      travelFromPrevious = {
        distanceKm,
        durationHours: estimateIntercityHours(distanceKm),
      };
      totalDistanceKm += distanceKm;
      totalDurationHours += travelFromPrevious.durationHours;
    }

    totalDistanceKm += route.distanceKm;
    totalDurationHours += route.durationHours;

    return {
      city: route.city,
      stops: route.stops,
      distanceKm: route.distanceKm,
      durationHours: route.durationHours,
      geometry: route.geometry,
      usedRoadRouting: route.usedRoadRouting,
      travelFromPrevious,
    };
  });

  return {
    cities,
    totalDistanceKm,
    totalDurationHours,
  };
}
