import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";

export default function RootPage() {
  const session = getSessionFromCookies();
  redirect(session ? "/dashboard" : "/login");
}
