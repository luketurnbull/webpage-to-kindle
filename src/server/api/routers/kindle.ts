import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { setupUsersGmail } from "~/server/helpers/setup-users-gmail";
import { constructUrl } from "~/server/helpers/construct-url";
import { fetchDocument } from "~/server/helpers/fetch-document";
import { constructFileName } from "~/server/helpers/construct-file-name";
import { constructPdf } from "~/server/helpers/construct-pdf";

const constructEmailBody = (
  pageTitle: string,
  pdfBase64: string,
  fileName: string,
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
      "Sent from Webpage to Kindle",
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

        console.log(`
          ------------------------------
          Step 1: Checking URL from ${input.url}
          ------------------------------
        `);

        const url = constructUrl(input.url);

        console.log(`
          ------------------------------
          Step 2: Fetching HTML from ${url}
          ------------------------------
        `);

        const response = await fetchDocument(url);
        const html = await response.text();

        console.log(`
          ------------------------------
          Step 3: Constructing file name from HTML response
          ------------------------------
        `);

        const title = constructFileName(html);
        const fileName = `${title}.pdf`;

        console.log(`
          ------------------------------
          Step 4: Constructing PDF from HTML
          ------------------------------
        `);

        const pdf = await constructPdf(html);

        console.log(`
          ------------------------------
          Step 5: Authorizing Gmail API
          ------------------------------
        `);

        const gmail = await setupUsersGmail(ctx.session.user.id, ctx.db);

        const { kindleEmail, email: userEmail } = ctx.session.user;
        const raw = constructEmailBody(
          title,
          pdf.toString("base64"),
          fileName,
          kindleEmail,
          userEmail,
        );

        console.log(`
          ------------------------------
          Step 6: Sending email to ${kindleEmail} from ${userEmail}
          ------------------------------
        `);

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
          pdf: pdf.toString("base64"),
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
