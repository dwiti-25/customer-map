import { estimateRoadKm } from "./geo";

/**
 * Greedy nearest-neighbor TSP heuristic. Starting from the first point,
 * repeatedly travels to the closest remaining point.
 */
export function nearestNeighborOrder(points) {
  if (points.length <= 2) return [...points];

  const remaining = [...points];
  const ordered = [remaining.shift()];

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let closestIndex = 0;
    let closestDistance = Infinity;

    remaining.forEach((point, index) => {
      const distance = estimateRoadKm(current.coordinates, point.coordinates);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    ordered.push(remaining.splice(closestIndex, 1)[0]);
  }

  return ordered;
}

/**
 * Orders a list of points using the given strategy. Swap `strategyFn` to
 * replace the routing algorithm (e.g. a 2-opt refinement or a real
 * road-network based optimizer) without touching any caller code.
 */
export function optimizeRoute(points, strategyFn = nearestNeighborOrder) {
  return strategyFn(points);
}
