import { calc } from "./score.js";
import { allExtraOf } from "./extra.js";
import _ from "lodash";
import * as fs from "fs/promises";
import { currentTermNumber } from "../utils.js";
import { Context } from "../types.js";
import { InstructorObject } from "./types.js";

const context: Context = { termNumber: currentTermNumber };

const scoreObj = await calc(context);
const extraObj = await allExtraOf(context);

const data = _.chain(scoreObj)
  .toPairs()
  .map(([instructor, scores]) => {
    const extra = extraObj[instructor];
    return [
      instructor,
      {
        scores,
        ...extra,
      } satisfies InstructorObject,
    ];
  })
  .fromPairs()
  .value();

await fs.writeFile("data-instructor.json", JSON.stringify(data, null, 2));
