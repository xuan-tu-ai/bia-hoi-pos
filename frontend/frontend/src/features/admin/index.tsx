import { useMemo, useState, type ChangeEvent, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { formatMoney } from '../../lib/format.ts';
import { ADJUSTMENT_REASONS } from '../../types/index.ts';

const money = formatMoney;

type FieldType = 'text' | 'number' | 'date' | 'time' | 'password' | 'select';
type FeatureField = [label: string, name: string, type?: FieldType, options?: string[]];
type FeatureRecord = Record<string, string | number>;
interface DatasetTab {
  id: string;
  label: string;
  columns: string[];
  fields: FeatureField[];
  rows: FeatureRecord[];
}
interface DatasetConfig {
  title: string;
  subtitle: string;
  tabs: DatasetTab[];
}

const datasets: Record<string, DatasetConfig> = {
  menu: {
    title: 'Thực đơn & khu chế biến',
    subtitle: 'FR-11 · Quản lý món, nhóm món và khu chế biến',
    tabs: [
      { id: 'items', label: 'Món ăn', columns: ['Tên món', 'Mã tắt', 'Nhóm', 'Giá bán', 'Khu chế biến', 'Trạng thái'], fields: [['Tên món', 'name'], ['Mã tắt', 'shortcut'], ['Nhóm', 'category'], ['Giá bán (₫)', 'price', 'number'], ['Khu chế biến', 'station'], ['Là bia hơi', 'isDraftBeer', 'select', ['Không', 'Có']], ['Thể tích (ml)', 'volume', 'number'], ['Vòi mặc định', 'tap'], ['Trạng thái', 'status', 'select', ['Còn món', 'Hết món', 'Ẩn']]], rows: [
        { name: 'Bia hơi cốc 0,5L', shortcut: 'b', category: 'Bia', price: 15000, station: 'Quầy rót bia', status: 'Còn món' },
        { name: 'Bia hơi ca 1,5L', shortcut: 'bc', category: 'Bia', price: 42000, station: 'Quầy rót bia', status: 'Còn món' },
        { name: 'Mực nướng', shortcut: 'mn', category: 'Đồ nướng', price: 135000, station: 'Bếp nướng', status: 'Còn món' },
        { name: 'Ngô chiên bơ', shortcut: 'nc', category: 'Đồ chiên', price: 55000, station: 'Bếp chiên', status: 'Hết món' }
      ] },
      { id: 'groups', label: 'Nhóm món', columns: ['Tên nhóm', 'Thứ tự', 'Số món', 'Trạng thái'], fields: [['Tên nhóm', 'name'], ['Thứ tự', 'order', 'number'], ['Số món', 'count', 'number']], rows: [
        { name: 'Bia', order: 1, count: 6, status: 'Đang dùng' }, { name: 'Đồ nướng', order: 2, count: 8, status: 'Đang dùng' }, { name: 'Đồ chiên', order: 3, count: 5, status: 'Đang dùng' }, { name: 'Đồ nhắm', order: 4, count: 9, status: 'Đang dùng' }
      ] },
      { id: 'stations', label: 'Khu chế biến', columns: ['Tên khu', 'Số món phụ trách', 'Trạng thái'], fields: [['Tên khu', 'name'], ['Số món phụ trách', 'count', 'number']], rows: [
        { name: 'Quầy rót bia', count: 6, status: 'Đang dùng' }, { name: 'Bếp nướng', count: 8, status: 'Đang dùng' }, { name: 'Bếp chiên', count: 5, status: 'Đang dùng' }
      ] }
    ]
  },
  areas: {
    title: 'Khu & bàn',
    subtitle: 'FR-12 · Cấu hình khu vực và sơ đồ bàn',
    tabs: [
      { id: 'areas', label: 'Khu vực', columns: ['Tên khu', 'Số bàn', 'Thứ tự', 'Trạng thái'], fields: [['Tên khu', 'name'], ['Số bàn', 'tables', 'number'], ['Thứ tự', 'order', 'number']], rows: [
        { name: 'Trong nhà', tables: 30, order: 1, status: 'Đang dùng' }, { name: 'Sân vườn', tables: 30, order: 2, status: 'Đang dùng' }, { name: 'Tầng 2', tables: 20, order: 3, status: 'Đang dùng' }
      ] },
      { id: 'tables', label: 'Bàn', columns: ['Mã bàn', 'Khu vực', 'Sức chứa', 'Trạng thái'], fields: [['Mã bàn', 'name'], ['Khu vực', 'area'], ['Sức chứa', 'capacity', 'number']], rows: [
        { name: 'Bàn 01', area: 'Trong nhà', capacity: 6, status: 'Trống' }, { name: 'Bàn 02', area: 'Trong nhà', capacity: 8, status: 'Đang phục vụ' }, { name: 'Bàn 31', area: 'Sân vườn', capacity: 10, status: 'Trống' }
      ] }
    ]
  },
  staff: {
    title: 'Quản lý nhân viên',
    subtitle: 'FR-13 · Tài khoản, vai trò và trạng thái nhân viên',
    tabs: [{ id: 'staff', label: 'Nhân viên', columns: ['Họ tên', 'Email', 'Vai trò', 'Trạng thái'], fields: [['Họ tên', 'name'], ['Email', 'email'], ['Mật khẩu mới (nếu tạo/đặt lại)', 'password', 'password'], ['Vai trò', 'role', 'select', ['Nhân viên quầy', 'Quản lý ca', 'Chủ quán']], ['PIN duyệt (quản lý/chủ quán)', 'pin', 'password'], ['Trạng thái', 'status', 'select', ['Hoạt động', 'Đã khóa']]], rows: [
      { name: 'Nguyễn Thị Lan', email: 'lan@biahoi.vn', role: 'Nhân viên quầy', status: 'Hoạt động' },
      { name: 'Trần Văn Minh', email: 'minh@biahoi.vn', role: 'Nhân viên quầy', status: 'Hoạt động' },
      { name: 'Lê Văn Hùng', email: 'hung@biahoi.vn', role: 'Quản lý ca', status: 'Hoạt động' },
      { name: 'Phạm Thị Hoa', email: 'hoa@biahoi.vn', role: 'Chủ quán', status: 'Hoạt động' },
      { name: 'Đỗ Minh Khoa', email: 'khoa@biahoi.vn', role: 'Nhân viên quầy', status: 'Đã khóa' }
    ] }]
  },
  kegs: {
    title: 'Nhập kho keg',
    subtitle: 'FR-14 · Theo dõi keg trong kho, đang dùng và đã hết',
    tabs: [{ id: 'kegs', label: 'Danh sách keg', columns: ['Mã keg', 'Loại bia', 'Dung tích', 'Giá nhập', 'Ngày nhập', 'Trạng thái'], fields: [['Loại bia', 'beer'], ['Dung tích (L)', 'capacity', 'select', ['30', '50']], ['Giá nhập (₫)', 'cost', 'number'], ['Ngày nhập', 'date', 'date'], ['Số lượng nhập', 'quantity', 'number']], rows: [
      { name: 'KEG-0008', beer: 'Bia hơi Hà Nội', capacity: '50 L', cost: 1250000, date: '10/11/2026', status: 'Đang dùng' },
      { name: 'KEG-0009', beer: 'Bia hơi Hà Nội', capacity: '50 L', cost: 1250000, date: '10/11/2026', status: 'Trong kho' },
      { name: 'KEG-0010', beer: 'Bia hơi Hải Phòng', capacity: '30 L', cost: 920000, date: '09/11/2026', status: 'Trong kho' },
      { name: 'KEG-0007', beer: 'Bia hơi Hà Nội', capacity: '50 L', cost: 1200000, date: '06/11/2026', status: 'Đã hết' }
    ] }]
  },
  happyHours: {
    title: 'Giá giờ vàng',
    subtitle: 'FR-15 · Thiết lập khung giờ và giá ưu đãi',
    tabs: [{ id: 'happy-hours', label: 'Khung giờ', columns: ['Tên chương trình', 'Ngày áp dụng', 'Thời gian', 'Món áp dụng', 'Giá ưu đãi', 'Trạng thái'], fields: [['Tên chương trình', 'name'], ['Ngày áp dụng (vd: T2–T6)', 'days'], ['Bắt đầu', 'start', 'time'], ['Kết thúc', 'end', 'time'], ['Món áp dụng', 'item'], ['Giá ưu đãi (₫)', 'price', 'number'], ['Trạng thái', 'status', 'select', ['Đang bật', 'Đã tắt']]], rows: [
      { name: 'Ưu đãi đầu giờ', days: 'Thứ 2 – Thứ 6', start: '16:00', end: '18:00', item: 'Bia hơi cốc 0,5L', price: 12000, status: 'Đang bật' },
      { name: 'Giờ vàng cuối tuần', days: 'Thứ 7 – Chủ nhật', start: '14:00', end: '16:00', item: 'Bia hơi ca 1,5L', price: 38000, status: 'Đã tắt' }
    ] }]
  },
  voids: {
    title: 'Nhật ký hủy / giảm',
    subtitle: 'FR-18 · Theo dõi thao tác điều chỉnh món và hóa đơn',
    tabs: [{ id: 'voids', label: 'Nhật ký', columns: ['Thời gian', 'Bàn', 'Món', 'Số lượng', 'Số tiền', 'Loại', 'Lý do', 'Người yêu cầu / duyệt'], fields: [], rows: [
      { name: '10/11/2026 16:42', table: 'Bàn 12', item: 'Khoai tây chiên', quantity: '−1', amount: 45000, type: 'Hủy', reason: 'Khách đổi ý', staff: 'Minh Anh / Hoàng Nam' },
      { name: '10/11/2026 15:18', table: 'Bàn 08', item: 'Mực nướng', quantity: '−10%', amount: 13500, type: 'Giảm giá', reason: 'Món lỗi', staff: 'Minh Anh / Hoàng Nam' },
      { name: '10/11/2026 14:06', table: 'Bàn 23', item: 'Hóa đơn', quantity: '−5%', amount: 32000, type: 'Giảm hóa đơn', reason: 'Khác', note: 'Ưu đãi chăm sóc khách hàng', staff: 'Hoàng Nam / —' }
    ] }]
  },
  topItems: {
    title: 'Món bán chạy & giờ cao điểm',
    subtitle: 'FR-19 · Thống kê theo thời điểm thanh toán (tối đa 31 ngày)',
    tabs: [{ id: 'top-items', label: 'Báo cáo', columns: ['#', 'Món', 'Số lượng', 'Doanh thu', 'Tỷ trọng'], fields: [], rows: [
      { rank: 1, name: 'Bia hơi cốc 0,5L', quantity: '1.284', amount: 19260000, share: '26%' },
      { rank: 2, name: 'Mực nướng', quantity: '186', amount: 25110000, share: '18%' },
      { rank: 3, name: 'Bia hơi ca 1,5L', quantity: '430', amount: 18060000, share: '16%' },
      { rank: 4, name: 'Đậu phụ chiên', quantity: '302', amount: 13590000, share: '12%' },
      { rank: 5, name: 'Dồi sụn nướng', quantity: '144', amount: 12240000, share: '9%' },
      { rank: 6, name: 'Ngô chiên bơ', quantity: '212', amount: 11660000, share: '8%' },
      { rank: 7, name: 'Lạc rang', quantity: '408', amount: 10200000, share: '7%' },
      { rank: 8, name: 'Bia hơi tháp 3L', quantity: '52', amount: 9360000, share: '6%' },
      { rank: 9, name: 'Nem chua rán', quantity: '118', amount: 8260000, share: '5%' },
      { rank: 10, name: 'Dưa chuột', quantity: '154', amount: 6160000, share: '3%' }
    ] }]
  }
};

const displayValue = (value: string | number | undefined) => typeof value === 'number' && value >= 1000 ? money(value) : value;
const tableFields: Record<string, string[]> = {
  items: ['name', 'shortcut', 'category', 'price', 'station', 'status'],
  groups: ['name', 'order', 'count', 'status'],
  stations: ['name', 'count', 'status'],
  areas: ['name', 'tables', 'order', 'status'],
  tables: ['name', 'area', 'capacity', 'status'],
  staff: ['name', 'email', 'role', 'status'],
  kegs: ['name', 'beer', 'capacity', 'cost', 'date', 'status'],
  'happy-hours': ['name', 'days', 'hours', 'item', 'price', 'status'],
  voids: ['name', 'table', 'item', 'quantity', 'amount', 'type', 'reason', 'staff'],
  'top-items': ['rank', 'name', 'quantity', 'amount', 'share']
};

interface FeaturePagesProps {
  view: string;
  onToast: (message: string) => void;
}

export function AdminPage({ view, onToast }: FeaturePagesProps) {
  const config = datasets[view];
  if (!config || view === 'voids' || view === 'topItems') return null;
  return <RecordsPage key={view} config={config} onToast={onToast} />;
}

export function ReportRecords({ view, onToast }: FeaturePagesProps) {
  const config = datasets[view];
  if (!config || (view !== 'voids' && view !== 'topItems')) return null;
  return <RecordsPage key={view} config={config} onToast={onToast} filters />;
}

function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">Giao diện theo đặc tả</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric-card"><div className="metric-top">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">Dữ liệu minh họa</div></article>;
}

function RecordsPage({ config, onToast, filters = false }: { config: DatasetConfig; onToast: (message: string) => void; filters?: boolean }) {
  const [tabId, setTabId] = useState(config.tabs[0].id);
  const [records, setRecords] = useState<Record<string, FeatureRecord[]>>(() => Object.fromEntries(config.tabs.map((tab) => [tab.id, tab.rows])));
  const [editing, setEditing] = useState<{ index?: number; record?: FeatureRecord } | null>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('quantity');
  const [dateError, setDateError] = useState('');
  const activeTab = config.tabs.find((tab) => tab.id === tabId) ?? config.tabs[0];
  const visibleRecords = useMemo(() => {
    const filtered = records[tabId].filter((record) => Object.values(record).join(' ').toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
    if (config.title.includes('Món bán')) {
      const numericValue = (record: FeatureRecord) => sortBy === 'quantity' ? Number(String(record[sortBy]).replaceAll('.', '')) : Number(record[sortBy]);
      return filtered.slice().sort((left, right) => numericValue(right) - numericValue(left));
    }
    return filtered;
  }, [config.title, query, records, sortBy, tabId]);

  const saveRecord = (record: FeatureRecord) => {
    setRecords((current) => {
      const currentRows = current[tabId];
      if (editing?.index !== undefined) return { ...current, [tabId]: currentRows.map((row, index) => index === editing.index ? { ...row, ...record } : row) };
      return { ...current, [tabId]: [{ ...record, status: record.status || 'Đang dùng' }, ...currentRows] };
    });
    onToast(editing?.index !== undefined ? 'Đã cập nhật dữ liệu giao diện.' : 'Đã thêm dữ liệu mẫu.');
    setEditing(null);
  };

  return <main className="page-content feature-content">
    <PageHeading title={config.title} subtitle={config.subtitle} action={activeTab.fields.length > 0 && <button className="button-primary" type="button" onClick={() => setEditing({})}><i className="icon fa-solid fa-plus" aria-hidden="true" />Thêm mới</button>} />
    {filters && <div className="feature-filters panel">{config.title.includes('Món bán') ? <>
      <label>Từ ngày<input id="report-from" type="date" defaultValue="2026-11-01" onChange={() => validateReportPeriod(setDateError)} /></label><label>Đến ngày<input id="report-to" type="date" defaultValue="2026-11-10" onChange={() => validateReportPeriod(setDateError)} /></label><label>Xếp theo<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="quantity">Số lượng</option><option value="amount">Doanh thu</option></select></label><p className="form-error" role="alert">{dateError}</p>
    </> : <>
      <label>Từ ngày<input type="date" defaultValue="2026-11-01" /></label><label>Đến ngày<input type="date" defaultValue="2026-11-10" /></label><label>Nhân viên<input type="search" placeholder="Tất cả" /></label><label>Người duyệt<input type="search" placeholder="Tất cả" /></label><label>Lý do<select defaultValue=""><option value="">Tất cả lý do</option>{ADJUSTMENT_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
    </>}</div>}
    {config.title.includes('Nhật ký') && <section className="report-metrics"><Metric label="Số lần hủy / giảm" value="3" /><Metric label="Tổng tiền điều chỉnh" value={money(90500)} /><Metric label="Người yêu cầu" value="2 nhân viên" /><Metric label="Khoảng thời gian" value="01/11 – 10/11" /></section>}
    {config.title.includes('Món bán') && <TopItemsCharts />}
    {config.title.includes('Nhân viên') && <p className="feature-note">Mật khẩu và PIN chỉ nhập khi tạo mới/đặt lại. Bản demo không lưu thông tin bí mật; backend cần băm bcrypt, chặn tự khóa và bảo vệ chủ quán cuối cùng.</p>}
    <section className="panel feature-panel">
      {config.tabs.length > 1 && <div className="feature-tabs" role="tablist">{config.tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={tab.id === tabId} className={tab.id === tabId ? 'is-active' : ''} onClick={() => setTabId(tab.id)}>{tab.label}</button>)}</div>}
      <header className="panel-header"><div><h2 className="panel-title">{activeTab.label}</h2><div className="panel-subtitle">{visibleRecords.length} bản ghi · Dữ liệu minh họa</div></div><label className="search-box"><i className="icon fa-solid fa-magnifying-glass" aria-hidden="true" /><span className="sr-only">Tìm kiếm</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm..." /></label></header>
      <div className="table-wrap"><table><thead><tr>{activeTab.columns.map((column) => <th key={column}>{column}</th>)}{activeTab.fields.length > 0 && <th>Thao tác</th>}</tr></thead><tbody>
        {visibleRecords.map((record, rowIndex) => {
          const index = records[tabId].indexOf(record);
          const keys = tableFields[tabId] || Object.keys(record);
          return <tr key={`${tabId}-${index}`}>{keys.map((key) => <td key={key}>{key === 'hours' ? `${record.start} – ${record.end}` : key === 'rank' ? rowIndex + 1 : displayValue(record[key])}</td>)}{activeTab.fields.length > 0 && <td><button className="text-button" type="button" onClick={() => setEditing({ index, record })}>Sửa</button></td>}</tr>;
        })}
        {!visibleRecords.length && <tr><td className="empty-state" colSpan={activeTab.columns.length + 1}>Không có dữ liệu phù hợp.</td></tr>}
      </tbody></table></div>
      {editing && <RecordDialog key={editing.index ?? 'new'} title={editing.record ? 'Cập nhật' : `Thêm ${activeTab.label.toLocaleLowerCase('vi')}`} fields={activeTab.fields} initial={editing.record} onClose={() => setEditing(null)} onSave={saveRecord} />}
    </section>
  </main>;
}

interface RecordDialogProps {
  title: string;
  fields: FeatureField[];
  initial?: FeatureRecord;
  onClose: () => void;
  onSave: (record: FeatureRecord) => void;
}

function RecordDialog({ title, fields, initial = {}, onClose, onSave }: RecordDialogProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget)) as FeatureRecord;
    fields.forEach(([, key, type]) => {
      if (type === 'number') values[key] = Number(values[key]);
    });
    onSave(values);
  };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="record-title">
      <header className="modal-header"><h2 id="record-title">{title}</h2><button className="modal-close" type="button" onClick={onClose} aria-label="Đóng"><i className="icon fa-solid fa-xmark" /></button></header>
      <form onSubmit={handleSubmit}>
        <div className="modal-body feature-form">{fields.map(([label, name, type, options]) => <label className="modal-field" key={name}>
          <span>{label}</span>
          {type === 'select'
            ? <select name={name} defaultValue={initial[name] || options?.[0]}>{options?.map((option) => <option key={option}>{option}</option>)}</select>
            : <input name={name} type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'time' ? 'time' : type === 'password' ? 'password' : 'text'} defaultValue={initial[name] ?? ''} required={name !== 'password' && name !== 'pin'} />}
        </label>)}</div>
        <footer className="modal-footer"><button className="button-secondary" type="button" onClick={onClose}>Hủy</button><button className="button-primary" type="submit">Lưu</button></footer>
      </form>
    </section>
  </div>;
}

function validateReportPeriod(setError: Dispatch<SetStateAction<string>>) {
  const from = document.querySelector<HTMLInputElement>('#report-from')?.value;
  const to = document.querySelector<HTMLInputElement>('#report-to')?.value;
  if (!from || !to) return;
  const days = (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000;
  setError(days < 0 ? 'Ngày bắt đầu phải trước ngày kết thúc.' : days > 30 ? 'Khoảng ngày không được vượt quá 31 ngày.' : '');
}

function TopItemsCharts() {
  const amounts = [91, 82, 74, 65, 58, 49, 42, 34, 26, 19];
  return <div className="report-grid feature-report-grid">
    <section className="panel report-panel"><header className="panel-header"><div><h2 className="panel-title">Top 10 món bán chạy</h2><div className="panel-subtitle">Biểu đồ theo số lượng hoặc doanh thu</div></div></header><div className="top-item-bars">{amounts.map((height, index) => <div key={index}><span style={{ height: `${height}%` }} /><small>{index + 1}</small></div>)}</div></section>
    <section className="panel report-panel"><header className="panel-header"><div><h2 className="panel-title">Doanh thu theo giờ</h2><div className="panel-subtitle">Tính theo thời điểm thanh toán</div></div></header><div className="feature-hour-bars">{[20, 25, 30, 48, 62, 82, 92, 75, 58, 36, 20, 10].map((height, index) => <div className="feature-hour-group" key={index}><span style={{ height: `${height}%` }} /></div>)}</div><div className="chart-labels report-labels"><span>09:00</span><span>12:00</span><span>15:00</span><span>18:00</span><span>21:00</span></div></section>
  </div>;
}
