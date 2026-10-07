import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import BilikClient from "./BilikClient";

export const dynamic = "force-dynamic";

export default async function BilikPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <BilikClient user={session} />;
}
