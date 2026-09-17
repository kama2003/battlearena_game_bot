import "./lib/loadRootEnv";
import closeWithGrace from "close-with-grace";
import { buildApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

async function main() {
  const app = await buildApp();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  closeWithGrace(async ({ err }) => {
    if (err) app.log.error(err);
    await app.close();
    await prisma.$disconnect();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
