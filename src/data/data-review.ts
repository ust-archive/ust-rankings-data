import { glob } from "glob";
import { RxCollection, RxDocument, RxJsonSchema } from "rxdb";
import fs from "fs/promises";
import { calcTermNumber, convertTerm } from "./utils.js";
import * as mathjs from "mathjs";
import { type Static, Type } from "@sinclair/typebox";
import { RawCourse, RawReview } from "./data-review.types.js";

export const Review = Type.Object({
  id: Type.Optional(Type.String({ maxLength: 64 })),
  hash: Type.String(),
  term: Type.String({ maxLength: 16 }),
  termName: Type.String(),
  termNumber: Type.Number({ minimum: 0, maximum: 99 * 4 + 3, multipleOf: 1 }),
  subject: Type.String({ maxLength: 8 }),
  number: Type.String({ maxLength: 8 }),
  instructor: Type.String({ maxLength: 32 }),
  ratingInstructor: Type.Number(),
  ratingContent: Type.Number(),
  ratingTeaching: Type.Number(),
  ratingGrading: Type.Number(),
  ratingWorkload: Type.Number(),
  upvoteCount: Type.Number(),
  downvoteCount: Type.Number(),
});

export type Review = Static<typeof Review>;

export type ReviewDocument = RxDocument<Review>;

export type ReviewCollection = RxCollection<Review>;

export const ReviewSchema = {
  version: 0,
  primaryKey: {
    key: "id",
    fields: ["hash", "instructor"],
    separator: " ",
  },
  indexes: [
    "instructor",
    ["subject", "number"],
    "termNumber",
    ["termNumber", "instructor"],
    ["termNumber", "subject", "number"],
    "term",
    ["term", "instructor"],
    ["term", "subject", "number"],
  ],
  ...Review,
} as RxJsonSchema<Review>;

export async function loadReviews(collection: ReviewCollection) {
  const prevTime = Date.now();
  const prevCount = await collection.count().exec();

  const files = await glob("data-review/data/**/*.json");
  await Promise.all(files.map((file) => loadReviewsFromFile(collection, file)));

  const count = await collection.count().exec();
  const time = Date.now();

  console.log(`Loaded ${count - prevCount} reviews in ${time - prevTime} ms`);
}

async function loadReviewsFromFile(collection: ReviewCollection, file: string) {
  const content = await fs.readFile(file, "utf-8");
  const obj = JSON.parse(content) as {
    course: RawCourse;
    reviews: RawReview[];
  };
  const course = obj.course;
  await Promise.all(
    obj.reviews.map(async (review) =>
      loadOneReview(collection, course, review),
    ),
  );
}

async function loadOneReview(
  collection: ReviewCollection,
  course: RawCourse,
  review: RawReview,
) {
  await Promise.all(
    review.instructors.map(async (instructor) => {
      await collection.insert({
        hash: review.hash,
        term: convertTerm(review.semester),
        termName: review.semester,
        termNumber: calcTermNumber(convertTerm(review.semester)),
        subject: course.subject,
        number: course.code,
        instructor: instructor.name,
        ratingInstructor: instructor.rating,
        ratingContent: review.rating_content,
        ratingTeaching: review.rating_teaching,
        ratingGrading: review.rating_grading,
        ratingWorkload: review.rating_workload,
        upvoteCount: review.upvote_count,
        downvoteCount: review.vote_count - review.upvote_count,
      } satisfies Review);
    }),
  );
}

export async function normalizeReviews(collection: ReviewCollection) {
  const prevTime = Date.now();

  const reviews: ReviewDocument[] = await collection.find().exec();
  const mean = {
    ratingInstructor: mathjs.mean(reviews.map((r) => r.ratingInstructor)),
    ratingContent: mathjs.mean(reviews.map((r) => r.ratingContent)),
    ratingTeaching: mathjs.mean(reviews.map((r) => r.ratingTeaching)),
    ratingGrading: mathjs.mean(reviews.map((r) => r.ratingGrading)),
    ratingWorkload: mathjs.mean(reviews.map((r) => r.ratingWorkload)),
  };
  const std = {
    ratingInstructor: mathjs.std(
      reviews.map((r) => r.ratingInstructor),
      "uncorrected",
    ) as number,
    ratingContent: mathjs.std(
      reviews.map((r) => r.ratingContent),
      "uncorrected",
    ) as number,
    ratingTeaching: mathjs.std(
      reviews.map((r) => r.ratingTeaching),
      "uncorrected",
    ) as number,
    ratingGrading: mathjs.std(
      reviews.map((r) => r.ratingGrading),
      "uncorrected",
    ) as number,
    ratingWorkload: mathjs.std(
      reviews.map((r) => r.ratingWorkload),
      "uncorrected",
    ) as number,
  };

  await collection.find().modify((doc) => {
    doc.ratingInstructor =
      (doc.ratingInstructor - mean.ratingInstructor) / std.ratingInstructor;
    doc.ratingContent =
      (doc.ratingContent - mean.ratingContent) / std.ratingContent;
    doc.ratingTeaching =
      (doc.ratingTeaching - mean.ratingTeaching) / std.ratingTeaching;
    doc.ratingGrading =
      (doc.ratingGrading - mean.ratingGrading) / std.ratingGrading;
    doc.ratingWorkload =
      (doc.ratingWorkload - mean.ratingWorkload) / std.ratingWorkload;
    return doc;
  });

  const count = await collection.count().exec();
  const time = Date.now();

  console.log(`Normalized ${count} reviews in ${time - prevTime} ms`);
}
