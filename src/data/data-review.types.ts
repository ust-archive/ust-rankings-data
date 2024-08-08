export type RawCourse = {
  subject: string;
  code: string;
  name: string;
};

export type RawReview = {
  hash: string;
  semester: string;
  instructors: RawInstructor[];
  rating_content: number;
  rating_teaching: number;
  rating_grading: number;
  rating_workload: number;
  upvote_count: number;
  vote_count: number;
};

export type RawInstructor = {
  name: string;
  rating: number;
};
