"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function KindleEmailForm() {
  const [email, setEmail] = useState("");
  const updateKindleEmail = api.user.updateKindleEmail.useMutation({
    onSuccess: () => {
      // Optionally refresh the page or show success message
      window.location.reload();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateKindleEmail.mutate({ kindleEmail: email });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-2xl font-bold">Set up your Kindle email</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your-kindle@kindle.com"
          className="rounded-md px-4 py-2 text-black"
          required
        />
        <Button type="submit" disabled={updateKindleEmail.isPending}>
          {updateKindleEmail.isPending ? "Saving..." : "Save Kindle Email"}
        </Button>
      </form>
    </div>
  );
}
