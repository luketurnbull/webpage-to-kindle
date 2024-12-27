import Link from "next/link";
import { KindleEmailForm } from "~/app/_components/KindleEmailForm";
import { SendToKindle } from "~/app/_components/SendToKindle";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await auth();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
        <h1 className="text-5xl font-extrabold">Webpage to Kindle</h1>

        {!session?.user && (
          <Link
            href="/api/auth/signin"
            className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
          >
            Sign in with Google
          </Link>
        )}

        {session?.user && !session.user.kindleEmail && <KindleEmailForm />}

        {session?.user && session.user.kindleEmail && <SendToKindle />}
      </main>
    </HydrateClient>
  );
}
