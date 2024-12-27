"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export function SendToKindle() {
  const [url, setUrl] = useState("");
  const sendToKindle = api.kindle.sendWebpage.useMutation({
    onSuccess: () => {
      setUrl("");
      // Show success message
    },
  });

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
    </div>
  );
}
