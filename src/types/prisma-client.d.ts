import '@prisma/client';

declare module '@prisma/client' {
  // Augment the generated PrismaClient with a permissive index signature
  // so accessing `prisma.attributeName` / `prisma.attributeValue` (and other
  // generated model delegates) doesn't cause TS errors when the generated
  // typings are missing or not visible to the TS server.
  interface PrismaClient {
    [key: string]: any;
    attributeName?: any;
    attributeValue?: any;
  }
}
