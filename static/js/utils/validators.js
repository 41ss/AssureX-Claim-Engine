/**
 * validators.js
 * Frontend-only validation. Per the project boundary, this catches
 * obviously-bad input (empty required fields, malformed dates,
 * unsupported files) — it does NOT decide whether a claim is valid.
 * That decision belongs to the decision-engine module.
 */

export function isRequired(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function isValidDate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

/** A date must not be in the future (e.g. purchase date, fault date). */
export function isNotFutureDate(value) {
  if (!isValidDate(value)) return false;
  return new Date(value).getTime() <= Date.now();
}

export function isBeforeOrEqual(dateA, dateB) {
  if (!isValidDate(dateA) || !isValidDate(dateB)) return true; // let missing-field rule handle it
  return new Date(dateA).getTime() <= new Date(dateB).getTime();
}

const ACCEPTED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, matches uploader copy

export function isAcceptedFileType(file) {
  return ACCEPTED_DOC_TYPES.includes(file.type);
}

export function isAcceptedFileSize(file) {
  return file.size <= MAX_FILE_SIZE_BYTES;
}

export function validateFile(file) {
  if (!isAcceptedFileType(file)) {
    return { ok: false, message: "Only PDF, JPG or PNG files are supported." };
  }
  if (!isAcceptedFileSize(file)) {
    return { ok: false, message: "File is larger than the 10MB limit." };
  }
  return { ok: true };
}

/**
 * Run a set of {field, value, rules[]} checks and return an
 * { fieldName: errorMessage } map for anything that failed.
 * Each rule is [testFn, message].
 */
export function validateFields(fields) {
  const errors = {};
  for (const { name, value, rules } of fields) {
    for (const [test, message] of rules) {
      if (!test(value)) {
        errors[name] = message;
        break;
      }
    }
  }
  return errors;
}
