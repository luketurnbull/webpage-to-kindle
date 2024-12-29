import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { setupUsersGmail } from "~/lib/setup-users-gmail";
import { constructUrl } from "~/lib/construct-url";

const formatFileNameSafe = (title: string): string => {
  return title
    .replace(/[^a-zA-Z0-9\s]+/g, " ") // Replace special chars with space
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim() // Remove leading/trailing spaces
    .substring(0, 100); // Limit length
};

const fetchAndParse = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.statusText}`);
  }

  const html = await response.text();

  // Create the final HTML
  const finalHtml = `${html}`;

  return {
    html: finalHtml,
    title: "article",
  };
};

const constructEmailBody = (
  pageTitle: string,
  pdfBase64: string,
  safeFileName: string,
  kindleEmail: string,
  userEmail: string,
) => {
  const raw = Buffer.from(
    [
      `From: ${userEmail}`,
      `To: ${kindleEmail}`,
      `Subject: ${pageTitle}`,
      'Content-Type: multipart/mixed; boundary="boundary"',
      "",
      "--boundary",
      "Content-Type: text/plain",
      "",
      "Sent from Send to Kindle",
      "",
      "--boundary",
      `Content-Type: application/pdf; name="${safeFileName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${safeFileName}"`,
      "",
      pdfBase64,
      "--boundary--",
    ].join("\n"),
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return raw;
};

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

        if (!ctx.session.user.email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Please set your email first",
          });
        }

        const url = constructUrl(input.url);
        const { kindleEmail, email: userEmail } = ctx.session.user;

        console.log(`
          ------------------------------
          Sending email to ${kindleEmail} from ${userEmail}
          Parsing HTML from ${url}
          ------------------------------
        `);

        const { html, title } = await fetchAndParse(url);
        const safeFileName = formatFileNameSafe(title) + ".pdf";

        const gmail = await setupUsersGmail(ctx.session.user.id, ctx.db);
        const raw = constructEmailBody(
          title,
          "",
          safeFileName,
          kindleEmail,
          userEmail,
        );

        const res = await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw },
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
          pdf: "",
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
