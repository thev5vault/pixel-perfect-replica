import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// The server implementation is imported only within the server-function handler.
// Keys and OAuth tokens must never be exposed through VITE_* variables.
export const lookupVehicle = createServerFn({ method: "POST" })
  .validator(z.object({ registrationNumber: z.string().trim().min(2).max(12).regex(/^[a-zA-Z0-9 ]+$/) }))
  .handler(async ({ data }) => {
    const { lookupRegistration } = await import("./server/dvla");
    return lookupRegistration(data.registrationNumber.toUpperCase().replace(/\s/g, ""));
  });
