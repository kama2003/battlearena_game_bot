import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// One shared .env at the repo root, regardless of which package's directory
// the process was started from.
config({ path: resolve(here, "../../../../.env") });
