import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import GajiClient from "./GajiClient";

export const dynamic = "force-dynamic";

export default async function GajiPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");
  return <GajiClient />;
}
