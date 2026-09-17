import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// Regardless of which directory the process was started from (pnpm sets cwd
// to the package folder), env vars live in one shared .env at the repo root.
config({ path: resolve(here, "../../../../.env") });
