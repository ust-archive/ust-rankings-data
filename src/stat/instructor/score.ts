/**
 * This file provides functions and types for calculating the score of an
 * instructor.
 */

import { Review, ReviewDocument } from "../../data/data-review.js";
import * as mathjs from "mathjs";
import _ from "lodash";
import { db } from "../../data/index.js";
import { Context, Ratings } from "../types.js";
import { InstructorScoreObject } from "./types.js";
import { average, averageBayesian } from "../utils.js";

function calcConfidence(review: Review, context: Context) {
  let weight = 1;

  let votes = review.upvoteCount - review.downvoteCount;
  if (votes > 0) {
    // positive means there are more upvotes than downvotes, i.e., the review is more helpful
    // the weight is increased by 25% for each upvote
    weight *= 1 + votes;
  }
  if (votes < 0) {
    // negative means there are more downvotes than upvotes, i.e., the review is less helpful
    // the weight is decreased by the following formula:
    votes = -votes;
    weight *= 1 / (votes + 1);
  }
  // zero means there are equal upvotes and downvotes, i.e., the review is neither very helpful nor very unhelpful
  if (votes === 0) {
    // the weight remains the same
  }

  // timeliness: the weight is decreased by 25% for each additional year
  const termDifference = context.termNumber - review.termNumber;
  weight *= Math.pow(1 - 0.25, termDifference / 4);

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
        selector: { instructor, termNumber: context.termNumber },
      })
      .exec();
    if (termReviewCount === 0) {
      return null;
    }
  }

  const reviews: ReviewDocument[] = await db.reviews
    .find({
      selector: { instructor, termNumber: { $lte: context.termNumber } },
    })
    .exec();
  const individualReviews: ReviewDocument[] = await db.reviews
    .find({
      selector: { instructor, termNumber: context.termNumber },
    })
    .exec();

  const confidenceVector = reviews.map((review) =>
    calcConfidence(review, context),
  );
  const individualConfidenceVector = individualReviews.map((review) =>
    calcConfidence(review, context),
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
    instructor,
    term: context.termNumber,
    ...ratings,
    samples: reviews.length,
    confidence: _.sum(confidenceVector),
    individualRatingContent: individualRatings.ratingContent,
    individualRatingTeaching: individualRatings.ratingTeaching,
    individualRatingGrading: individualRatings.ratingGrading,
    individualRatingWorkload: individualRatings.ratingWorkload,
    individualRatingInstructor: individualRatings.ratingInstructor,
    individualSamples: individualReviews.length,
    individualConfidence: _.sum(individualConfidenceVector),
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
    .push(context.termNumber)
    .sortBy((termNumber) => -termNumber)
    .uniq()
    .value();

  const allScores = (
    await Promise.all(
      allTermNumbers.map(async (termNumber) => {
        if (termNumber === context.termNumber) {
          return calcAllInstructorsScore({ termNumber }, false);
        } else {
          return calcAllInstructorsScore({ termNumber }, true);
        }
      }),
    )
  ).flat();

  return _.chain(allScores)
    .sortBy((scoreObj) => scoreObj.instructor)
    .groupBy((scoreObj) => scoreObj.instructor)
    .value();
}
