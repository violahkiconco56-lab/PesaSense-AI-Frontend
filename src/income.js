// Shared income-entry domain logic.
//
// Income is stored as a normal transaction: POST /transactions/ with
// transaction_type "income". Both the Budget page modal and the Transactions
// page form use these constants and helpers so there is only ever one income
// system.

import { todayISODate } from "./utils";

export const INCOME_SOURCES = [
  "Salary",
  "Business",
  "Side Hustle",
  "Freelance",
  "Farming",
  "Rental",
  "Gift",
  "Other",
];

export const INCOME_FREQUENCIES = [
  { value: "one_time", label: "One-time", hint: "A single payment" },
  { value: "daily", label: "Daily", hint: "Earned every day" },
  { value: "weekly", label: "Weekly", hint: "Earned every week" },
  { value: "monthly", label: "Monthly", hint: "Earned every month" },
];

export const FREQUENCY_LABELS = INCOME_FREQUENCIES.reduce((labels, option) => {
  labels[option.value] = option.label;
  return labels;
}, {});

// Mirrors the shape of GET /transactions/income/summary so pages can render
// before or without that request succeeding.
export const emptyIncomeSummary = {
  total_income: 0,
  monthly_income: 0,
  income_count: 0,
  distinct_sources: 0,
  frequency_breakdown: {},
  source_totals: {},
  average_per_source: 0,
};

export function blankIncomeForm() {
  return {
    amount: "",
    category: "Salary",
    customCategory: "",
    frequency: "monthly",
    description: "",
    date: todayISODate(),
  };
}

// The backend titles categories, so only the custom "Other" name needs care.
export function resolveIncomeSource(form) {
  const source =
    (form.category === "Other" ? form.customCategory : form.category) || "";
  return source.trim();
}

export function validateIncomeForm(form) {
  const errors = {};
  const amountValue = Number(form.amount);

  if (!String(form.amount).trim()) {
    errors.amount = "Amount is required.";
  } else if (!Number.isFinite(amountValue) || amountValue <= 0) {
    errors.amount = "Enter an amount greater than zero.";
  }

  if (!form.category) {
    errors.category = "Choose or name the income source.";
  } else if (
    form.category === "Other" &&
    resolveIncomeSource(form).length < 2
  ) {
    errors.category = "Please name the income source.";
  }

  if (!form.frequency) {
    errors.frequency = "Choose how often you earn this.";
  }

  if (String(form.description || "").length > 255) {
    errors.description = "Keep the note under 255 characters.";
  }

  if (!form.date) {
    errors.date = "Choose the date you received it.";
  } else if (Number.isNaN(new Date(`${form.date}T00:00:00Z`).getTime())) {
    errors.date = "Enter a valid date.";
  }

  return errors;
}

// Turn raw backend/network failures into something a user can act on.
export function friendlyError(error) {
  const status = error?.status;
  const detail = String(error?.message || "");

  if (status === 0) {
    return "Cannot reach the server. Make sure the backend is running, then try again.";
  }
  if (status === 404 || /not found/i.test(detail)) {
    return "Income service is unavailable. Restart the backend server so the latest code is loaded.";
  }
  if (status === 401) {
    return "Your session expired. Please log in again.";
  }
  if (status === 422) {
    return "Some details are invalid. Check the amount, source and frequency, then try again.";
  }
  if (status >= 500) {
    return "The server ran into a problem adding this income. Please try again.";
  }
  return detail || "Could not add income. Please try again.";
}

// The exact payload the FastAPI TransactionCreate schema expects.
export function buildIncomePayload(form, amountValue) {
  return {
    amount: amountValue,
    transaction_type: "income",
    category: resolveIncomeSource(form),
    description: form.description ? form.description.trim() : null,
    frequency: form.frequency,
    date: form.date ? `${form.date}T00:00:00Z` : null,
  };
}
