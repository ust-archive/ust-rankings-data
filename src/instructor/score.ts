/**
 * This file provides functions and types for calculating the score of an
 * instructor.
 */

import { Review, ReviewDocument } from "../data/data-review.js";
import { Context } from "../score/types.js";
import * as mathjs from "mathjs";
import _ from "lodash";
import { db } from "../data/index.js";
import { averageBayesian } from "./utils.js";

/**
 * Represents the score of an instructor at a specific term.
 *
 * The score is calculated based on certain context. However, the context is
 * specified a priori, and is not specified in this type.
 */
export type InstructorScoreObject = {
  instructor: string;
  term: number;

  ratingContent: number;
  ratingTeaching: number;
  ratingGrading: number;
  ratingWorkload: number;
  ratingInstructor: number;
  samples: number;

  individualRatingContent: number;
  individualRatingTeaching: number;
  individualRatingGrading: number;
  individualRatingWorkload: number;
  individualRatingInstructor: number;
  individualSamples: number;

  bayesianRatingContent?: number;
  bayesianRatingTeaching?: number;
  bayesianRatingGrading?: number;
  bayesianRatingWorkload?: number;
  bayesianRatingInstructor?: number;

  confidence: number;
};

type RatingType =
  | "ratingContent"
  | "ratingTeaching"
  | "ratingGrading"
  | "ratingWorkload"
  | "ratingInstructor";
const RatingTypes = [
  "ratingContent",
  "ratingTeaching",
  "ratingGrading",
  "ratingWorkload",
  "ratingInstructor",
] as const;

function calcConfidence(review: Review, context: Context) {
  let weight = 1;

  const termDifference = context.currentTermNumber - review.termNumber;
  if (termDifference > 4 * 2) {
    // If the review is too old (more than 2 years),
    // the weight is decreased by 25% for each additional year
    weight *= Math.pow(1 - 0.25, (termDifference - 4 * 2) / 4);
  }

  return weight;
}

async function calcInstructorScore(
  instructor: string,
  context: Context,
  lazy: boolean = false,
): Promise<InstructorScoreObject | null> {
  if (lazy) {
    const termReviewCount = await db.reviews
      .count({
        selector: { instructor, termNumber: context.currentTermNumber },
      })
      .exec();
    if (termReviewCount === 0) {
      return null;
    }
  }

  const reviews: ReviewDocument[] = await db.reviews
    .find({
      selector: { instructor, termNumber: { $lte: context.currentTermNumber } },
    })
    .exec();

  if (reviews.length === 0) {
    return {
      instructor,
      term: context.currentTermNumber,
      ratingContent: NaN,
      ratingTeaching: NaN,
      ratingGrading: NaN,
      ratingWorkload: NaN,
      ratingInstructor: NaN,
      individualRatingContent: NaN,
      individualRatingTeaching: NaN,
      individualRatingGrading: NaN,
      individualRatingWorkload: NaN,
      individualRatingInstructor: NaN,
      individualSamples: 0,
      confidence: 0,
      samples: 0,
    };
  }

  const individualReviews: ReviewDocument[] = await db.reviews
    .find({
      selector: { instructor, termNumber: context.currentTermNumber },
    })
    .exec();

  const confidenceVector = reviews.map((review) =>
    calcConfidence(review, context),
  );

  const ratings = Object.fromEntries(
    RatingTypes.map((type) => {
      const ratingVector = reviews.map((review) => review[type]);
      const average =
        mathjs.dot(ratingVector, confidenceVector) /
        mathjs.sum(confidenceVector);
      return [type, average] as [RatingType, number];
    }),
  ) as Record<RatingType, number>;

  return {
    instructor,
    term: context.currentTermNumber,
    ...ratings,
    individualRatingContent: _.meanBy(individualReviews, "ratingContent"),
    individualRatingTeaching: _.meanBy(individualReviews, "ratingTeaching"),
    individualRatingGrading: _.meanBy(individualReviews, "ratingGrading"),
    individualRatingWorkload: _.meanBy(individualReviews, "ratingWorkload"),
    individualRatingInstructor: _.meanBy(individualReviews, "ratingInstructor"),
    individualSamples: individualReviews.length,
    confidence: mathjs.sum(confidenceVector),
    samples: reviews.length,
  };
}

async function calcAllInstructorsScore(
  context: Context,
  lazy: boolean = false,
) {
  const allInstructors: string[] = _.chain(
    (await db.reviews.find().exec()) as ReviewDocument[],
  )
    .map((review) => review.instructor)
    .uniq()
    .value();

  const allScores = (
    await Promise.all(
      allInstructors.map((instructor) =>
        calcInstructorScore(instructor, context, lazy),
      ),
    )
  ).filter((score) => score) as InstructorScoreObject[];

  const avgConfidence = mathjs.mean(
    allScores.map((scoreObj) => scoreObj.confidence),
  );
  const avgRatingContent = mathjs.mean(
    allScores.map((scoreObj) => scoreObj.ratingContent),
  );
  const avgRatingTeaching = mathjs.mean(
    allScores.map((scoreObj) => scoreObj.ratingTeaching),
  );
  const avgRatingGrading = mathjs.mean(
    allScores.map((scoreObj) => scoreObj.ratingGrading),
  );
  const avgRatingWorkload = mathjs.mean(
    allScores.map((scoreObj) => scoreObj.ratingWorkload),
  );
  const avgRatingInstructor = mathjs.mean(
    allScores.map((scoreObj) => scoreObj.ratingInstructor),
  );

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
      bayesianRatingInstructor: averageBayesian(
        scoreObj.ratingInstructor,
        scoreObj.confidence,
        avgRatingInstructor,
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
    .push(context.currentTermNumber)
    .sortBy((termNumber) => -termNumber)
    .uniq()
    .value();

  const allScores = (
    await Promise.all(
      allTermNumbers.map(async (termNumber) => {
        if (termNumber === context.currentTermNumber) {
          return calcAllInstructorsScore(
            { currentTermNumber: termNumber },
            false,
          );
        } else {
          return calcAllInstructorsScore(
            { currentTermNumber: termNumber },
            true,
          );
        }
      }),
    )
  ).flat();

  return _.chain(allScores)
    .groupBy((scoreObj) => scoreObj.instructor)
    .value();
}
