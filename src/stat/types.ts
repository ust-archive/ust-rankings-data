export type Ratings =
  | "ratingContent"
  | "ratingTeaching"
  | "ratingGrading"
  | "ratingWorkload"
  | "ratingInstructor";

export const Ratings = [
  "ratingContent",
  "ratingTeaching",
  "ratingGrading",
  "ratingWorkload",
  "ratingInstructor",
] as const;

export type Context = {
  termNumber: number;
};
