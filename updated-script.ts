import "dotenv/config";
import { PlanType, PrismaClient, type ArtistManagementType, type LabelType } from "@prisma/client";
import { createWriteStream } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const OUTPUT_FILE = path.resolve(process.cwd(), "user_data_final.csv");
const SUMMARY_FILE = path.resolve(process.cwd(), "user_data_final_summary.json");

const CUTOFF_DATE = new Date("2026-05-14T23:59:59.999Z");
const BATCH_SIZE = 5000;
/** Max label IDs per groupBy `in` clause (PlanetScale 100k row scan limit). */
const AGG_LABEL_CHUNK = 500;
const COVER_ART_PRODUCT_KEY = "cover-art-pack";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const limitArg = args.find((a) => a.startsWith("--limit="));
  if (!limitArg) return undefined;
  const n = Number.parseInt(limitArg.split("=")[1] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
})();

const HEADERS = [
  "user_id",
  "email",
  "phone",
  "first_name",
  "last_name",
  "city",
  "state",
  "gender",
  "dob",
  "user_type",
  "interests",
  "active_plan_name",
  "plan_activation_date",
  "plan_expiry_date",
  "plan_cancellation_date",
  "plan_status",
  "no_of_linked_artists",
  "royalties_earned",
  "is_publishing",
  "publishing_activation_date",
  "express_ads_campaigns",
  "amount_spend_express_ads",
  "cover_art_campaign",
  "cover_art_charges",
] as const;

const CUSTOM_ATTR_KEYS = [
  "user_type",
  "interests",
  "active_plan_name",
  "plan_activation_date",
  "plan_expiry_date",
  "plan_cancellation_date",
  "plan_status",
  "no_of_linked_artists",
  "royalties_earned",
  "is_publishing",
  "publishing_activation_date",
  "express_ads_campaigns",
  "amount_spend_express_ads",
  "cover_art_campaign",
  "cover_art_charges",
] as const;

/** Documented as not available in WebEngage spec — always empty. */
const NOT_AVAILABLE_SYSTEM = ["gender", "dob"] as const;

/** Documented as not required but included when data exists. */
const OPTIONAL_CUSTOM = ["no_of_linked_artists", "royalties_earned"] as const;

function splitName(fullName?: string | null): { firstName: string; lastName: string } {
  if (!fullName?.trim()) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function formatDateYmd(date?: Date | null): string {
  if (!date) return "";
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toE164(
  phone: string | null | undefined,
  countryCallingCode: string | null | undefined,
): string {
  if (!phone?.trim()) return "";
  const raw = phone.trim().replace(/\s+/g, "");
  if (raw.startsWith("+")) {
    const compact = "+" + raw.slice(1).replace(/\D/g, "");
    if (/^\+\d{10,15}$/.test(compact)) return compact;
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length < 6) return "";
  const cc = (countryCallingCode || "").replace(/^\+/, "").replace(/\D/g, "");
  if (!cc) return "";
  const e164 = `+${cc}${digits}`;
  return e164.length <= 16 ? e164 : "";
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function mapUserType(
  artistManagementChoice: ArtistManagementType | null | undefined,
  labelType: LabelType | null | undefined,
): string {
  if (artistManagementChoice === "SOLO") return "solo artist";
  if (artistManagementChoice === "MULTIPLE") return "team manager";
  if (labelType === "INSTITUTION") return "team manager";
  if (labelType === "INDIVIDUAL") return "solo artist";
  return "";
}

function mapPlanStatus(status: string | null | undefined): string {
  if (!status) return "";
  const s = status.toUpperCase();
  if (s === "ACTIVE" || s === "TRIALING" || s === "ASSIGNED") return "active";
  return "inactive";
}

function normalizePlanName(planName: string | null | undefined): string {
  if (!planName?.trim()) return "";
  return planName.trim().toLowerCase();
}

function royaltiesForCountry(
  country: string | null | undefined,
  inr: number,
  usd: number,
): number {
  return country === "IN" ? inr : usd;
}

type LabelAggregationMaps = {
  artistsByLabel: Map<string, number>;
  campaignsByLabel: Map<string, number>;
  campaignSpendByLabel: Map<string, number>;
  coverArtCountByLabel: Map<string, number>;
  coverArtChargesByLabel: Map<string, number>;
  walletByLabel: Map<string, { inr: number; usd: number }>;
};

function emptyAggregationMaps(): LabelAggregationMaps {
  return {
    artistsByLabel: new Map(),
    campaignsByLabel: new Map(),
    campaignSpendByLabel: new Map(),
    coverArtCountByLabel: new Map(),
    coverArtChargesByLabel: new Map(),
    walletByLabel: new Map(),
  };
}

/** Aggregations scoped to label IDs so each query stays under PlanetScale row limits. */
async function fetchAggregationsForLabels(
  labelIds: string[],
): Promise<LabelAggregationMaps> {
  const maps = emptyAggregationMaps();
  if (labelIds.length === 0) return maps;

  for (let i = 0; i < labelIds.length; i += AGG_LABEL_CHUNK) {
    const chunk = labelIds.slice(i, i + AGG_LABEL_CHUNK);
    const chunkNum = Math.floor(i / AGG_LABEL_CHUNK) + 1;
    const totalChunks = Math.ceil(labelIds.length / AGG_LABEL_CHUNK);
    console.log(
      `  Aggregation chunk ${chunkNum}/${totalChunks} (${chunk.length} labels)...`,
    );

    const [
      artistsByLabelGroups,
      campaignCountGroups,
      campaignSpendGroups,
      coverArtInvoiceGroups,
      walletByLabelGroups,
    ] = await Promise.all([
      prisma.userSpecifcArtists.groupBy({
        by: ["labelId"],
        where: { labelId: { in: chunk } },
        _count: { id: true },
      }),
      prisma.campaigns.groupBy({
        by: ["labelId"],
        where: { labelId: { in: chunk } },
        _count: { id: true },
      }),
      prisma.campaignPayments.groupBy({
        by: ["labelId"],
        where: { labelId: { in: chunk } },
        _sum: { amount: true },
      }),
      prisma.invoice.groupBy({
        by: ["labelId"],
        where: {
          labelId: { in: chunk },
          status: "PAID",
          paidAt: { lte: CUTOFF_DATE },
          items: {
            some: {
              product: { key: COVER_ART_PRODUCT_KEY },
            },
          },
        },
        _count: { id: true },
        _sum: { amountPaid: true },
      }),
      prisma.wallet.groupBy({
        by: ["labelId"],
        where: { labelId: { in: chunk } },
        _sum: {
          totalEarnedInr: true,
          totalEarnedUsd: true,
        },
      }),
    ]);

    for (const g of artistsByLabelGroups) {
      if (g.labelId) maps.artistsByLabel.set(g.labelId, g._count.id);
    }
    for (const g of campaignCountGroups) {
      maps.campaignsByLabel.set(g.labelId, g._count.id);
    }
    for (const g of campaignSpendGroups) {
      maps.campaignSpendByLabel.set(g.labelId, g._sum.amount ?? 0);
    }
    for (const g of coverArtInvoiceGroups) {
      if (g.labelId) {
        maps.coverArtCountByLabel.set(g.labelId, g._count.id);
        maps.coverArtChargesByLabel.set(g.labelId, g._sum.amountPaid ?? 0);
      }
    }
    for (const w of walletByLabelGroups) {
      if (w.labelId) {
        maps.walletByLabel.set(w.labelId, {
          inr: w._sum.totalEarnedInr ?? 0,
          usd: w._sum.totalEarnedUsd ?? 0,
        });
      }
    }
  }

  return maps;
}

async function countLabelsToExport(): Promise<number> {
  return prisma.label.count({
    where: { createdAt: { lte: CUTOFF_DATE } },
  });
}

async function main() {
  const totalLabels = await countLabelsToExport();
  console.log(
    `Labels to export (created <= ${CUTOFF_DATE.toISOString()}): ${totalLabels}`,
  );
  if (LIMIT) console.log(`--limit=${LIMIT}: exporting at most ${LIMIT} labels`);
  if (DRY_RUN) console.log("--dry-run: aggregation smoke test only, no CSV written");

  const writer = DRY_RUN ? null : createWriteStream(OUTPUT_FILE, { encoding: "utf8" });
  writer?.write(`${HEADERS.join(",")}\n`);

  const emptyCounts: Record<string, number> = Object.fromEntries(
    HEADERS.map((h) => [h, 0]),
  );
  let exportedCount = 0;
  let lastId: string | undefined;
  let batchIndex = 0;

  console.log(`Exporting labels created on or before ${CUTOFF_DATE.toISOString()}...`);

  while (true) {
    if (LIMIT !== undefined && exportedCount >= LIMIT) break;

    const take =
      LIMIT !== undefined
        ? Math.min(BATCH_SIZE, LIMIT - exportedCount)
        : BATCH_SIZE;

    const labels = await prisma.label.findMany({
      ...(lastId ? { cursor: { id: lastId }, skip: 1 } : {}),
      take,
      orderBy: { id: "asc" },
      where: { createdAt: { lte: CUTOFF_DATE } },
      select: {
        id: true,
        name: true,
        labelEmail: true,
        purpose: true,
        artistManagementChoice: true,
        labelType: true,
        publishingAgreementSigned: true,
        Details: {
          select: {
            phone: true,
            city: true,
            state: true,
            country: true,
            countryCallingCode: true,
          },
        },
        Subscriptions: {
          where: { planType: PlanType.BASE },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            planName: true,
            status: true,
            currentPeriodStart: true,
            startDate: true,
            currentPeriodEnd: true,
            canceledAt: true,
          },
        },
        PublishingSubscription: {
          select: { startDate: true },
        },
      },
    });

    if (labels.length === 0) break;

    batchIndex++;
    const labelIds = labels.map((l) => l.id);
    console.log(`Label batch ${batchIndex}: loading aggregations for ${labelIds.length} labels...`);
    const maps = await fetchAggregationsForLabels(labelIds);

    if (DRY_RUN) {
      console.log("\nDry-run aggregation sample (first batch):");
      console.log(`  artistsByLabel entries: ${maps.artistsByLabel.size}`);
      console.log(`  campaignsByLabel entries: ${maps.campaignsByLabel.size}`);
      console.log(`  campaignSpendByLabel entries: ${maps.campaignSpendByLabel.size}`);
      console.log(`  coverArtCountByLabel entries: ${maps.coverArtCountByLabel.size}`);
      console.log(`  walletByLabel entries: ${maps.walletByLabel.size}`);
      console.log("\nDry-run passed. Re-run without --dry-run for full export.");
      return;
    }

    for (const label of labels) {
      const { firstName, lastName } = splitName(label.name);
      const details = label.Details;
      const subscription = label.Subscriptions?.[0];
      const publishingStart = label.PublishingSubscription?.startDate;

      const phone = toE164(details?.phone, details?.countryCallingCode);
      const userType = mapUserType(label.artistManagementChoice, label.labelType);

      const planActivation =
        subscription?.currentPeriodStart ?? subscription?.startDate ?? null;
      const planExpiry = subscription?.currentPeriodEnd ?? null;
      const planCancelled = subscription?.canceledAt ?? null;

      const wallet = maps.walletByLabel.get(label.id);
      const royaltiesRaw = wallet
        ? royaltiesForCountry(details?.country, wallet.inr, wallet.usd)
        : "";

      const rowRecord: Record<(typeof HEADERS)[number], string | number | boolean> = {
        user_id: label.id,
        email: label.labelEmail || "",
        phone,
        first_name: firstName,
        last_name: lastName,
        city: details?.city?.trim() || "",
        state: details?.state?.trim() || "",
        gender: "",
        dob: "",
        user_type: userType,
        interests: (label.purpose || "").trim(),
        active_plan_name: normalizePlanName(subscription?.planName),
        plan_activation_date: formatDateYmd(planActivation),
        plan_expiry_date: formatDateYmd(planExpiry),
        plan_cancellation_date: formatDateYmd(planCancelled),
        plan_status: mapPlanStatus(subscription?.status),
        no_of_linked_artists: maps.artistsByLabel.get(label.id) ?? "",
        royalties_earned:
          royaltiesRaw === "" ? "" : Math.round(Number(royaltiesRaw) * 100) / 100,
        is_publishing: Boolean(publishingStart || label.publishingAgreementSigned),
        publishing_activation_date: formatDateYmd(publishingStart ?? null),
        express_ads_campaigns: maps.campaignsByLabel.get(label.id) ?? "",
        amount_spend_express_ads: Math.round(
          (maps.campaignSpendByLabel.get(label.id) ?? 0) * 100,
        ) / 100,
        cover_art_campaign: maps.coverArtCountByLabel.get(label.id) ?? "",
        cover_art_charges: maps.coverArtChargesByLabel.get(label.id)
          ? Math.round((maps.coverArtChargesByLabel.get(label.id) ?? 0) * 100) / 100
          : "",
      };

      const row = HEADERS.map((key) => csvEscape(rowRecord[key]));
      writer!.write(`${row.join(",")}\n`);

      for (const key of HEADERS) {
        const val = rowRecord[key];
        if (val === "" || val === false) emptyCounts[key] = (emptyCounts[key] ?? 0) + 1;
      }

      exportedCount++;
    }

    lastId = labels[labels.length - 1]?.id;
    console.log(`Export progress: ${exportedCount} labels...`);
  }

  if (writer) {
    await new Promise<void>((resolve, reject) => {
      writer.end(() => resolve());
      writer.on("error", reject);
    });
  }

  const customEmptyRates = CUSTOM_ATTR_KEYS.map((key) => {
    const emptyCount = emptyCounts[key] ?? 0;
    return {
      attribute: key,
      empty_or_false_count: emptyCount,
      filled_count: exportedCount - emptyCount,
      fill_rate_pct:
        exportedCount > 0
          ? Math.round(((exportedCount - emptyCount) / exportedCount) * 10000) / 100
          : 0,
    };
  });

  const largelyEmptyCustom = customEmptyRates
    .filter((r) => r.fill_rate_pct < 5 && !OPTIONAL_CUSTOM.includes(r.attribute as never))
    .map((r) => r.attribute);

  const summary = {
    exported_at: new Date().toISOString(),
    cutoff_date: CUTOFF_DATE.toISOString(),
    total_labels: exportedCount,
    output_file: OUTPUT_FILE,
    system_attributes_not_available: [...NOT_AVAILABLE_SYSTEM],
    custom_attributes_marked_not_required_in_spec: [...OPTIONAL_CUSTOM],
    custom_attributes_with_low_fill_rate_under_5pct: largelyEmptyCustom,
    custom_attributes_left_empty_or_sparse: customEmptyRates.filter((r) => r.fill_rate_pct < 1),
    column_fill_stats: HEADERS.map((key) => {
      const emptyCount = emptyCounts[key] ?? 0;
      return {
        column: key,
        empty_count: emptyCount,
        filled_count: exportedCount - emptyCount,
        fill_rate_pct:
          exportedCount > 0
            ? Math.round(((exportedCount - emptyCount) / exportedCount) * 10000) / 100
            : 0,
      };
    }),
  };

  await import("node:fs/promises").then((fs) =>
    fs.writeFile(SUMMARY_FILE, JSON.stringify(summary, null, 2), "utf8"),
  );

  console.log(`\nExport complete: ${exportedCount} labels -> ${OUTPUT_FILE}`);
  console.log(`Summary written -> ${SUMMARY_FILE}`);
  console.log("\nCustom attributes with <1% fill (mostly empty):");
  for (const row of summary.custom_attributes_left_empty_or_sparse) {
    console.log(`  - ${row.attribute}: ${row.fill_rate_pct}% filled`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to export labels:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
