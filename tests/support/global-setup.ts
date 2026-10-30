import { execSync } from "node:child_process";

/** Reset the seeded fixtures once before the suite runs. */
export default function setup(): void {
  execSync("npm run db:seed --silent", { stdio: "ignore" });
}
