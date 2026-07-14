import "dotenv/config";
import { CosmosClient } from "@azure/cosmos";

const COSMOS_DATABASE = "devcraft";
const COSMOS_CONTAINER = "main";

const OFFER_LETTER_TASK = {
  title: "Upload offer letter on LinkedIn",
  description:
    "Upload your offer letter as a LinkedIn post. Take a screenshot of your offer letter and post it on LinkedIn. The offer letter image must clearly show your name, intern ID, domain, and DevCraft or Fennark branding.",
  notice:
    "Your offer letter was sent to your email when you enrolled. Take a screenshot and upload it as a LinkedIn post. Submit the link to your LinkedIn post as your submission URL.",
};

function getCosmosClient() {
  const connStr = process.env.COSMOS_DB_CONNECTION_STRING;
  if (!connStr) throw new Error("COSMOS_DB_CONNECTION_STRING not set");
  return new CosmosClient(connStr);
}

function cleanDoc(doc) {
  if (!doc) return null;
  const { entityType, _rid, _self, _etag, _attachments, _ts, ...rest } = doc;
  return rest;
}

async function listEnrollments(container) {
  const query = "SELECT * FROM c WHERE c.entityType = 'enrollments'";
  const { resources } = await container.items.query(query).fetchAll();
  return resources.map((r) => ({ id: r.id, ...cleanDoc(r) }));
}

async function updateEnrollment(container, id, updates) {
  try {
    const { resource: existing } = await container
      .item(id, "enrollments")
      .read();
    if (!existing) {
      console.warn(`  Enrollment ${id} not found in Cosmos DB`);
      return;
    }
    const merged = { ...existing };
    for (const [key, value] of Object.entries(updates)) {
      if (key.includes(".")) {
        const parts = key.split(".");
        let obj = merged;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in obj) || typeof obj[parts[i]] !== "object")
            obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      } else {
        merged[key] = value;
      }
    }
    await container.item(id, "enrollments").replace(merged);
    console.log(`  ✓ Updated enrollment ${id}`);
  } catch (err) {
    console.error(`  ✗ Failed to update enrollment ${id}: ${err.message}`);
  }
}

const ALL_DOMAINS = [
  "Web Development",
  "Python Development",
  "Java Development",
  "C / C++ Development",
  "Data Science",
  "Data Analysis",
  "Machine Learning",
  "Artificial Intelligence",
  "UI/UX Design",
  "App Development",
  "Cloud Computing",
  "Cybersecurity",
  "Full Stack Development",
  "DevOps Engineering",
  "Database Management",
  "Blockchain Development",
  "Digital Marketing",
  "Python Programming Basics",
  "Web Development Fundamentals",
  "React & Modern Web Apps",
];

async function main() {
  console.log("=== Seed: Set First Task to 'Upload offer letter on LinkedIn' ===\n");

  const cosmos = getCosmosClient();
  const db = cosmos.database(COSMOS_DATABASE);
  const container = db.container(COSMOS_CONTAINER);

  console.log("Fetching all enrollments from Cosmos DB...");
  const enrollments = await listEnrollments(container);
  console.log(`Found ${enrollments.length} enrollments.\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const enrollment of enrollments) {
    try {
      let projects = enrollment.projects || [];
      const existingFirst = projects[0];

      if (
        existingFirst &&
        existingFirst.title &&
        existingFirst.title.toLowerCase().includes("offer letter")
      ) {
        skipped++;
        continue;
      }

      projects[0] = { ...OFFER_LETTER_TASK };

      const domain = enrollment.domain || enrollment.domains?.[0] || "";
      if (domain) {
        projects[0].description += `\n\nDomain: ${domain}`;
      }

      await updateEnrollment(container, enrollment.id, { projects });
      updated++;
    } catch (err) {
      errors++;
      console.error(`  ✗ Error processing ${enrollment.id}: ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already has offer letter task): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${updated + skipped + errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
