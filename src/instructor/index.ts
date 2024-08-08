import { calc, InstructorScoreObject } from "./score.js";
import { generateExtra, InstructorExtraObject } from "./extra.js";
import { db } from "../data/index.js";
import _ from "lodash";
import * as fs from "fs/promises";

type InstructorObject = {
  instructor: string;
  scores: InstructorScoreObject[];
  rank: number;
  percentile: number;
  historicalCourses: Array<{ subject: string; number: string }>;
  courses: Array<{ subject: string; number: string }>;
} & InstructorExtraObject;

const currentTermNumber = _.chain(await db.cq.find().exec())
  .map((cq) => cq.termNumber)
  .max()
  .value();

const scoreObj = await calc({ currentTermNumber });
const extraObj = await generateExtra({ currentTermNumber });

const data = _.chain(scoreObj)
  .toPairs()
  .map(([instructor, scores], i) => {
    const extra = extraObj[instructor];
    return [
      instructor,
      {
        instructor,
        scores,
        ...extra,
        rank: i + 1,
        percentile: 1 - i / Object.keys(scoreObj).length,
      } satisfies InstructorObject,
    ];
  })
  .fromPairs()
  .value();

await fs.writeFile("data-instructor.json", JSON.stringify(data, null, 2));
