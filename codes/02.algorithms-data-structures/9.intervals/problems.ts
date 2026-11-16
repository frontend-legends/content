// Проверки к 2.09: сортировка интервалов по началу, слияние и вставка, жадный выбор по концу —
// примеры из условий и случайные тесты против решений «по точкам».
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/9.intervals
import { assert, fuzz, randArray, randInt } from '../_shared.ts';

// --- шаблон: пересекаются ли два отрезка ---
function overlaps([a1, b1]: number[], [a2, b2]: number[]): boolean {
  return a1 <= b2 && a2 <= b1;                    // начало каждого не позже конца другого
}

// --- 228. Summary Ranges ---
function summaryRanges(nums: number[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    const start = nums[i];
    while (i + 1 < nums.length && nums[i + 1] === nums[i] + 1) i++;
    result.push(start === nums[i] ? `${start}` : `${start}->${nums[i]}`);
  }
  return result;
}

// --- 56. Merge Intervals ---
function merge(intervals: number[][]): number[][] {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const result: number[][] = [];
  for (const [start, end] of sorted) {
    const last = result.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);   // пересекается — расширяем
    else result.push([start, end]);
  }
  return result;
}

// --- 57. Insert Interval ---
function insert(intervals: number[][], newInterval: number[]): number[][] {
  const result: number[][] = [];
  let [start, end] = newInterval;
  let i = 0;
  while (i < intervals.length && intervals[i][1] < start) result.push(intervals[i++]);   // целиком левее
  while (i < intervals.length && intervals[i][0] <= end) {                                // пересекаются — сливаем
    start = Math.min(start, intervals[i][0]);
    end = Math.max(end, intervals[i][1]);
    i++;
  }
  result.push([start, end]);
  while (i < intervals.length) result.push(intervals[i++]);                               // целиком правее
  return result;
}

// --- 452. Minimum Number of Arrows to Burst Balloons ---
function findMinArrowShots(points: number[][]): number {
  const sorted = [...points].sort((a, b) => a[1] - b[1]);   // по концу
  let arrows = 0;
  let shot = -Infinity;
  for (const [start, end] of sorted) {
    if (start > shot) {                           // текущая стрела не задевает — новая, в конец шарика
      arrows++;
      shot = end;
    }
  }
  return arrows;
}

// ===== проверки =====
assert.equal(overlaps([1, 3], [3, 5]), true);
assert.equal(overlaps([1, 2], [3, 5]), false);

// 228
assert.deepEqual(summaryRanges([0, 1, 2, 4, 5, 7]), ['0->2', '4->5', '7']);
assert.deepEqual(summaryRanges([0, 2, 3, 4, 6, 8, 9]), ['0', '2->4', '6', '8->9']);
assert.deepEqual(summaryRanges([]), []);
assert.deepEqual(summaryRanges([-2147483648, -2147483647, 2147483647]), ['-2147483648->-2147483647', '2147483647']);
fuzz(1000, () => [...new Set(randArray(randInt(0, 10), -5, 10))].sort((a, b) => a - b), (nums) => {
  const expanded = summaryRanges(nums).flatMap((r) => { const [a, b = a] = r.split('->').map(Number); return Array.from({ length: b - a + 1 }, (_, k) => a + k); });
  assert.deepEqual(expanded, nums);
});

// покрытые точки — для проверки слияния
const randIntervals = () => Array.from({ length: randInt(0, 7) }, () => { const a = randInt(0, 15); return [a, a + randInt(0, 4)]; });
const cover = (iv: number[][]) => { const s = new Set<number>(); for (const [a, b] of iv) for (let x = a * 2; x <= b * 2; x++) s.add(x); return [...s].sort((x, y) => x - y).join(','); };

// 56
assert.deepEqual(merge([[1, 3], [2, 6], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
assert.deepEqual(merge([[1, 4], [4, 5]]), [[1, 5]]);                                              // касаются — сливаются
assert.deepEqual(merge([[1, 4], [2, 3]]), [[1, 4]]);                                              // вложенный
fuzz(2000, randIntervals, (iv) => {
  const m = merge(iv);
  assert.equal(cover(m), cover(iv));                                                                // те же точки (с половинками)
  for (let i = 1; i < m.length; i++) assert.ok(m[i][0] > m[i - 1][1]);                             // не пересекаются и упорядочены
});

// 57
assert.deepEqual(insert([[1, 3], [6, 9]], [2, 5]), [[1, 5], [6, 9]]);
assert.deepEqual(insert([[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]), [[1, 2], [3, 10], [12, 16]]);
assert.deepEqual(insert([], [5, 7]), [[5, 7]]);
fuzz(2000, () => [merge(randIntervals()), (() => { const a = randInt(0, 15); return [a, a + randInt(0, 4)]; })()] as const, ([iv, n]) => {
  assert.deepEqual(insert(iv, n), merge([...iv, n]));
});

// 452
assert.equal(findMinArrowShots([[10, 16], [2, 8], [1, 6], [7, 12]]), 2);
assert.equal(findMinArrowShots([[1, 2], [3, 4], [5, 6], [7, 8]]), 4);
assert.equal(findMinArrowShots([[1, 2], [2, 3], [3, 4], [4, 5]]), 2);
assert.equal(findMinArrowShots([[-2147483646, -2147483645], [2147483646, 2147483647]]), 2);
fuzz(1000, () => Array.from({ length: randInt(1, 6) }, () => { const a = randInt(0, 8); return [a, a + randInt(0, 3)]; }), (pts) => {
  // перебор: минимальное число точек из множества концов, покрывающее все шарики
  const candidates = [...new Set(pts.map((p) => p[1]))];
  let best = Infinity;
  for (let mask = 1; mask < 1 << candidates.length; mask++) {
    const chosen = candidates.filter((_, i) => mask & (1 << i));
    if (pts.every(([a, b]) => chosen.some((x) => a <= x && x <= b))) best = Math.min(best, chosen.length);
  }
  assert.equal(findMinArrowShots(pts), best);
});

// метод событий из текста: сколько переговорок нужно (конец раньше начала при равном времени)
function minMeetingRooms(meetings: number[][]): number {
  const events = meetings.flatMap(([s, e]) => [[s, 1], [e, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let rooms = 0, best = 0;
  for (const [, delta] of events) { rooms += delta; best = Math.max(best, rooms); }
  return best;
}
assert.equal(minMeetingRooms([[0, 30], [5, 10], [15, 20]]), 2);
assert.equal(minMeetingRooms([[9, 10], [10, 11]]), 1);                                           // встык — одна переговорка
fuzz(1000, () => Array.from({ length: randInt(0, 7) }, () => { const a = randInt(0, 10); return [a, a + randInt(1, 4)]; }), (m) => {
  let best = 0;
  for (let t = 0; t <= 30; t += 0.5) best = Math.max(best, m.filter(([s, e]) => s <= t && t < e).length);
  assert.equal(minMeetingRooms(m), best);
});

console.log('intervals ok');
