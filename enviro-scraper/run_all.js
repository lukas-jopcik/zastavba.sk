const { spawnSync } = require("child_process");
const dayjs = require("dayjs");

const date = dayjs().format("YYYY-MM-DD");

function run(cmd, args) {
  console.log(`▶️ Running: ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status);
}

// 1) Collect
run("node", ["collect_enviroportal_list.js"]);

// 2) Enrich EIA
run("node", ["enrich_eia_details.js", `data_raw/${date}_eia.json`]);

// 3) Enrich SEA
run("node", ["enrich_eia_details.js", `data_raw/${date}_sea.json`]);

console.log("✅ All done");
