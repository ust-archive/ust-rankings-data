import { ReviewDocument } from "../../data/data-review.js";
import _ from "lodash";
import { db } from "../../data/index.js";
import { CQDocument } from "../../data/data-cq.js";
import { Context } from "../types.js";
import { CourseExtraObject } from "./types.js";

async function allHistoricalInstructorsOf(subject: string, number: string) {
  const reviews: ReviewDocument[] = await db.reviews
    .find({ selector: { subject, number } })
    .exec();
  return _.chain(reviews)
    .map((review) => review.instructor)
    .sort()
    .uniq()
    .value();
}

async function allInstructorsOf(
  subject: string,
  number: string,
  context: Context,
) {
  const cqs: CQDocument[] = await db.cq
    .find({
      selector: {
        subject,
        number,
        termNumber: context.termNumber,
      },
    })
    .exec();
  return _.chain(cqs)
    .flatMap((cq) => cq.instructors)
    .sort()
    .uniq()
    .value();
}

async function allTermsOf(subject: string, number: string) {
  const reviews: ReviewDocument[] = await db.reviews
    .find({ selector: { subject, number } })
    .exec();
  const cqs: CQDocument[] = await db.cq
    .find({ selector: { subject, number } })
    .exec();
  const reviewsTerms = _.chain(reviews)
    .map((review) => review.termNumber)
    .value();
  const cqsTerms = _.chain(cqs)
    .map((cq) => cq.termNumber)
    .value();
  return _.chain([...reviewsTerms, ...cqsTerms])
    .sort()
    .uniq()
    .value();
}

async function extraOf(
  subject: string,
  number: string,
  context: Context,
): Promise<CourseExtraObject> {
  return {
    subject,
    number,
    terms: await allTermsOf(subject, number),
    instructors: await allInstructorsOf(subject, number, context),
    historicalInstructors: await allHistoricalInstructorsOf(subject, number),
  };
}

export async function allExtras(
  context: Context,
): Promise<Record<string, CourseExtraObject>> {
  const reviews: ReviewDocument[] = await db.reviews.find().exec();

  const courses = _.chain(reviews)
    .map((review) => [review.subject, review.number])
    .uniqBy((course) => course.join(" "))
    .value();

  const entries = await Promise.all(
    _.chain(courses)
      .map(async ([subject, number]) => [
        `${subject} ${number}`,
        await extraOf(subject, number, context),
      ])
      .value(),
  );

  return _.fromPairs(entries);
}
