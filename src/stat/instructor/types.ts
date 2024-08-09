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
  confidence: number;

  individualRatingContent: number;
  individualRatingTeaching: number;
  individualRatingGrading: number;
  individualRatingWorkload: number;
  individualRatingInstructor: number;
  individualSamples: number;
  individualConfidence: number;

  bayesianRatingContent?: number;
  bayesianRatingTeaching?: number;
  bayesianRatingGrading?: number;
  bayesianRatingWorkload?: number;
  bayesianRatingInstructor?: number;
};

export type InstructorExtraObject = {
  instructor: string;
  historicalCourses: { subject: string; number: string }[];
  courses: { subject: string; number: string }[];
};

export type InstructorObject = {
  scores: InstructorScoreObject[];
} & InstructorExtraObject;
