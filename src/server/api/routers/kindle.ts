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
        if (!ctx.session.user.kindleEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Please set your Kindle email first",
          });
        }

        const kindleEmail = ctx.session.user.kindleEmail;
        const fileName = `${input.url.split("/").pop() ?? "article"}.pdf`;

        // Open a browser and navigate to the URL
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(input.url, { waitUntil: "networkidle2" });

        // Convert the page to a PDF
        const pdf = await page.pdf({ format: "A4" });
        await browser.close();

        const auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.NEXTAUTH_URL,
        );

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

        // Convert PDF buffer directly to base64 string
        const pdfBase64 = Buffer.from(pdf).toString("base64");

        // Create email with base64 PDF attachment
        const raw = Buffer.from(
          [
            `From: ${ctx.session.user.email}`,
            `To: ${kindleEmail}`,
            'Content-Type: multipart/mixed; boundary="boundary"',
            "",
            "--boundary",
            "Content-Type: text/plain",
            "",
            "Sent from Send to Kindle",
            "",
            "--boundary",
            `Content-Type: application/pdf; name="${fileName}"`,
            "Content-Transfer-Encoding: base64",
            `Content-Disposition: attachment; filename="${fileName}"`,
            "",
            pdfBase64,
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

        if (res.status !== 200) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to send email",
            cause: res.data,
          });
        }

        return {
          success: true,
          body: res.data,
          pdf: pdfBase64,
        };
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
