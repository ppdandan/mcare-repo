/** Convert service/database errors to clear, non-technical messages for people. */
export function userFacingErrorMessage(error: unknown, fallback: string): string {
  const detail = error && typeof error === "object" && "message" in error
    ? String(error.message)
    : error instanceof Error ? error.message : "";
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  const message = detail.toLowerCase();

  if (/weekend|saturday|sunday/.test(message)) {
    return "Appointments are available Monday to Friday. Please choose a weekday.";
  }
  if (code === "23P01" || /double.?booking|time .*taken|slot .*unavailable|appointment time is unavailable/.test(message)) {
    return "That appointment time is no longer available. Choose another time.";
  }
  if (/bernice paule is not available for booking/.test(message)) {
    return "Dr. Bernice Paule is not currently available for booking. Please try again later.";
  }
  if (/completed appointment/.test(message)) {
    return "A transaction can only be recorded after the appointment is completed.";
  }
  if (/already recorded|unique.*appointment/.test(message)) {
    return "This appointment already has a transaction record. Refresh the page to see it.";
  }
  if (/admin access/.test(message)) {
    return "Only a clinic administrator can correct or void a transaction.";
  }
  if (/invalid login credentials|invalid credentials|incorrect password/.test(message)) {
    return "The email address or password is incorrect.";
  }
  if (/email not confirmed/.test(message)) {
    return "Confirm your email address before signing in.";
  }
  if (/already registered|already exists/.test(message)) {
    return "An account already exists for this email address. Sign in or use password recovery.";
  }
  if (/invalid.*(otp|token)|expired.*(otp|token)|otp.*expired/.test(message)) {
    return "That code is invalid or expired. Request a new code and try again.";
  }
  if (/rate limit|too many requests/.test(message)) {
    return "Too many attempts. Wait a moment, then try again.";
  }
  if (code === "42501" || /permission denied|row-level security|not authorized|access is required/.test(message)) {
    return "Your account does not have permission to complete this action. Contact the clinic if you need help.";
  }
  if (/failed to fetch|network|connection|timed? ?out/.test(message)) {
    return "We couldn’t connect. Check your internet connection and try again.";
  }
  return fallback;
}
