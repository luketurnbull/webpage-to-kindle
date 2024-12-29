import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const constructPdf = async (html: string): Promise<Uint8Array> => {
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage();

    // Add a simple test text
    page.drawText("PDF creation is working!", {
      x: 50,
      y: page.getHeight() - 50, // Position near top of page
      font,
      size: 24,
      color: rgb(0, 0.5, 0.5), // Teal color to make it obvious
    });

    return await pdfDoc.save();
  } catch (error: unknown) {
    console.error("PDF Creation Error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unknown error occurred while creating PDF");
  }
};
