const URLS_TO_REDIRECT_TO_PROXY = [
  "medium.com",
  "javascript.plainenglish.io",
  "python.plainenglish.io",
];

const urlProxy = process.env.URL_PROXY;

export const constructUrl = (url: string) => {
  try {
    if (!urlProxy) {
      return url;
    }

    for (const redirectUrl of URLS_TO_REDIRECT_TO_PROXY) {
      if (url.includes(redirectUrl)) {
        return `${urlProxy}/${url}`;
      }
    }

    return url;
  } catch (error) {
    console.error("Error constructing URL:", error);
    throw new Error("An unknown error occurred while constructing URL");
  }
};
