import fs from 'fs/promises';
import * as math from 'mathjs';
import {type InstructorRatingObj, parseSemester, preprocess, type Rating} from './data.js';

export const EPOCH_SEMESTER = parseSemester('2012-13 Fall');
export const THIS_SEMESTER = parseSemester('2023-24 Spring');

// This alpha value gives a half-life of 2 years (8 semesters).
// In other words, 50% of the result comes from the last 2 years
// This is a reasonable value as we focus on instructors' recent performance.
// That could give more practical results.
export const EWMA_SMOOTHING_FACTOR = 0.08425;

function ewma(ratings: Rating[], alpha: number) {
  const now = THIS_SEMESTER;

  function weightOf(semester: number) {
    return alpha * ((1 - alpha) ** (now - semester));
  }

  const sumOfWeights = math.sum(ratings.map(({semester}) => weightOf(semester)));
  const sum = math.sum(ratings.map(({rating, semester}) => weightOf(semester) * rating));

  return sum / sumOfWeights;
}

export type WithAverage = {
  teachRating: number;
  thumbRating: number;
};

function calcAverage(
  irObjs: InstructorRatingObj[],
): Array<InstructorRatingObj & WithAverage> {
  const iraObjs = irObjs.map(it => it as InstructorRatingObj & WithAverage);
  iraObjs.forEach(it => {
    it.teachRating = ewma(it.teachRatings, EWMA_SMOOTHING_FACTOR);
    it.thumbRating = ewma(it.thumbRatings, EWMA_SMOOTHING_FACTOR);
  });
  return iraObjs;
}

export type WithOverall = {
  overallRating: number;
};

function calcOverall(
  iraobjs: Array<InstructorRatingObj & WithAverage>,
): Array<InstructorRatingObj & WithAverage & WithOverall> {
  const iraoObjs = iraobjs.map(it => it as InstructorRatingObj & WithAverage & WithOverall);
  iraoObjs.forEach(it => {
    it.overallRating = (it.teachRating + it.thumbRating) / 2;
  });
  return iraoObjs;
}

export type WithScore = {
  score: number;
};

function calcScore(
  iraoObjs: Array<InstructorRatingObj & WithAverage & WithOverall>,
): Array<InstructorRatingObj & WithAverage & WithOverall & WithScore> {
  const minRating = math.min(iraoObjs.map(({overallRating}) => overallRating));
  const maxRating = math.max(iraoObjs.map(({overallRating}) => overallRating));
  const meanRating = math.mean(iraoObjs.map(({overallRating}) => overallRating));
  const linearMeanRating = (meanRating - minRating) / (maxRating - minRating);
  const meanSamples = math.mean(iraoObjs.map(({samples}) => samples));
  const iraosObjs = iraoObjs.map(it => it as InstructorRatingObj & WithAverage & WithOverall & WithScore);
  iraosObjs.forEach(it => {
    const {samples} = it;
    const linearRating = (it.overallRating - minRating) / (maxRating - minRating);
    it.score = ((meanSamples * linearMeanRating) + (samples * linearRating)) / (meanSamples + samples);
  });
  return iraosObjs;
}

export type WithRanking = {
  ranking: number;
};

function calcRanking(
  iraosObjs: Array<InstructorRatingObj & WithAverage & WithOverall & WithScore>,
): Array<InstructorRatingObj & WithAverage & WithOverall & WithScore & WithRanking> {
  const iraosrObjs = iraosObjs.map(it => it as
    InstructorRatingObj &
    WithAverage &
    WithOverall &
    WithScore &
    WithRanking,
  );

  // Sort the objects by score in descending order
  const sortedObjs = iraosrObjs.toSorted((a, b) => b.score - a.score);

  // Initialize the ranking and previous score
  let ranking = 1;
  let prevScore = -1;

  // Map the sorted objects to objects with a ranking field
  sortedObjs.forEach((it, i) => {
    // If the current object's score is different from the previous score,
    // update the ranking
    if (prevScore !== it.score) {
      ranking = i + 1;
    }

    // Update the previous score
    prevScore = it.score;

    it.ranking = ranking;
  });

  return iraosrObjs;
}

export type WithGrade = {
  percentile: number;
  grade: string;
};

function calcGrade(
  iraosObjs: Array<InstructorRatingObj & WithAverage & WithOverall & WithScore & WithRanking>,
): Array<InstructorRatingObj & WithAverage & WithOverall & WithScore & WithRanking & WithGrade> {
  const MAPPING = new Map([
    [0.90, 'A+'],
    [0.80, 'A'],
    [0.75, 'A-'],
    [0.60, 'B+'],
    [0.45, 'B'],
    [0.35, 'B-'],
    [0.30, 'C+'],
    [0.25, 'C'],
    [0.20, 'C-'],
    [0.10, 'D'],
    [0.00, 'F'],
  ]);

  const iraosgObjs = iraosObjs.map(it => it as
    InstructorRatingObj &
    WithAverage &
    WithOverall &
    WithScore &
    WithRanking &
    WithGrade,
  );

  function assignGrade(percentile: number, mapping: Map<number, string>): string {
    const m = [...mapping.entries()].sort(([a], [b]) => b - a);
    for (const [cutoff, grade] of m) {
      if (percentile >= cutoff) {
        return grade;
      }
    }

    throw new Error(`Invalid mapping ${JSON.stringify(mapping)} for percentile ${percentile}`);
  }

  iraosgObjs.forEach(it => {
    it.percentile = (iraosgObjs.length - it.ranking + 1) / iraosgObjs.length;
    it.grade = assignGrade(it.percentile, MAPPING);
  });
  return iraosgObjs;
}

async function main() {
  console.log('Preprocessing Data... ');
  const data = await preprocess();

  console.log('Calculating Average...');
  const avgData = calcAverage(data);

  console.log('Calculating Overall...');
  const overallData = calcOverall(avgData);

  console.log('Calculating Score...');
  const scoreData = calcScore(overallData);

  console.log('Calculating Ranking...');
  const rankingData = calcRanking(scoreData);

  console.log('Calculating Grade...');
  const gradeData = calcGrade(rankingData);

  const outputData = gradeData;

  await fs.writeFile('ust-rankings.json', JSON.stringify(outputData, null, 2));

  console.log('Done! Written to ust-rankings.json.');
}

await main();
