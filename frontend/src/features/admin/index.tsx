import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { formatMoney } from '../../lib/format.ts';
import { adminApi } from '../../services/admin.ts';

const money = formatMoney;

type FieldType = 'text' | 'number' | 'date' | 'time' | 'password' | 'select';
type FeatureField = [label: string, name: string, type?: FieldType, options?: string[]];
type FeatureRecord = Record<string, string | number>;

interface DatasetTab {
  id: string;
  resource: string;
  label: string;
  columns: string[];
  fields: FeatureField[];
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
      {
        id: 'items',
        resource: 'menu-items',
        label: 'Món ăn',
        columns: ['Tên món', 'Mã tắt', 'Nhóm', 'Giá bán', 'Khu chế biến', 'Trạng thái'],
        fields: [
          ['Tên món', 'name'],
          ['Mã tắt', 'shortcut'],
          ['Nhóm', 'category', 'select'],
          ['Giá bán (₫)', 'price', 'number'],
          ['Đơn vị', 'unit'],
          ['Khu chế biến', 'station', 'select'],
          ['Là bia hơi', 'isDraftBeer', 'select', ['Không', 'Có']],
          ['Thể tích (ml)', 'volume', 'number'],
          ['Vòi mặc định', 'tap'],
          ['Trạng thái', 'status', 'select', ['Còn món', 'Hết món', 'Ẩn']]
        ]
      },
      {
        id: 'groups',
        resource: 'menu-groups',
        label: 'Nhóm món',
        columns: ['Tên nhóm', 'Thứ tự', 'Số món', 'Trạng thái'],
        fields: [['Tên nhóm', 'name'], ['Thứ tự', 'order', 'number']]
      },
      {
        id: 'stations',
        resource: 'kitchen-stations',
        label: 'Khu chế biến',
        columns: ['Tên khu', 'Số món phụ trách', 'Trạng thái'],
        fields: [['Tên khu', 'name']]
      }
    ]
  },
  areas: {
    title: 'Khu & bàn',
    subtitle: 'FR-12 · Cấu hình khu vực và sơ đồ bàn',
    tabs: [
      {
        id: 'areas',
        resource: 'admin-areas',
        label: 'Khu vực',
        columns: ['Tên khu', 'Số bàn', 'Thứ tự', 'Trạng thái'],
        fields: [['Tên khu', 'name'], ['Thứ tự', 'order', 'number']]
      },
      {
        id: 'tables',
        resource: 'tables',
        label: 'Bàn',
        columns: ['Mã bàn', 'Khu vực', 'Sức chứa', 'Trạng thái'],
        fields: [['Mã bàn (số bàn)', 'code'], ['Khu vực', 'area', 'select']]
      }
    ]
  },
  staff: {
    title: 'Quản lý nhân viên',
    subtitle: 'FR-13 · Tài khoản, vai trò và trạng thái nhân viên',
    tabs: [
      {
        id: 'staff',
        resource: 'staff',
        label: 'Nhân viên',
        columns: ['Họ tên', 'Email', 'Vai trò', 'Trạng thái'],
        fields: [
          ['Họ tên', 'name'],
          ['Email', 'email'],
          ['Mật khẩu mới (nếu tạo/đặt lại)', 'password', 'password'],
          ['Vai trò', 'role', 'select', ['Nhân viên quầy', 'Quản lý ca', 'Chủ quán']],
          ['PIN duyệt (quản lý/chủ quán)', 'pin', 'password'],
          ['Trạng thái', 'status', 'select', ['Hoạt động', 'Đã khóa']]
        ]
      }
    ]
  },
  kegs: {
    title: 'Nhập kho keg',
    subtitle: 'FR-14 · Theo dõi keg trong kho, đang dùng và đã hết',
    tabs: [
      {
        id: 'kegs',
        resource: 'kegs',
        label: 'Danh sách keg',
        columns: ['Mã keg', 'Loại bia', 'Dung tích', 'Giá nhập', 'Ngày nhập', 'Trạng thái'],
        fields: [
          ['Loại bia', 'beer'],
          ['Dung tích (L)', 'capacity', 'select', ['30', '50']],
          ['Giá nhập (₫)', 'cost', 'number'],
          ['Ngày nhập', 'date', 'date'],
          ['Số lượng nhập', 'quantity', 'number']
        ]
      }
    ]
  },
  happyHours: {
    title: 'Giá giờ vàng',
    subtitle: 'FR-15 · Thiết lập khung giờ và giá ưu đãi',
    tabs: [
      {
        id: 'happy-hours',
        resource: 'happy-hours',
        label: 'Khung giờ',
        columns: ['Tên chương trình', 'Ngày áp dụng', 'Thời gian', 'Món áp dụng', 'Giá ưu đãi', 'Trạng thái'],
        fields: [
          ['Tên chương trình', 'name'],
          ['Bắt đầu', 'start', 'time'],
          ['Kết thúc', 'end', 'time'],
          ['Món áp dụng', 'item'],
          ['Giá ưu đãi (₫)', 'price', 'number'],
          ['Trạng thái', 'status', 'select', ['Đang bật', 'Đã tắt']]
        ]
      }
    ]
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
  'happy-hours': ['name', 'days', 'hours', 'item', 'price', 'status']
};

interface FeaturePagesProps {
  view: string;
  onToast: (message: string) => void;
}

export function AdminPage({ view, onToast }: FeaturePagesProps) {
  const config = datasets[view];
  if (!config) return null;
  return <RecordsPage key={view} config={config} onToast={onToast} />;
}

function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">Quản trị · Neon DB</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function RecordsPage({ config, onToast }: { config: DatasetConfig; onToast: (message: string) => void }) {
  const [tabId, setTabId] = useState(config.tabs[0].id);
  const [records, setRecords] = useState<Record<string, FeatureRecord[]>>(() => Object.fromEntries(config.tabs.map((tab) => [tab.id, []])));
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ record?: FeatureRecord } | null>(null);
  const [query, setQuery] = useState('');

  const loadAllTabs = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        config.tabs.map(async (tab) => [tab.id, await adminApi.list<FeatureRecord>(tab.resource)] as const)
      );
      setRecords(Object.fromEntries(results));
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Không thể tải dữ liệu quản trị.');
    } finally {
      setLoading(false);
    }
  }, [config.tabs, onToast]);

  useEffect(() => { void loadAllTabs(); }, [loadAllTabs]);

  const activeTab = config.tabs.find((tab) => tab.id === tabId) ?? config.tabs[0];

  const dynamicFields: FeatureField[] = useMemo(() => {
    return activeTab.fields.map(([label, name, type, options]) => {
      if (type === 'select' && !options) {
        if (name === 'category') {
          const opts = (records.groups ?? []).map((g) => String(g.name));
          return [label, name, 'select', opts.length ? opts : ['Bia', 'Đồ nướng', 'Đồ chiên', 'Đồ nhắm']];
        }
        if (name === 'station') {
          const opts = (records.stations ?? []).map((s) => String(s.name));
          return [label, name, 'select', opts.length ? opts : ['Quầy rót bia', 'Bếp nướng', 'Bếp chiên']];
        }
        if (name === 'area') {
          const opts = (records.areas ?? []).map((a) => String(a.name));
          return [label, name, 'select', opts.length ? opts : ['Trong nhà', 'Sân', 'Tầng 2']];
        }
      }
      return [label, name, type, options];
    });
  }, [activeTab.fields, records]);

  const visibleRecords = useMemo(() => {
    return (records[tabId] ?? []).filter((record) =>
      Object.values(record).join(' ').toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))
    );
  }, [query, records, tabId]);

  const saveRecord = async (values: FeatureRecord) => {
    try {
      const existingId = editing?.record?.id;
      if (existingId !== undefined) {
        await adminApi.update(activeTab.resource, existingId, values);
        onToast('Đã cập nhật dữ liệu lên Neon DB.');
      } else {
        await adminApi.create(activeTab.resource, values);
        onToast('Đã thêm dữ liệu mới vào Neon DB.');
      }
      setEditing(null);
      await loadAllTabs();
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Không thể lưu dữ liệu.');
    }
  };

  return <main className="page-content feature-content">
    <PageHeading
      title={config.title}
      subtitle={config.subtitle}
      action={activeTab.fields.length > 0 && !(activeTab.id === 'kegs' && editing) && (
        <button className="button-primary" type="button" onClick={() => setEditing({})}>
          <i className="icon fa-solid fa-plus" aria-hidden="true" />Thêm mới
        </button>
      )}
    />
    {config.title.includes('Nhân viên') && (
      <p className="feature-note">Mật khẩu và PIN chỉ nhập khi tạo mới hoặc đặt lại; hệ thống tự băm bcrypt và bảo vệ Chủ quán đang hoạt động cuối cùng.</p>
    )}
    <section className="panel feature-panel">
      {config.tabs.length > 1 && (
        <div className="feature-tabs" role="tablist">
          {config.tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={tab.id === tabId} className={tab.id === tabId ? 'is-active' : ''} onClick={() => setTabId(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <header className="panel-header">
        <div>
          <h2 className="panel-title">{activeTab.label}</h2>
          <div className="panel-subtitle">{loading ? 'Đang tải...' : `${visibleRecords.length} bản ghi · Neon DB`}</div>
        </div>
        <label className="search-box">
          <i className="icon fa-solid fa-magnifying-glass" aria-hidden="true" />
          <span className="sr-only">Tìm kiếm</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm..." />
        </label>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {activeTab.columns.map((column) => <th key={column}>{column}</th>)}
              {activeTab.fields.length > 0 && activeTab.id !== 'kegs' && <th>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((record, rowIndex) => {
              const keys = tableFields[tabId] || Object.keys(record);
              return <tr key={record.id ?? `${tabId}-${rowIndex}`}>
                {keys.map((key) => <td key={key}>{key === 'hours' ? `${record.start} – ${record.end}` : displayValue(record[key])}</td>)}
                {activeTab.fields.length > 0 && activeTab.id !== 'kegs' && (
                  <td><button className="text-button" type="button" onClick={() => setEditing({ record })}>Sửa</button></td>
                )}
              </tr>;
            })}
            {!loading && !visibleRecords.length && (
              <tr><td className="empty-state" colSpan={activeTab.columns.length + 1}>Không có dữ liệu phù hợp.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <RecordDialog
          key={editing.record?.id ?? 'new'}
          title={editing.record ? 'Cập nhật' : `Thêm ${activeTab.label.toLocaleLowerCase('vi')}`}
          fields={dynamicFields}
          initial={editing.record}
          onClose={() => setEditing(null)}
          onSave={saveRecord}
        />
      )}
    </section>
  </main>;
}

interface RecordDialogProps {
  title: string;
  fields: FeatureField[];
  initial?: FeatureRecord;
  onClose: () => void;
  onSave: (record: FeatureRecord) => Promise<void>;
}

function RecordDialog({ title, fields, initial = {}, onClose, onSave }: RecordDialogProps) {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget)) as FeatureRecord;
    fields.forEach(([, key, type]) => {
      if (type === 'number' && values[key] !== '') values[key] = Number(values[key]);
    });
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="record-title">
      <header className="modal-header"><h2 id="record-title">{title}</h2><button className="modal-close" type="button" onClick={onClose} aria-label="Đóng"><i className="icon fa-solid fa-xmark" /></button></header>
      <form onSubmit={(e) => { void handleSubmit(e); }}>
        <div className="modal-body feature-form">
          {fields.map(([label, name, type, options]) => (
            <label className="modal-field" key={name}>
              <span>{label}</span>
              {type === 'select'
                ? <select name={name} defaultValue={initial[name] ?? options?.[0]}>{options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                : <input
                    name={name}
                    type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'time' ? 'time' : type === 'password' ? 'password' : 'text'}
                    defaultValue={initial[name] ?? ''}
                    required={name !== 'password' && name !== 'pin' && name !== 'volume' && name !== 'tap' && name !== 'unit'}
                  />}
            </label>
          ))}
        </div>
        <footer className="modal-footer">
          <button className="button-secondary" type="button" onClick={onClose}>Hủy</button>
          <button className="button-primary" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
        </footer>
      </form>
    </section>
  </div>;
}
