import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";

function RecenterOnCityChange({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);

  return null;
}

// Recenters when the pin is moved programmatically (URL parse, address
// geocode) so the result is immediately visible without the user having to
// pan/zoom themselves. Skips the very first render (that's handled by the
// MapContainer's own initial `center` prop) and skips recentering on a
// manual drag/click, since snapping the view back to a pin the user just
// placed themselves would fight their own action.
function RecenterOnExternalMove({ position, source }) {
  const map = useMap();
  const lastSource = useRef(source);

  useEffect(() => {
    if (source !== lastSource.current && source === "external") {
      map.setView(position, 15);
    }
    lastSource.current = source;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1], source]);

  return null;
}

function ClickToPlacePin({ onPlace }) {
  useMapEvents({
    click(e) {
      onPlace([e.latlng.lat, e.latlng.lng], "manual");
    },
  });
  return null;
}

// Lets a user drop/drag a precise pin instead of relying on the city-center
// fallback used everywhere else in the app. Defaults to the city's known
// center coordinate until the user clicks or drags to refine it.
//
// `positionSource` distinguishes how `position` last changed - "external"
// (Google Maps URL parsed, address geocoded) recenters the map on the new
// pin automatically; "manual" (drag/click) does not, so the view doesn't
// fight the user's own action.
export function LocationPicker({ center, position, positionSource = "manual", onChange }) {
  const markerPosition = position || center;

  return (
    <div className="location-picker">
      <MapContainer
        center={markerPosition}
        zoom={12}
        style={{ height: "180px", width: "100%", borderRadius: "8px" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <RecenterOnCityChange center={center} />
        <RecenterOnExternalMove position={markerPosition} source={positionSource} />
        <ClickToPlacePin onPlace={onChange} />
        <Marker
          position={markerPosition}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onChange([lat, lng], "manual");
            },
          }}
        />
      </MapContainer>
      <div className="location-picker-coords">
        📍 {markerPosition[0].toFixed(5)}, {markerPosition[1].toFixed(5)}
        <span className="location-picker-hint">Click or drag the pin to set the exact location</span>
      </div>
    </div>
  );
}
