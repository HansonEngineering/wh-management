import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import StorClient from "./StorClient";

export const dynamic = "force-dynamic";

export default async function StorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <StorClient user={session} />;
}
