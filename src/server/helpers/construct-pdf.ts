import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { cleanHtml } from "./clean-html";
import * as cheerio from "cheerio";

const sanitizeText = (text: string): string => {
  return text
    .replace(/[\n\r]+/g, " ") // Replace newlines with spaces
    .replace(/\s+/g, " ") // Normalize multiple spaces
    .trim();
};

export const constructPdf = async (html: string): Promise<Uint8Array> => {
  try {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    // Clean the HTML and get structured content
    const content = cleanHtml(html);

    // PDF styling constants
    const margin = 50;
    const maxWidth = width - margin * 2;
    let currentY = height - margin;

    // Function to handle page breaks
    const ensureSpace = (neededSpace: number) => {
      if (currentY - neededSpace < margin) {
        page = pdfDoc.addPage();
        currentY = height - margin;
        return true;
      }
      return false;
    };

    // Parse the cleaned HTML again to render it
    const $ = cheerio.load(content);

    // Process elements
    const elements = $("h1, h2, h3, h4, h5, h6, p, pre, code, img").toArray();

    // Process elements sequentially
    for (const elem of elements) {
      const $elem = $(elem);
      const tagName = elem.tagName?.toLowerCase();

      // Handle images
      if (tagName === "img") {
        console.log("Found image");
        const src = $elem.attr("src");
        console.log("Image source:", src);
        if (src) {
          try {
            // Ensure space for image
            ensureSpace(300); // Default space for images

            // Fetch image
            const imageResponse = await fetch(src);
            const imageArrayBuffer = await imageResponse.arrayBuffer();

            // Embed image
            let image;
            try {
              if (src.toLowerCase().endsWith(".png")) {
                image = await pdfDoc.embedPng(imageArrayBuffer);
              } else if (
                src.toLowerCase().endsWith(".jpg") ||
                src.toLowerCase().endsWith(".jpeg")
              ) {
                image = await pdfDoc.embedJpg(imageArrayBuffer);
              } else {
                console.error("Unsupported image format:", src);
                continue;
              }

              // Calculate image dimensions
              const imgWidth = Math.min(maxWidth, image.width);
              const scaleFactor = imgWidth / image.width;
              const imgHeight = image.height * scaleFactor;

              // Add image
              ensureSpace(imgHeight + 40);
              page.drawImage(image, {
                x: margin,
                y: currentY - imgHeight,
                width: imgWidth,
                height: imgHeight,
              });

              currentY -= imgHeight + 40; // Space after image
            } catch (imgError) {
              console.error("Error embedding image:", imgError);
            }
          } catch (fetchError) {
            console.error("Error fetching image:", fetchError);
          }
          continue;
        }
      }

      // Handle text content
      const text = sanitizeText($elem.text());
      if (!text) continue;

      // Style mappings based on tag
      const styles = {
        h1: { font: helveticaBold, size: 24, spacing: 40 },
        h2: { font: helveticaBold, size: 20, spacing: 35 },
        h3: { font: helveticaBold, size: 18, spacing: 30 },
        h4: { font: helveticaBold, size: 16, spacing: 25 },
        p: { font: helvetica, size: 12, spacing: 20 },
        code: { font: helvetica, size: 11, spacing: 20 },
        pre: { font: helvetica, size: 11, spacing: 25 },
      }[tagName ?? "p"] ?? { font: helvetica, size: 12, spacing: 20 };

      // Split text into lines that fit the page width
      const words = text.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = styles.font.widthOfTextAtSize(testLine, styles.size);

        if (textWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          // Draw current line
          ensureSpace(styles.size + 5);
          page.drawText(currentLine, {
            x: margin,
            y: currentY,
            font: styles.font,
            size: styles.size,
            color: rgb(0, 0, 0),
          });
          currentY -= styles.size + 5;
          currentLine = word;
        }
      }

      // Draw remaining text
      if (currentLine) {
        ensureSpace(styles.size + 5);
        page.drawText(currentLine, {
          x: margin,
          y: currentY,
          font: styles.font,
          size: styles.size,
          color: rgb(0, 0, 0),
        });
        currentY -= styles.spacing;
      }
    }

    return await pdfDoc.save();
  } catch (error) {
    console.error("PDF Creation Error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unknown error occurred while creating PDF");
  }
};
