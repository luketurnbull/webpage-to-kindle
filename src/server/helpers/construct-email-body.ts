export const constructEmailBody = (
  pageTitle: string,
  pdf: Uint8Array,
  fileName: string,
  kindleEmail: string,
  userEmail: string,
) => {
  try {
    // First convert PDF bytes to base64
    const pdfBase64 = Buffer.from(pdf).toString("base64");

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
        pdfBase64, // Use the base64 encoded PDF
        "", // Add an empty line before boundary
        "--boundary--",
      ].join("\n"),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    return raw;
  } catch (error) {
    console.error("Error constructing email body:", error);
    throw new Error("An unknown error occurred while constructing email body");
  }
};
