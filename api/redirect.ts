import { Airtable, createNowFn, FieldSet, TableRecord } from "../deps.ts";

const CACHE_DURATION_MS = 10000;

const apiKey = Deno.env.get("AIRTABLE_API_KEY");
const baseId = Deno.env.get("AIRTABLE_BASE_ID");
const tableName = "Links";

let links: TableRecord<Link>[];
let lastUpdated: number;

export const handler = createNowFn(async (req, res) => {
  const { uid, nocache } = req.query;

  const currentTime = new Date().valueOf();
  const timestamp = new Date().toISOString();

  const ip = req.headers["x-forwarded-for"];
  const protocol = req.headers["x-forwarded-proto"];
  const host = req.headers["host"];
  const encodedUid = encodeURIComponent(`${uid}`);
  const source = `${protocol}://${host}/${encodedUid}`;

  const isForceReload = nocache !== undefined;
  const isLinksEmpty = !links;
  const isCacheExpired = currentTime - lastUpdated > CACHE_DURATION_MS;

  if (isForceReload || isLinksEmpty || isCacheExpired) {
    if (!links) {
      const airtable = new Airtable({ apiKey, baseId, tableName });
      links = await airtable.select<Link>().then((res) => res.records);
    }

    lastUpdated = currentTime;
  }

  for (const { fields } of links) {
    const { enabled = false, resolvedUid, url } = fields;

    if (enabled && resolvedUid === uid) {
      console.log(`[${timestamp}] ${ip} -> ${source} -> ${url}`);
      return res.writeHead(308, { ["Location"]: url });
    }
  }

  console.error(`[${timestamp}] ${ip} -> ${source} -> n/a`);
  return res.writeHead(404, { error: "link not found", source, timestamp });
});

interface Link extends FieldSet<string> {
  resolvedUid: string;
  url: string;
  enabled: boolean;
}
