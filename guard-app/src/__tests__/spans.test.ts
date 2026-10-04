import { useI18n } from "../i18n";
import { makeTime } from "../domain/time";
import { duration, lateBy, relative } from "../ui/labels";

const tt = makeTime("Asia/Kolkata");
const now = Date.parse("2026-09-21T08:00:00Z");
const ago = (minutes: number) => relative(tt.relative(now - minutes * 60_000, now));

afterEach(() => useI18n.setState({ lang: "en" }));

test("a span past an hour reads in hours, not a pile of minutes", () => {
  expect(lateBy(8)).toBe("Late by 8 min");
  expect(lateBy(59)).toBe("Late by 59 min");
  expect(lateBy(60)).toBe("Late by 1h 00m");
  expect(lateBy(137)).toBe("Late by 2h 17m");
  expect(duration(137 * 60)).toBe("2h 17m");
});

test("'ago' climbs minutes to hours to days", () => {
  expect(ago(0)).toBe("just now");
  expect(ago(27)).toBe("27 min ago");
  expect(ago(59)).toBe("59 min ago");
  expect(ago(90)).toBe("1 h ago");
  expect(ago(23 * 60)).toBe("23 h ago");
  expect(ago(24 * 60)).toBe("1 d ago");
  expect(ago(5 * 24 * 60 + 30)).toBe("5 d ago");
});

test("a clock that has not ticked yet never reads as a negative span", () => {
  expect(relative(tt.relative(now + 5 * 60_000, now))).toBe("just now");
});

test("Hindi keeps the same shape", () => {
  useI18n.setState({ lang: "hi" });
  expect(lateBy(137)).toBe("2 घं 17 मि देर");
  expect(ago(24 * 60)).toBe("1 दिन पहले");
});
