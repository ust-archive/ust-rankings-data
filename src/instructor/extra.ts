import { ReviewDocument } from "../data/data-review.js";
import _ from "lodash";
import { db } from "../data/index.js";
import { CQDocument } from "../data/data-cq.js";
import { Context } from "../score/types.js";

export type InstructorExtraObject = {
  historicalCourses: { subject: string; number: string }[];
  courses: { subject: string; number: string }[];
};

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
        termNumber: context.currentTermNumber,
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

async function generateInstructorExtra(instructor: string, context: Context) {
  return {
    historicalCourses: await allHistoricalCoursesOf(instructor),
    courses: await allCoursesOf(instructor, context),
  };
}

export async function generateExtra(context: Context) {
  const instructors = _.chain(await db.reviews.find().exec())
    .map((review) => review.instructor)
    .uniq()
    .sort()
    .value();
  const entries = await Promise.all(
    _.chain(instructors)
      .map(async (instructor) => [
        instructor,
        await generateInstructorExtra(instructor, context),
      ])
      .value(),
  );
  return _.fromPairs(entries);
}
