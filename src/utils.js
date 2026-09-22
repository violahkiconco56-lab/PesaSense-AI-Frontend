export function formatUGX(amount) {
  const value = Number(amount ?? 0);
  return `UGX ${Number.isFinite(value) ? value.toLocaleString() : "0"}`;
}

export function formatDate(value) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth() {
  return new Date().getMonth() + 1;
}

export function currentYear() {
  return new Date().getFullYear();
}

