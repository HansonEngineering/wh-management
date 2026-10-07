import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import KehadiranClient from "./KehadiranClient";

export const dynamic = "force-dynamic";

export default async function KehadiranPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <KehadiranClient user={session} />;
}
