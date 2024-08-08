export function convertTerm(semester: string) {
  const [yearString, seasonString] = semester.split(" ");
  const year = yearString.slice(2, 4);
  const season = {
    Fall: "10",
    Winter: "20",
    Spring: "30",
    Summer: "40",
  }[seasonString];
  return year + season;
}

export function calcTermNumber(term: string) {
  return parseInt(term.slice(0, 2)) * 4 + (parseInt(term.slice(2, 3)) - 1);
}
