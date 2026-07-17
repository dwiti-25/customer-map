import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";

function RecenterOnCityChange({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);

  return null;
}

function ClickToPlacePin({ onPlace }) {
  useMapEvents({
    click(e) {
      onPlace([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

// Lets a user drop/drag a precise pin instead of relying on the city-center
// fallback used everywhere else in the app. Defaults to the city's known
// center coordinate until the user clicks or drags to refine it.
export function LocationPicker({ center, position, onChange }) {
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
        <ClickToPlacePin onPlace={onChange} />
        <Marker
          position={markerPosition}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onChange([lat, lng]);
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
