import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ReportClient from "./ReportClient";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ReportClient user={session} />;
}
