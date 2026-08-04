"use client";

const studentDashboardRefreshEventName = "student-dashboard:refresh";
const studentAttendanceSuccessToastStorageKey =
  "student-dashboard:attendance-success-toast";
const refreshThrottleMs = 700;

export function publishStudentDashboardRefresh() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(studentDashboardRefreshEventName));
}

export function subscribeStudentDashboardRefresh(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let lastRefreshAt = 0;

  const requestRefresh = () => {
    const now = Date.now();

    if (now - lastRefreshAt < refreshThrottleMs) {
      return;
    }

    lastRefreshAt = now;
    listener();
  };

  window.addEventListener(studentDashboardRefreshEventName, requestRefresh);

  return () => {
    window.removeEventListener(studentDashboardRefreshEventName, requestRefresh);
  };
}

export function queueStudentAttendanceSuccessToast(
  message = "Absensi berhasil dicatat.",
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      studentAttendanceSuccessToastStorageKey,
      message,
    );
  } catch {
    // Session storage can be blocked by browser privacy settings.
  }
}

export function consumeStudentAttendanceSuccessToast() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const message = window.sessionStorage.getItem(
      studentAttendanceSuccessToastStorageKey,
    );

    if (!message) {
      return null;
    }

    window.sessionStorage.removeItem(studentAttendanceSuccessToastStorageKey);
    return message;
  } catch {
    return null;
  }
}
