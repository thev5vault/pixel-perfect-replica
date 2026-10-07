import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "@/components/vault/AccountSettings";
export const Route = createFileRoute("/account")({ component: AccountSettings });
