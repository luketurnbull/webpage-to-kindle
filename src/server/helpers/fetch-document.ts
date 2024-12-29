export const fetchDocument = async (url: string) => {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error("Error fetching document:", error);
    throw new Error("An unknown error occurred while fetching document");
  }
};
