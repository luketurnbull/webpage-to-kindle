import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { google } from "googleapis";
import puppeteer from "puppeteer";
import { TRPCError } from "@trpc/server";
import { accounts } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export const kindleRouter = createTRPCRouter({
  sendWebpage: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if user has set their Kindle email
        if (!ctx.session.user.kindleEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Please set your Kindle email first",
          });
        }

        if (!ctx.session.user || !ctx.session.sessionToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Failed to get Gmail access token",
          });
        }

        const sessionToken = ctx.session.sessionToken;
        const kindleEmail = ctx.session.user.kindleEmail;

        console.log(`session token`, sessionToken);
        console.log(`kindle email`, kindleEmail);

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        const fileName = `${input.url.split("/").pop() ?? "article"}.pdf`;

        console.log("fileName", fileName);

        await page.goto(input.url, { waitUntil: "networkidle2" });
        const pdf = await page.pdf({ format: "A4" });
        console.log("pdf", pdf);
        await browser.close();

        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.NEXTAUTH_URL,
        );

        // Get the user's OAuth access token
        const account = await ctx.db.query.accounts.findFirst({
          where: eq(accounts.userId, ctx.session.user.id),
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

        const raw = Buffer.from(
          [
            `From: ${ctx.session.user.email}`,
            `To: ${kindleEmail}`,
            'Content-Type: multipart/mixed; boundary="boundary"',
            "MIME-Version: 1.0",
            "Subject: Web Article",
            "",
            "--boundary",
            "Content-Type: application/pdf",
            "Content-Transfer-Encoding: base64",
            `Content-Disposition: attachment; filename="${fileName}"`,
            "",
            pdf.toString(),
            "--boundary--",
          ].join("\n"),
        )
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const res = await gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw: raw,
          },
        });

        console.log("res", res);

        return { success: true };
      } catch (error) {
        console.error(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send email",
          cause: error,
        });
      }
    }),
});
