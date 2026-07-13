const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!fields.source?.trim()) {
    errors.source = "Source is required";
  }

  if (fields.email?.trim() && !EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
}
