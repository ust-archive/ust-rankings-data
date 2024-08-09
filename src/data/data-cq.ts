import { RxCollection, RxDocument, RxJsonSchema } from "rxdb";
import fs from "fs/promises";
import _ from "lodash";
import { RawCQ, RawTerm, RawTerms } from "./data-cq.types.js";
import { Static, Type } from "@sinclair/typebox";
import { calcTermNumber } from "./utils.js";

export const CQ = Type.Object({
  id: Type.Optional(Type.String({ maxLength: 64 })),
  term: Type.String({ maxLength: 16 }),
  termName: Type.String(),
  termNumber: Type.Number({ minimum: 0, maximum: 99 * 4 + 3, multipleOf: 1 }),
  subject: Type.String({ maxLength: 8 }),
  number: Type.String({ maxLength: 8 }),
  instructors: Type.Array(Type.String()),
});

export type CQ = Static<typeof CQ>;

export type CQDocument = RxDocument<CQ>;

export type CQCollection = RxCollection<CQ>;

export const CQSchema = {
  version: 0,
  primaryKey: {
    key: "id",
    fields: ["term", "subject", "number"],
    separator: " ",
  },
  indexes: [
    "subject",
    "number",
    ["subject", "number"],
    "termNumber",
    ["termNumber", "subject", "number"],
    "term",
    ["term", "subject", "number"],
  ],
  ...CQ,
} as RxJsonSchema<CQ>;

async function loadCQByTerm(collection: CQCollection, term: RawTerm) {
  const obj = JSON.parse(
    await fs.readFile(`data-cq/${term.term}.json`, "utf-8"),
  ) as RawCQ;
  for (const course of obj) {
    await collection.insert({
      term: term.term,
      termName: term.termName,
      termNumber: calcTermNumber(term.term),
      subject: course.subject,
      number: course.number,
      instructors: _.uniq(
        course.classes.flatMap((clazz) =>
          clazz.schedule.flatMap((schedule) => schedule.instructors),
        ),
      ),
    });
  }
}

export async function loadCQ(collection: CQCollection) {
  const prevTime = Date.now();
  const prevCount = await collection.count().exec();

  const terms = JSON.parse(
    await fs.readFile("data-cq/terms.json", "utf-8"),
  ) as RawTerms;

  await Promise.all(terms.map((term) => loadCQByTerm(collection, term)));

  const time = Date.now();
  const count = await collection.count().exec();

  console.log(`Loaded ${count - prevCount} CQ in ${time - prevTime} ms`);
}
