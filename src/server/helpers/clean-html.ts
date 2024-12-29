import * as cheerio from "cheerio";

export const cleanHtml = (html: string, baseUrl?: string) => {
  try {
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $(
      'header, footer, nav, [role="navigation"], [class*="popup"], [class*="modal"]',
    ).remove();
    $(
      '[style*="position: fixed"], [style*="position:fixed"], [class*="fixed"]',
    ).remove();
    $(
      '[style*="position: sticky"], [style*="position:sticky"], [class*="sticky"]',
    ).remove();
    $("script, style, iframe, noscript").remove();
    $("*").removeAttr("style").removeAttr("class");

    // Select only the main content
    const mainContent = $(
      'main, [role="main"], article, .article, .content, .post',
    );

    const $content = mainContent.length ? mainContent.first() : $("<div>");

    if (!mainContent.length) {
      $("body")
        .find("h1, h2, h3, h4, h5, h6, p, pre, code, img")
        .each((_, elem) => {
          $content.append($(elem).clone());
        });
    }

    // Clean up images and convert to absolute URLs
    $content.find("img").each((_, img) => {
      const $img = $(img);
      let src = $img.attr("src");

      if (src && baseUrl) {
        // Convert relative URLs to absolute
        if (src.startsWith("/")) {
          const url = new URL(baseUrl);
          src = `${url.origin}${src}`;
        } else if (!src.startsWith("http")) {
          src = new URL(src, baseUrl).href;
        }
      }

      $img
        .removeAttr("class")
        .removeAttr("style")
        .removeAttr("width")
        .removeAttr("height")
        .attr("src", src ?? "");
    });

    // Clean up code blocks
    $content.find("pre, code").each((_, elem) => {
      const $elem = $(elem);
      $elem.text($elem.text().trim());
    });

    return $content.html() ?? "";
  } catch (error) {
    console.error("Error cleaning HTML:", error);
    throw new Error("An unknown error occurred while cleaning HTML");
  }
};
