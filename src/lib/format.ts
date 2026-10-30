const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
// Per-call AI costs are fractions of a cent, so show four decimals.
const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const numberFormat = new Intl.NumberFormat("en-US");

export const formatDate = (d: Date | string) => dateFormat.format(new Date(d));
export const formatDateTime = (d: Date | string) =>
  dateTimeFormat.format(new Date(d));
export const formatUSD = (n: number) => usdFormat.format(n);
export const formatNumber = (n: number) => numberFormat.format(n);
