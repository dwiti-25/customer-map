import { estimateRoadKm, estimateIntracityHours, estimateIntercityHours } from "./geo";
import { optimizeRoute } from "./optimizeRoute";

function groupByCity(customers) {
  const groups = new Map();

  customers.forEach((customer) => {
    if (!groups.has(customer.city)) {
      groups.set(customer.city, []);
    }
    groups.get(customer.city).push(customer);
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

/**
 * Builds an optimized route plan for the given customers: customers are
 * grouped by city, ordered within each city, and the cities themselves are
 * sequenced into a sensible visiting order so multi-city trips report a real
 * total distance/time instead of only counting same-city hops.
 * Each customer must carry a `coordinates` field ([lat, lng]).
 */
export function buildRoutePlan(customers) {
  const groups = groupByCity(customers);

  const cityRoutes = [...groups.entries()].map(([city, cityCustomers]) => {
    const stops = optimizeRoute(cityCustomers);
    const legs = legsFor(stops);
    const distanceKm = legs.reduce((sum, km) => sum + km, 0);

    return {
      city,
      stops,
      distanceKm,
      durationHours: estimateIntracityHours(distanceKm),
      coordinates: stops[0].coordinates,
    };
  });

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
      travelFromPrevious,
    };
  });

  return {
    cities,
    totalDistanceKm,
    totalDurationHours,
  };
}
