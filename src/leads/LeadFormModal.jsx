import { useState } from "react";
import { validateLead } from "./validateLead";

const EMPTY_FORM = {
  company: "",
  person: "",
  designation: "",
  city: "",
  email: "",
  phone: "",
  application: "",
  source: "Manually Added",
};

function Field({ label, required, error, children }) {
  return (
    <div className="form-field">
      <label>
        {label} {required && <span className="required-mark">*</span>}
      </label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function LeadFormModal({ cityOptions, initialValues, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (!initialValues) return EMPTY_FORM;

    return Object.keys(EMPTY_FORM).reduce(
      (acc, field) => ({ ...acc, [field]: initialValues[field] ?? "" }),
      {}
    );
  });
  const [errors, setErrors] = useState({});
  const isEditing = Boolean(initialValues);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { errors: validationErrors, isValid } = validateLead(form);
    setErrors(validationErrors);
    if (!isValid) return;
    onSave(form);
  };

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

          <Field label="City" required error={errors.city}>
            <select value={form.city} onChange={handleChange("city")}>
              <option value="">Select city</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
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

          <Field label="Source" required error={errors.source}>
            <input
              value={form.source}
              onChange={handleChange("source")}
              placeholder="e.g. Manually Added"
            />
          </Field>

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
