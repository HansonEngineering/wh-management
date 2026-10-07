import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import JadualClient from "./JadualClient";

export const dynamic = "force-dynamic";

export default async function JadualPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <JadualClient user={session} />;
}
