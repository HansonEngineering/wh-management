import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import StokClient from "./StokClient";

export const dynamic = "force-dynamic";

export default async function StokPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <StokClient user={session} />;
}
