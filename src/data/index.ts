import { addRxPlugin, createRxDatabase, RxDatabase } from "rxdb";
import { RxDBJsonDumpPlugin } from "rxdb/plugins/json-dump";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import {
  loadReviews,
  normalizeReviews,
  ReviewCollection,
  ReviewSchema,
} from "./data-review.js";
import { CQCollection, CQSchema, loadCQ } from "./data-cq.js";
import esMain from "es-main";
import fs from "fs/promises";

addRxPlugin(RxDBJsonDumpPlugin);
addRxPlugin(RxDBUpdatePlugin);

export type DatabaseCollections = {
  cq: CQCollection;
  reviews: ReviewCollection;
};

export type Database = RxDatabase<DatabaseCollections>;

export const db: Database = await createRxDatabase<DatabaseCollections>({
  name: "database",
  storage: getRxStorageMemory(),
});

await db.addCollections({
  cq: {
    schema: CQSchema,
  },
  reviews: {
    schema: ReviewSchema,
  },
});

await loadCQ(db.cq);
await loadReviews(db.reviews);
await normalizeReviews(db.reviews);

if (esMain(import.meta)) {
  await fs.writeFile(
    "database.json",
    JSON.stringify(await db.exportJSON(), null, 2),
  );
}
