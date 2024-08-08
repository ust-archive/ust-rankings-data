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
