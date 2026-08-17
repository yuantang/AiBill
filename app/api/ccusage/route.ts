import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

async function run(args: string[]) {
  const { stdout } = await execFileAsync("npx", ["--yes", "ccusage@latest", ...args], {
    timeout: 90_000,
    env: process.env,
    cwd: homedir(),
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(stdout) as unknown;
}

export async function POST() {
  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: "The hosted app cannot read your laptop logs. Run ccusage locally and import the JSON." },
      { status: 400 },
    );
  }
  try {
    const [monthly, daily, blocks] = await Promise.all([
      run(["monthly", "--json"]),
      run(["daily", "--json"]),
      run(["blocks", "--json"]),
    ]);
    return NextResponse.json({ monthly, daily, blocks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ccusage 运行失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
