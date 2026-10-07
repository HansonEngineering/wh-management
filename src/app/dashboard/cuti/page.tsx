import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import CutiClient from "./CutiClient";

export const dynamic = "force-dynamic";

export default async function CutiPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <CutiClient user={session} />;
}
