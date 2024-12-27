"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export function KindleEmailForm() {
  const [kindleEmail, setKindleEmail] = useState("");
  const updateKindleEmail = api.user.updateKindleEmail.useMutation({
    onSuccess: () => {
      // Optionally refresh the page or show success message
      window.location.reload();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateKindleEmail.mutate({ kindleEmail });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-2xl font-bold">Set up your Kindle email</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="email"
          value={kindleEmail}
          onChange={(e) => setKindleEmail(e.target.value)}
          placeholder="your-kindle@kindle.com"
          className="rounded-md px-4 py-2 text-black"
          required
        />
        <button
          type="submit"
          className="rounded-md bg-blue-500 px-4 py-2 hover:bg-blue-600"
          disabled={updateKindleEmail.isLoading}
        >
          {updateKindleEmail.isLoading ? "Saving..." : "Save Kindle Email"}
        </button>
      </form>
    </div>
  );
}
