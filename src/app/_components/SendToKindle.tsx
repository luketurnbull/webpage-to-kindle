"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";

export function SendToKindle() {
  const [url, setUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const sendToKindle = api.kindle.sendWebpage.useMutation({
    onSuccess: (data) => {
      setUrl("");
      if (data.pdf) {
        // Convert base64 to blob and create URL
        const bytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlob(blobUrl);
      }
    },
  });

  // Clean up blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (pdfBlob) {
        URL.revokeObjectURL(pdfBlob);
      }
    };
  }, [pdfBlob]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendToKindle.mutate({ url });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-2xl font-bold">Send webpage to Kindle</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          className="rounded-md px-4 py-2 text-black"
          required
        />
        <button
          type="submit"
          className="rounded-md bg-blue-500 px-4 py-2 hover:bg-blue-600"
          disabled={sendToKindle.isPending}
        >
          {sendToKindle.isPending ? "Sending..." : "Send to Kindle"}
        </button>
      </form>
      {pdfBlob && (
        <a href={pdfBlob} target="_blank" rel="noopener noreferrer">
          View PDF
        </a>
      )}
    </div>
  );
}
