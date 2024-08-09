import * as mathjs from "mathjs";
import _ from "lodash";
import { db } from "../data/index.js";

export function average(numbers: number[], weights: number[]): number {
  if (numbers.length === 0 || weights.length === 0) {
    return NaN;
  }
  return mathjs.dot(numbers, weights) / mathjs.sum(weights);
}

export function averageBayesian(
  number: number,
  confidence: number,
  avgNumber: number,
  avgConfidence: number,
) {
  return (
    (number * confidence + avgNumber * avgConfidence) /
    (confidence + avgConfidence)
  );
}

export const currentTermNumber = _.chain(await db.cq.find().exec())
  .map((cq) => cq.termNumber)
  .max()
  .value();
