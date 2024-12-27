import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export const userRouter = createTRPCRouter({
  updateKindleEmail: protectedProcedure
    .input(z.object({ kindleEmail: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ kindleEmail: input.kindleEmail })
        .where(eq(users.id, ctx.session.user.id));
      return { success: true };
    }),
});
