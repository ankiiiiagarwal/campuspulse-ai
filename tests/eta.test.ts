import { expect, it } from "vitest";
import { etaFromLocal, etaLocalFields } from "@/lib/eta";

it("accepts an exact local date and time more than 24 hours ahead", () => {
  const now = new Date(2030, 0, 1, 9).getTime();
  const expected = new Date(2030, 0, 8, 16, 45);
  expect(etaFromLocal("2030-01-08", "16:45", now)).toBe(expected.toISOString());
  expect(etaLocalFields(expected.toISOString())).toEqual({date:"2030-01-08",time:"16:45"});
});
it("rejects missing, impossible, and past selections", () => {
  const now = new Date(2030, 0, 1, 9).getTime();
  for (const [date,time] of [["","12:00"],["2030-01-02",""],["2030-02-30","12:00"],["2030-01-02","25:00"],["2030-01-01","08:59"]]) {
    expect(etaFromLocal(date,time,now)).toBeNull();
  }
});
it("prefills an existing ETA in local time and leaves missing ETAs blank", () => {
  const existing = new Date(2030, 6, 10, 0, 5);
  expect(etaLocalFields(existing.toISOString())).toEqual({date:"2030-07-10",time:"00:05"});
  expect(etaLocalFields(null)).toEqual({date:"",time:""});
});
