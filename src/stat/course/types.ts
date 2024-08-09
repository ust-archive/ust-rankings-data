export type CourseScoreObject = {
  subject: string;
  number: string;
  term: number;

  ratingContent: number;
  ratingTeaching: number;
  ratingGrading: number;
  ratingWorkload: number;
  samples: number;
  confidence: number;

  individualRatingContent: number;
  individualRatingTeaching: number;
  individualRatingGrading: number;
  individualRatingWorkload: number;
  individualSamples: number;
  individualConfidence: number;

  bayesianRatingContent?: number;
  bayesianRatingTeaching?: number;
  bayesianRatingGrading?: number;
  bayesianRatingWorkload?: number;
};

export type CourseExtraObject = {
  subject: string;
  number: string;
  terms: number[];
  instructors: string[];
  historicalInstructors: string[];
};

export type CourseObject = {
  scores: CourseScoreObject[];
} & CourseExtraObject;
