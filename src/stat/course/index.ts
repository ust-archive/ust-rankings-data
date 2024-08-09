import { calc } from "./score.js";
import fs from "fs/promises";
import { allExtras } from "./extra.js";
import { currentTermNumber } from "../utils.js";
import _ from "lodash";
import { Context } from "../types.js";
import { CourseObject } from "./types.js";

const context: Context = { termNumber: currentTermNumber };

const courseScoreObjects = await calc(context);
const courseExtraObjects = await allExtras(context);

const data = _.chain(courseScoreObjects)
  .toPairs()
  .map(([course, scores]) => {
    const extra = courseExtraObjects[course];
    return [
      course,
      {
        scores,
        ...extra,
      } satisfies CourseObject,
    ];
  })
  .fromPairs()
  .value();

await fs.writeFile("data-course.json", JSON.stringify(data, null, 2));
