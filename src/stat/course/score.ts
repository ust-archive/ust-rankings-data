import { Review, ReviewDocument } from "../../data/data-review.js";
import { CourseScoreObject } from "./types.js";
import { Context, Ratings } from "../types.js";
import _ from "lodash";
import { average, averageBayesian } from "../utils.js";
import { db } from "../../data/index.js";

async function calcConfidence(review: Review, context: Context) {
  const instructors: string[] = await db.cq
    .findOne({
      selector: {
        termNumber: context.termNumber,
        subject: review.subject,
        number: review.number,
      },
    })
    .exec()
    .then((cq) => cq?.instructors ?? []);

  let weight = 1;

  // votes:
  // the difference between the upvotes and downvotes
  let votes = review.upvoteCount - review.downvoteCount;
  if (votes > 0) {
    // positive means there are more upvotes than downvotes, i.e., the review is more helpful
    // the weight is increased by 50% for each upvote
    weight *= 1 + votes * 0.5;
  }
  if (votes < 0) {
    // negative means there are more downvotes than upvotes, i.e., the review is less helpful
    // the weight is decreased by the following formula:
    votes = -votes;
    weight *= 1 / (votes + 1);
  }

  // instructor:
  // if the review is about the same instructor, the weight becomes 300% of the original weight
  // otherwise, the weight becomes 15% of the original weight
  // this is because the instructor has a significant impact on the course
  if (instructors.includes(review.instructor)) {
    weight *= 3.0;
  } else {
    weight *= 0.15;
  }

  // season:
  // if the review is from the same season, the weight becomes 150% of the original weight
  // this is because seasonal reviews are more relevant
  // for example, the courses COMP 2011 in Fall is different from COMP 2011 in Spring,
  // because there is COMP 2012H in Fall which separates the students into 2 courses
  if (review.termNumber % 4 === context.termNumber % 4) {
    weight *= 1.5;
  }

  // timeliness:
  // the weight becomes 75% of the original weight for each 4 terms difference
  const termDifference = context.termNumber - review.termNumber;
  weight *= Math.pow(1 - 0.25, termDifference / 4);

  return weight;
}

/**
 * Calculate the score of a course specified by the course subject and the
 * course number with the given context.
 *
 * The context is an object with the following properties:
 *
 * - Season: the season that the course is offered
 * - Instructor: the instructor of the course
 *
 * The reason for the context is that the same course may have different ratings
 * in different seasons or with different instructors. One may refer to the
 * comments in function `calcWeight` for more details.
 *
 * @param subject The subject of the course
 * @param number The number of the course
 * @param context The context of the course
 * @param lazy
 */
async function calcCourseScore(
  subject: string,
  number: string,
  context: Context,
  lazy: boolean,
): Promise<CourseScoreObject | null> {
  if (lazy) {
    const termReviewCount = await db.reviews
      .count({
        selector: { subject, number, termNumber: context.termNumber },
      })
      .exec();
    if (termReviewCount === 0) {
      return null;
    }
  }

  // Select all reviews term before or of the current term that are either about the same course or the same instructor
  const reviews: ReviewDocument[] = await db.reviews
    .find({
      selector: {
        termNumber: { $lte: context.termNumber },
        subject: subject,
        number: number,
      },
    })
    .exec();

  // Select all reviews term of the current term that are either about the same course or the same instructor
  const individualReviews: ReviewDocument[] = await db.reviews
    .find({
      selector: {
        termNumber: context.termNumber,
        subject: subject,
        number: number,
      },
    })
    .exec();

  const confidenceVector = await Promise.all(
    reviews.map((review) => calcConfidence(review, context)),
  );
  const individualConfidenceVector = await Promise.all(
    individualReviews.map((review) => calcConfidence(review, context)),
  );

  const ratings = _.chain(Ratings)
    .map((rating) => {
      const ratingVector = reviews.map((review) => review[rating]);
      const ratingAverage = average(ratingVector, confidenceVector);
      return [rating, ratingAverage];
    })
    .fromPairs()
    .value() as Record<Ratings, number>;

  const individualRatings = _.chain(Ratings)
    .map((rating) => {
      const ratingVector = individualReviews.map((review) => review[rating]);
      const ratingAverage = average(ratingVector, individualConfidenceVector);
      return [rating, ratingAverage];
    })
    .fromPairs()
    .value() as Record<Ratings, number>;

  return {
    subject,
    number,
    term: context.termNumber,
    ...ratings,
    samples: reviews.length,
    confidence: _.sum(confidenceVector),
    individualRatingContent: individualRatings.ratingContent,
    individualRatingTeaching: individualRatings.ratingTeaching,
    individualRatingGrading: individualRatings.ratingGrading,
    individualRatingWorkload: individualRatings.ratingWorkload,
    individualSamples: individualReviews.length,
    individualConfidence: _.sum(individualConfidenceVector),
  };
}

async function calcAllCoursesScore(
  context: Context,
  lazy: boolean,
): Promise<CourseScoreObject[]> {
  const allCourses: [string, string][] = _.chain(
    (await db.reviews.find().exec()) as ReviewDocument[],
  )
    .map((review) => [review.subject, review.number] as [string, string])
    .uniqBy((course) => course.join(" "))
    .value();

  const allScores = (
    await Promise.all(
      allCourses.map(([subject, number]) =>
        calcCourseScore(subject, number, context, lazy),
      ),
    )
  ).filter((score) => score) as CourseScoreObject[];

  const avgConfidence = _.meanBy(allScores, "confidence");
  const avgRatingContent = _.meanBy(allScores, "ratingContent");
  const avgRatingTeaching = _.meanBy(allScores, "ratingTeaching");
  const avgRatingGrading = _.meanBy(allScores, "ratingGrading");
  const avgRatingWorkload = _.meanBy(allScores, "ratingWorkload");

  return _.chain(allScores)
    .map((scoreObj) => ({
      ...scoreObj,
      bayesianRatingContent: averageBayesian(
        scoreObj.ratingContent,
        scoreObj.confidence,
        avgRatingContent,
        avgConfidence,
      ),
      bayesianRatingTeaching: averageBayesian(
        scoreObj.ratingTeaching,
        scoreObj.confidence,
        avgRatingTeaching,
        avgConfidence,
      ),
      bayesianRatingGrading: averageBayesian(
        scoreObj.ratingGrading,
        scoreObj.confidence,
        avgRatingGrading,
        avgConfidence,
      ),
      bayesianRatingWorkload: averageBayesian(
        scoreObj.ratingWorkload,
        scoreObj.confidence,
        avgRatingWorkload,
        avgConfidence,
      ),
    }))
    .value();
}

export async function calc(context: Context) {
  const allTermNumbers = _.chain(
    (await db.reviews.find().exec()) as ReviewDocument[],
  )
    .map((review) => review.termNumber)
    .push(context.termNumber)
    .sortBy((termNumber) => -termNumber)
    .uniq()
    .value();

  const allScores = (
    await Promise.all(
      allTermNumbers.map((termNumber) => {
        if (termNumber === context.termNumber) {
          return calcAllCoursesScore({ ...context, termNumber }, false);
        } else {
          return calcAllCoursesScore({ ...context, termNumber }, true);
        }
      }),
    )
  ).flat();

  return _.chain(allScores)
    .sortBy((scoreObj) => `${scoreObj.subject} ${scoreObj.number}`)
    .groupBy((scoreObj) => `${scoreObj.subject} ${scoreObj.number}`)
    .value();
}
