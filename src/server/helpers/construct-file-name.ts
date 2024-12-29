export const constructFileName = (html: string) => {
  const h1Pattern = /<h1>(.*?)<\/h1>/;
  const titlePattern = /<title>(.*?)<\/title>/;

  const h1 = h1Pattern.exec(html)?.[1];
  const meta_title = titlePattern.exec(html)?.[1];

  const title = h1 ?? meta_title ?? "article";

  // Remove special characters and limit length
  const formattedTitle = title
    .replace(/[^a-zA-Z0-9\s]+/g, " ") // Replace special chars with space
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim() // Remove leading/trailing spaces
    .substring(0, 100); // Limit length

  return formattedTitle;
};
