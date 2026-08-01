import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getAdministratorSession } from "@/application/auth/administrator-session";

export default async function ControlLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!(await getAdministratorSession())) {
    notFound();
  }

  return children;
}
