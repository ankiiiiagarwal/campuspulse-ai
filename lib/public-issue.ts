/** Embeddings are an internal merge hint — never send them to browsers. */
export function publicIssue<T extends { embedding?: unknown }>(issue: T): Omit<T, "embedding"> {
  const { embedding: _ignored, ...rest } = issue;
  return rest;
}

export function publicIssues<T extends { embedding?: unknown }>(issues: T[]): Array<Omit<T, "embedding">> {
  return issues.map(publicIssue);
}
