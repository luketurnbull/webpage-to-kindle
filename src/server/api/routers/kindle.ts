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

        // Launch browser with stealth mode and additional configurations
        const browser = await puppeteer.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-infobars",
            "--window-position=0,0",
            "--ignore-certifcate-errors",
            "--ignore-certifcate-errors-spki-list",
            "--disable-blink-features=AutomationControlled",
            "--disable-web-security",
          ],
        });

        const page = await browser.newPage();

        // Mask webdriver
        await page.evaluateOnNewDocument(() => {
          // @ts-expect-error webdriver is not a property of navigator
          delete navigator.__proto__.webdriver;
          // @ts-expect-error chrome is not a property of window
          window.chrome = {};
          // @ts-expect-error chrome is not a property of navigator
          window.navigator.chrome = {};
        });

        // Set a realistic viewport
        await page.setViewport({
          width: 1280,
          height: 720,
          deviceScaleFactor: 1,
        });

        // Set a realistic user agent
        await page.setUserAgent(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        );

        // Add additional headers
        await page.setExtraHTTPHeaders({
          "Accept-Language": "en-US,en;q=0.9",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        });

        // Navigate with extended timeout and wait conditions
        await page.goto(input.url, {
          waitUntil: "networkidle0",
          timeout: 30000,
        });

        // Remove unwanted elements before generating PDF
        await page.evaluate(() => {
          // Remove elements with fixed or sticky positioning
          const removeElementsByPosition = () => {
            const allElements = document.querySelectorAll("*");
            allElements.forEach((element) => {
              const style = window.getComputedStyle(element);
              if (style.position === "fixed" || style.position === "sticky") {
                element.remove();
              }
            });
          };

          // Run it multiple times to catch any dynamically added elements
          removeElementsByPosition();
          setTimeout(removeElementsByPosition, 1000);

          // Add custom CSS to ensure content is properly formatted
          const style = document.createElement("style");
          style.textContent = `
            body {
              padding: 20px !important;
              margin: 0 !important;
              max-width: 100% !important;
              position: relative !important; /* Prevent fixed positioning */
            }
            article {
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .main-content {
              margin: 0 !important;
              padding: 0 !important;
            }
            /* Prevent new fixed/sticky elements */
            * {
              position: relative !important;
              z-index: auto !important;
            }
          `;
          document.head.appendChild(style);
        });

        // Wait for content to load
        await page.waitForFunction(
          () => {
            const body = document.body;
            const content = body.textContent ?? "";
            return content.length > 500;
          },
          { timeout: 10000 },
        );

        // Convert to PDF with full content
        const pdf = await page.pdf({
          format: "A4",
          printBackground: false,
          margin: {
            top: "20px",
            right: "20px",
            bottom: "20px",
            left: "20px",
          },
          displayHeaderFooter: false,
          preferCSSPageSize: true,
        });

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
