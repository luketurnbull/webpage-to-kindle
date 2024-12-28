import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { google } from "googleapis";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { TRPCError } from "@trpc/server";
import { accounts } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "~/server/db/schema";

const urlsToRedirect = ["medium.com", "javascript.plainenglish.io"];
const kindleHelperUrl = process.env.KINDLE_HELPER_URL;

// Styling similar to Tailwind CSS "prose"
const contentStyling = /* css */ `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.75;
        max-width: 65ch;
        margin: 0 auto;
        padding: 4rem 2rem;
        background: white;
        color: rgb(55, 65, 81);
      }

      article > * + * {
        margin-top: 1.5em;
      }

      h1, h2, h3, h4 {
        color: rgb(17, 24, 39);
        font-weight: 700;
        line-height: 1.1;
      }

      h1 {
        font-size: 2.25em;
        margin-top: 0;
        margin-bottom: 0.8888889em;
      }

      h2 {
        font-size: 1.5em;
        margin-top: 2em;
        margin-bottom: 1em;
      }

      h3 {
        font-size: 1.25em;
        margin-top: 1.6em;
        margin-bottom: 0.6em;
      }

      h4 {
        font-size: 1.125em;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
      }

      p {
        margin-top: 1.25em;
        margin-bottom: 1.25em;
        line-height: 1.75;
      }

      img {
        max-width: 100%;
        height: auto;
        margin: 2em auto;
        display: block;
        border-radius: 0.375rem;
      }

      a {
        color: rgb(37, 99, 235);
        text-decoration: underline;
        font-weight: 500;
      }

      ul, ol {
        margin-top: 1.25em;
        margin-bottom: 1.25em;
        padding-left: 1.625em;
      }

      li {
        margin-top: 0.5em;
        margin-bottom: 0.5em;
        padding-left: 0.375em;
      }

      ul > li {
        list-style-type: disc;
      }

      ol > li {
        list-style-type: decimal;
      }

      blockquote {
        font-weight: 500;
        font-style: italic;
        color: rgb(55, 65, 81);
        border-left: 0.25rem solid rgb(209, 213, 219);
        margin-top: 1.6em;
        margin-bottom: 1.6em;
        padding-left: 1em;
      }

      blockquote p {
        margin-top: 0.8em;
        margin-bottom: 0.8em;
      }

      code {
        color: rgb(31, 41, 55);
        font-weight: 600;
        font-size: 0.875em;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background-color: rgb(243, 244, 246);
        padding: 0.2em 0.4em;
        border-radius: 0.375rem;
      }

      pre {
        color: rgb(31, 41, 55);
        background-color: rgb(243, 244, 246);
        overflow-x: auto;
        font-size: 0.875em;
        line-height: 1.7142857;
        margin-top: 1.7142857em;
        margin-bottom: 1.7142857em;
        padding: 0.8571429em 1.1428571em;
        border-radius: 0.375rem;
      }

      pre ul, pre ol {
        margin: 0;
        padding: 0;
      }

      pre li {
        margin: 0;
        padding: 0;
      }

      pre ul > li {
        list-style: none;
      }

      pre ol > li {
        list-style: none;
      }

      pre code {
        background-color: transparent;
        border-width: 0;
        border-radius: 0;
        padding: 0;
        font-weight: 400;
        color: inherit;
        font-size: inherit;
        font-family: inherit;
        line-height: inherit;
      }

      strong {
        color: rgb(17, 24, 39);
        font-weight: 600;
      }

      hr {
        margin-top: 3em;
        margin-bottom: 3em;
        border: none;
        border-top: 1px solid rgb(209, 213, 219);
      }`;

const constructUrl = (url: string) => {
  if (!kindleHelperUrl) {
    return url;
  }

  for (const redirectUrl of urlsToRedirect) {
    if (url.includes(redirectUrl)) {
      return `${kindleHelperUrl}/${url}`;
    }
  }
  return url;
};

const getPageTitle = async (page: Page): Promise<string> => {
  const title = await page.evaluate(() => {
    // Try to get title from h1 first
    const h1 = document.querySelector("h1");
    if (h1?.textContent) return h1.textContent.trim();

    // Fallback to document title
    if (document.title) return document.title.trim();

    // Final fallback to URL
    return window.location.pathname.split("/").pop() ?? "article";
  });

  return title;
};

const formatFileNameSafe = (title: string): string => {
  return title
    .replace(/[^a-zA-Z0-9\s]+/g, " ") // Replace special chars with space
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim() // Remove leading/trailing spaces
    .substring(0, 100); // Limit length
};

const createPage = async (browser: Browser, url: string) => {
  const page = await browser.newPage();

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
  await page.goto(url, {
    waitUntil: "networkidle0",
    timeout: 30000,
  });

  return page;
};

const waitForImagesToLoad = async (page: Page) => {
  // First handle images and wait for them to load
  await page.evaluate(() => {
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      if (img.loading === "lazy") {
        img.loading = "eager";
      }
      // Handle common data-src patterns
      const dataSrc =
        img.getAttribute("data-src") ??
        img.getAttribute("data-original") ??
        img.getAttribute("data-lazy-src");
      if (dataSrc) {
        img.src = dataSrc;
      }
    });
  });

  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve, _) => {
              img.addEventListener("load", resolve);
              img.addEventListener("error", resolve); // Resolve on error too to avoid hanging
            }),
        ),
    );
  });
};

const extractAndStyleContent = async (page: Page) => {
  // Now extract and style content
  await page.evaluate((contentStyling) => {
    return new Promise((resolve) => {
      // Define helper function for stripping attributes
      const stripAttributes = (el: HTMLElement) => {
        el.removeAttribute("class");
        el.removeAttribute("style");
        el.removeAttribute("id");
        el.querySelectorAll("*").forEach((child) => {
          if (child instanceof HTMLElement) {
            child.removeAttribute("class");
            child.removeAttribute("style");
            child.removeAttribute("id");
          }
        });
      };

      // Define elements to remove
      const elementsToRemove = ["header", "nav", "footer", "aside", "form"];

      // First remove navigation and fixed/sticky elements
      const allElements = document.querySelectorAll("*");
      allElements.forEach((element) => {
        const style = window.getComputedStyle(element);
        const elementName = element.tagName.toLowerCase();
        const isElementToRemove = elementsToRemove.includes(elementName);
        const isFixedOrSticky =
          style.position === "fixed" || style.position === "sticky";
        if (isElementToRemove || isFixedOrSticky) {
          element.remove();
        }
      });

      // Remove all standalone links (not inside paragraphs)
      document.querySelectorAll("a").forEach((link) => {
        if (link.parentElement?.tagName.toLowerCase() !== "p") {
          link.replaceWith(...link.childNodes);
        }
      });

      // Create a new container for our extracted content
      const articleContainer = document.createElement("article");
      articleContainer.id = "kindle-content";

      // Select all relevant content elements, excluding nested elements
      const contentElements = document.querySelectorAll(
        `h1, h2, h3, h4, h5, h6, p, img, blockquote,
         code:not(p code):not(pre code), 
         ul:not(pre ul):not(pre *), 
         ol:not(pre ol):not(pre *),
         pre`,
      );

      // Clone and append each element to our new container
      contentElements.forEach((element) => {
        const clone = element.cloneNode(true) as HTMLElement;
        stripAttributes(clone);
        articleContainer.appendChild(clone);
      });

      // Clear the body and append our new container
      document.body.innerHTML = "";
      document.body.appendChild(articleContainer);

      // Add our custom styling
      const style = document.createElement("style");
      style.textContent = contentStyling;
      document.head.appendChild(style);

      resolve(void 0);
    });
  }, contentStyling);
};

const setupGmailAuth = async (
  userId: string,
  db: PostgresJsDatabase<typeof schema>,
) => {
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

const scrapePage = async (url: string) => {
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

  try {
    const page = await createPage(browser, url);
    await waitForImagesToLoad(page);
    await extractAndStyleContent(page);

    const pageTitle = await getPageTitle(page);
    const safeFileName = `${formatFileNameSafe(pageTitle)}.pdf`;

    const pdf = await page.pdf({
      format: "A4",
      margin: {
        top: 100,
        right: 0,
        bottom: 100,
        left: 0,
      },
      printBackground: false,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    });

    return { pdf, pageTitle, safeFileName };
  } finally {
    await browser.close();
  }
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

        // Run both operations in parallel
        const [gmail, { pdf, pageTitle, safeFileName }] = await Promise.all([
          setupGmailAuth(ctx.session.user.id, ctx.db),
          scrapePage(url),
        ]);

        const pdfBase64 = Buffer.from(pdf).toString("base64");

        const raw = constructEmailBody(
          pageTitle,
          pdfBase64,
          safeFileName,
          kindleEmail,
          userEmail,
        );

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
