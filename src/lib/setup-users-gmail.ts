"use server";

import { google } from "googleapis";
import { accounts } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "~/server/db/schema";
import { TRPCError } from "@trpc/server";
import { type gmail_v1 } from "googleapis/build/src/apis/gmail";

export const setupUsersGmail = async (
  userId: string,
  db: PostgresJsDatabase<typeof schema>,
): Promise<gmail_v1.Gmail> => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL,
  );

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.userId, userId),
  });

  if (!account?.access_token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "No Gmail access token found",
    });
  }

  auth.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  const gmail = google.gmail({
    auth: auth,
    version: "v1",
  });

  return gmail;
};
