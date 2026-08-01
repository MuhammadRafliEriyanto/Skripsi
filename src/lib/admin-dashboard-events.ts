export const ADMIN_DASHBOARD_DATA_CHANGED_EVENT =
  "admin-dashboard-data-changed";

export function notifyAdminDashboardDataChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ADMIN_DASHBOARD_DATA_CHANGED_EVENT));
}
