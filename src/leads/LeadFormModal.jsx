import { cloneElement, useState } from "react";
import { validateLead } from "./validateLead";
import { LocationPicker } from "./LocationPicker";
import { CITY_COORDINATES } from "../utils/cityCoordinates";
import { geocodeAddress, resolveMapsUrl } from "../api/routes";

const EMPTY_FORM = {
  company: "",
  person: "",
  designation: "",
  city: "",
  industryId: "",
  locationType: "PLANT",
  email: "",
  phone: "",
  application: "",
  addressLine: "",
  googleMapsUrl: "",
  latitude: null,
  longitude: null,
};

function Field({ label, required, error, children }) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label} {required && <span className="required-mark">*</span>}
      </label>
      {cloneElement(children, { id, "aria-invalid": Boolean(error) })}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function LeadFormModal({ cityOptions, industries, initialValues, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (!initialValues) return EMPTY_FORM;

    return Object.keys(EMPTY_FORM).reduce(
      (acc, field) => ({ ...acc, [field]: initialValues[field] ?? EMPTY_FORM[field] }),
      {}
    );
  });
  const [errors, setErrors] = useState({});
  const [isLocating, setIsLocating] = useState(false);
  const [locateMessage, setLocateMessage] = useState("");
  // Tracks whether the current lat/lng came from a manual drag/click
  // (source="manual") or was set programmatically by URL-parsing/geocoding
  // (source="external") - LocationPicker uses this to decide whether to
  // recenter the map on the new pin.
  const [positionSource, setPositionSource] = useState("manual");
  const isEditing = Boolean(initialValues);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCityChange = (e) => {
    const city = e.target.value;
    // A new city means the old pin (if any) no longer applies - reset to
    // that city's default center rather than leaving a stale-looking pin.
    setForm((prev) => ({ ...prev, city, latitude: null, longitude: null }));
    setPositionSource("manual");
  };

  const handlePositionChange = ([lat, lng], source = "manual") => {
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
    setPositionSource(source);
  };

  const handleLocateOnMap = async () => {
    if (!form.addressLine?.trim()) {
      setLocateMessage("Enter an address first");
      return;
    }

    setIsLocating(true);
    setLocateMessage("");

    const result = await geocodeAddress(form.addressLine, CITY_COORDINATES[form.city]);

    if (result) {
      setForm((prev) => ({ ...prev, latitude: result.latitude, longitude: result.longitude }));
      setPositionSource("external");
      setLocateMessage(`Found: ${result.label}`);
    } else {
      setLocateMessage("Couldn't find that address automatically - drag the pin manually below");
    }

    setIsLocating(false);
  };

  // Fires when a Google Maps URL is pasted into the field. Tries to extract
  // exact coordinates directly from the URL first (handles place links,
  // @lat,lng links, ?q= links, and maps.app.goo.gl short links - resolved
  // server-side). Falls back to geocoding the Address field if the URL
  // can't be parsed, and only shows an error if both fail - never silently
  // leaves the pin at the city-center default without saying so.
  const handleGoogleMapsUrlPaste = async (e) => {
    const pastedUrl = e.clipboardData.getData("text");
    console.log("[DEBUG maps-url] onPaste fired, pasted value:", pastedUrl);
    if (!pastedUrl?.trim()) return;

    setIsLocating(true);
    setLocateMessage("");

    const urlResult = await resolveMapsUrl(pastedUrl.trim());
    console.log("[DEBUG maps-url] frontend: urlResult after resolve:", urlResult);

    if (urlResult) {
      setForm((prev) => ({ ...prev, latitude: urlResult.latitude, longitude: urlResult.longitude }));
      setPositionSource("external");
      setLocateMessage(
        `Found from Maps link: ${urlResult.latitude.toFixed(5)}, ${urlResult.longitude.toFixed(5)}`
      );
      setIsLocating(false);
      return;
    }

    console.log(
      "[DEBUG maps-url] frontend: URL parsing failed, falling back to address geocode. addressLine:",
      form.addressLine
    );

    if (form.addressLine?.trim()) {
      const addressResult = await geocodeAddress(form.addressLine, CITY_COORDINATES[form.city]);
      console.log("[DEBUG maps-url] frontend: address-geocode fallback result:", addressResult);

      if (addressResult) {
        setForm((prev) => ({ ...prev, latitude: addressResult.latitude, longitude: addressResult.longitude }));
        setPositionSource("external");
        setLocateMessage(`Couldn't read coordinates from that link, but found the address: ${addressResult.label}`);
        setIsLocating(false);
        return;
      }
    }

    console.log("[DEBUG maps-url] frontend: both URL parsing and address geocoding failed");
    setLocateMessage(
      "Couldn't determine a location from that Maps link or the address - please drag the pin manually below"
    );
    setIsLocating(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { errors: validationErrors, isValid } = validateLead(form);
    setErrors(validationErrors);
    if (!isValid) return;
    onSave(form);
  };

  const cityCenter = CITY_COORDINATES[form.city];
  const position = form.latitude != null && form.longitude != null ? [form.latitude, form.longitude] : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? "Edit Lead" : "Add Lead"}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="lead-form" onSubmit={handleSubmit}>
          <div className="form-section-label">Company</div>

          <Field label="Company Name" required error={errors.company}>
            <input
              value={form.company}
              onChange={handleChange("company")}
              placeholder="e.g. Bosch Ltd."
            />
          </Field>

          <Field label="Contact Person" required error={errors.person}>
            <input
              value={form.person}
              onChange={handleChange("person")}
              placeholder="e.g. Priya Sharma"
            />
          </Field>

          <Field label="Designation" error={errors.designation}>
            <input
              value={form.designation}
              onChange={handleChange("designation")}
              placeholder="e.g. Plant Manager"
            />
          </Field>

          <Field label="Industry" error={errors.industryId}>
            <select value={form.industryId} onChange={handleChange("industryId")}>
              <option value="">Not set</option>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Email" error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              placeholder="e.g. priya@company.com"
            />
          </Field>

          <Field label="Phone" error={errors.phone}>
            <input
              type="tel"
              value={form.phone}
              onChange={handleChange("phone")}
              placeholder="e.g. 9876543210"
            />
          </Field>

          <Field label="Application" error={errors.application}>
            <input
              value={form.application}
              onChange={handleChange("application")}
              placeholder="e.g. Conveyor Automation"
            />
          </Field>

          <div className="form-section-label">Location</div>

          <Field label="City" required error={errors.city}>
            <select value={form.city} onChange={handleCityChange}>
              <option value="">Select city</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Location Type" required error={errors.locationType}>
            <select value={form.locationType} onChange={handleChange("locationType")}>
              <option value="PLANT">Plant</option>
              <option value="CORPORATE_HQ">Corporate HQ</option>
            </select>
          </Field>

          <Field label="Address" error={errors.addressLine}>
            <input
              value={form.addressLine}
              onChange={handleChange("addressLine")}
              placeholder="e.g. SIPCOT Industrial Park, Phase 2"
            />
          </Field>

          <div className="locate-on-map-row">
            <button
              type="button"
              className="btn-secondary locate-on-map-button"
              onClick={handleLocateOnMap}
              disabled={isLocating || !form.city}
            >
              {isLocating ? "Locating..." : "📍 Locate on Map"}
            </button>
            {locateMessage && <span className="locate-message">{locateMessage}</span>}
          </div>

          <Field label="Google Maps URL" error={errors.googleMapsUrl}>
            <input
              type="url"
              value={form.googleMapsUrl}
              onChange={handleChange("googleMapsUrl")}
              onPaste={handleGoogleMapsUrlPaste}
              placeholder="https://maps.google.com/?q=... or a maps.app.goo.gl link"
            />
          </Field>

          {cityCenter && (
            <div className="form-field">
              <label>Exact Location</label>
              <LocationPicker
                center={cityCenter}
                position={position}
                positionSource={positionSource}
                onChange={handlePositionChange}
              />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {isEditing ? "Save Changes" : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
