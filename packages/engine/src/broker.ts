const ALLOWED_HOSTS = new Set(["data.sec.gov", "www.sec.gov", "efts.sec.gov"]);

export interface BrokerOptions {
  userAgent: string;
  fetchImpl?: typeof fetch;
  minIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class SecBroker {
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private nextStart = 0;

  constructor(options: BrokerOptions) {
    if (!options.userAgent.trim()) {
      throw new Error("SEC_USER_AGENT is required for live SEC requests");
    }
    this.userAgent = options.userAgent.trim();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.minIntervalMs = options.minIntervalMs ?? 125;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async getText(url: string): Promise<{ body: string; retrievedAt: string; finalUrl: string }> {
    const parsed = this.assertAllowed(url);
    await this.pace();
    const response = await this.fetchImpl(parsed.href, {
      headers: { "User-Agent": this.userAgent, Accept: "application/json, text/html, */*" },
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error(`SEC redirect refused: ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(`SEC request failed: ${response.status} ${parsed.href}`);
    }
    const body = await response.text();
    if (body.includes("Request Rate Threshold Exceeded") || body.includes("Your Request Originates from an Undeclared Automated Tool")) {
      throw new Error("SEC returned a block page");
    }
    return { body, retrievedAt: new Date(this.now()).toISOString(), finalUrl: parsed.href };
  }

  private assertAllowed(url: string): URL {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error(`SEC URL must be https: ${url}`);
    if (!ALLOWED_HOSTS.has(parsed.hostname)) throw new Error(`SEC host not allowlisted: ${parsed.hostname}`);
    return parsed;
  }

  private async pace(): Promise<void> {
    const start = this.now();
    if (start < this.nextStart) await this.sleep(this.nextStart - start);
    this.nextStart = this.now() + this.minIntervalMs;
  }
}
