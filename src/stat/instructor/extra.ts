import { ReviewDocument } from "../../data/data-review.js";
import _ from "lodash";
import { db } from "../../data/index.js";
import { CQDocument } from "../../data/data-cq.js";
import { Context } from "../types.js";

async function allHistoricalCoursesOf(instructor: string) {
  const reviews: ReviewDocument[] = await db.reviews
    .find({ selector: { instructor } })
    .exec();
  return _.chain(reviews)
    .map((review) => ({
      subject: review.subject,
      number: review.number,
    }))
    .uniqBy((course) => course.subject + course.number)
    .sortBy((course) => course.subject + course.number)
    .value();
}

async function allCoursesOf(instructor: string, context: Context) {
  const cqs: CQDocument[] = await db.cq
    .find({
      selector: {
        // @ts-expect-error not sure why there is an error with the type
        // doing: select * from cq where instructors contains instructor
        instructors: instructor,
        termNumber: context.termNumber,
      },
    })
    .exec();
  return _.chain(cqs)
    .map((cq) => ({
      subject: cq.subject,
      number: cq.number,
    }))
    .uniqBy((course) => course.subject + course.number)
    .sortBy((course) => course.subject + course.number)
    .value();
}

async function extraOf(instructor: string, context: Context) {
  return {
    instructor,
    historicalCourses: await allHistoricalCoursesOf(instructor),
    courses: await allCoursesOf(instructor, context),
  };
}

export async function allExtraOf(context: Context) {
  const instructors = _.chain(await db.reviews.find().exec())
    .map((review) => review.instructor)
    .uniq()
    .sort()
    .value();
  const entries = await Promise.all(
    _.chain(instructors)
      .map(async (instructor) => [
        instructor,
        await extraOf(instructor, context),
      ])
      .value(),
  );
  return _.fromPairs(entries);
}
