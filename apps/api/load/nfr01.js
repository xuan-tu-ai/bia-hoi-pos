// NFR-01: API phản hồi ≤ 500 ms (p95) với 3 máy quầy + 80 bàn đang mở.
// Chạy trên dữ liệu demo (sẽ mở hết bàn và thêm lượt gọi; seed lại sau khi chạy):
//   docker run --rm -i --network projectquanlyduancntt_default -e BASE_URL=http://api:3000 grafana/k6:0.55.0 run - < apps/api/load/nfr01.js
// hoặc với k6 cài sẵn: k6 run -e BASE_URL=http://127.0.0.1:3000 apps/api/load/nfr01.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:3000';
const DURATION = __ENV.DURATION || '60s';

export const options = {
  scenarios: {
    // 3 máy quầy thao tác liên tục, nghỉ 1–3 giây giữa các thao tác như người thật
    counters: { executor: 'constant-vus', vus: 3, duration: DURATION, exec: 'counter' },
    // dashboard của chủ quán làm mới định kỳ
    owner: { executor: 'constant-vus', vus: 1, duration: DURATION, exec: 'owner' },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
};

const json = (token) => ({ headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } });

export function setup() {
  const counter = http.post(`${BASE}/auth/pin`, JSON.stringify({ pin: '1111' }), { headers: { 'content-type': 'application/json', 'x-device-key': 'k6' } }).json('token');
  const owner = http.post(`${BASE}/auth/login`, JSON.stringify({ email: 'chuquan@biahoi.vn', password: 'chuquan123' }), json()).json('token');

  // Mở mọi bàn còn trống để có đủ 80 bàn đang mở
  const areas = http.get(`${BASE}/areas?include=tables`, json(counter)).json();
  for (const area of areas) for (const t of area.tables) if (!t.tab) http.post(`${BASE}/tabs`, JSON.stringify({ tableId: t.id, guestCount: 4 }), json(counter));
  const open = http.get(`${BASE}/areas?include=tables`, json(counter)).json().flatMap((a) => a.tables).filter((t) => t.tab);
  const items = http.get(`${BASE}/menu-items`, json(counter)).json().filter((i) => i.available).map((i) => i.id);
  console.log(`Bàn đang mở: ${open.length}, món: ${items.length}`);
  return { counter, owner, tabIds: open.map((t) => t.tab.id), items };
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function counter(data) {
  const auth = json(data.counter);
  const map = http.get(`${BASE}/areas?include=tables`, { ...auth, tags: { name: 'GET /areas?include=tables' } });
  check(map, { 'sơ đồ 80 bàn': (r) => r.status === 200 && r.json().reduce((n, a) => n + a.tables.length, 0) === 80 });

  const tabId = pick(data.tabIds);
  const detail = http.get(`${BASE}/tabs/${tabId}`, { ...auth, tags: { name: 'GET /tabs/:id' } });
  check(detail, { 'chi tiết phiên': (r) => r.status === 200 });

  const round = http.post(
    `${BASE}/tabs/${tabId}/rounds`,
    JSON.stringify({ items: [{ itemId: pick(data.items), qty: 1 + Math.floor(Math.random() * 3) }, { itemId: pick(data.items), qty: 1 }] }),
    { ...auth, tags: { name: 'POST /tabs/:id/rounds' } },
  );
  check(round, { 'gửi lượt gọi': (r) => r.status === 201 });

  if (Math.random() < 0.2) {
    const bill = http.post(`${BASE}/tabs/${tabId}/provisional`, null, { ...auth, tags: { name: 'POST /tabs/:id/provisional' } });
    check(bill, { 'in tạm tính': (r) => r.status === 200 });
  }
  sleep(1 + Math.random() * 2);
}

export function owner(data) {
  const res = http.get(`${BASE}/reports/today`, { ...json(data.owner), tags: { name: 'GET /reports/today' } });
  check(res, { dashboard: (r) => r.status === 200 });
  sleep(5);
}
