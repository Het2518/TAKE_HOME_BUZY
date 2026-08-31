// Single shared Prisma client. In dev, Next.js hot-reloads modules, which would
// otherwise create a new PrismaClient (and a new DB connection pool) on every reload.
// Stashing it on `global` avoids that.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
