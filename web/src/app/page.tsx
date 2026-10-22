import { redirect } from "next/navigation";

/**
 * Root page — redirects visitors to the login page.
 * After authentication, the login page will redirect them to /dashboard.
 */
export default function HomePage() {
  redirect("/login");
}
