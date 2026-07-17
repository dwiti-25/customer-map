const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validateLead(fields) {
  const errors = {};

  if (!fields.company?.trim()) {
    errors.company = "Company name is required";
  }

  if (!fields.person?.trim()) {
    errors.person = "Contact person is required";
  }

  if (!fields.city?.trim()) {
    errors.city = "City is required";
  }

  if (!fields.locationType?.trim()) {
    errors.locationType = "Location type is required";
  }

  if (fields.email?.trim() && !EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  if (fields.googleMapsUrl?.trim() && !isValidUrl(fields.googleMapsUrl.trim())) {
    errors.googleMapsUrl = "Enter a valid URL";
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
}
