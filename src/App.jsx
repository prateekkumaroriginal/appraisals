import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  Columns3,
  Database,
  Download,
  Filter,
  Loader2,
  Moon,
  RefreshCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Sun,
  Table2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = import.meta.env.PROD ? "/api/locomo" : "/locomo";

const ratingOrder = {
  "A+": 6,
  A: 5,
  "B+": 4,
  B: 3,
  "C+": 2,
  C: 1,
  NA: 0,
};

const chartColors = [
  "#0f766e",
  "#d97706",
  "#2563eb",
  "#be123c",
  "#7c3aed",
  "#15803d",
  "#c2410c",
  "#475569",
];

const chartHoverCursor = { fill: "rgba(15, 118, 110, 0.14)" };

const tablePageSize = 25;

const hiddenRawFieldKeys = new Set([
  "__v",
  "_id",
  "approved_by_unit_ph",
  "createdBy",
  "employee",
  "employee_people_manager",
  "employee_salary_component",
  "new_employee_people_manager",
  "practice_head",
  "processed_manually_by_hr",
  "promotion_designation",
  "technology_by_unit_head",
  "unit_promotion_designation",
  "updatedAt",
  "updatedBy",
]);

const hiddenRawFieldPrefixes = [
  "attachment.",
  "current_offer_letter.",
  "increment_letter_latest.",
];

function isVisibleRawField(key) {
  if (hiddenRawFieldKeys.has(key)) return false;
  if (key === "id" || key.endsWith(".id")) return false;
  if (key === "key" || key.endsWith(".key")) return false;
  if (key.endsWith("._id")) return false;
  if (key.endsWith(".metadata.bucketName")) return false;
  return !hiddenRawFieldPrefixes.some((prefix) => key.startsWith(prefix));
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.response)) return payload.response;
  return [];
}

function clean(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim();
  return value;
}

function flattenRecord(value, prefix = "", output = {}) {
  if (value === null || value === undefined) {
    output[prefix] = "";
    return output;
  }

  if (value instanceof Date) {
    output[prefix] = shortDate(value);
    return output;
  }

  if (Array.isArray(value)) {
    output[prefix] = value
      .map((item) => {
        if (item === null || item === undefined) return "";
        if (typeof item === "object") return JSON.stringify(item);
        return String(item);
      })
      .join("; ");
    return output;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([key, nestedValue]) => {
      flattenRecord(nestedValue, prefix ? `${prefix}.${key}` : key, output);
    });
    return output;
  }

  output[prefix] = value;
  return output;
}

function buildColumnsWithRawFields(defaultColumns, rows) {
  const existingKeys = new Set(defaultColumns.map((column) => column.key));
  const rawKeys = new Set();

  rows.forEach((row) => {
    Object.keys(row.rawFlat || {}).forEach((key) => rawKeys.add(key));
  });

  const rawColumns = [...rawKeys]
    .filter(isVisibleRawField)
    .filter((key) => !existingKeys.has(`raw:${key}`))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((key) => ({
      key: `raw:${key}`,
      label: key,
      value: (row) => row.rawFlat?.[key] ?? "",
      render: (row) => {
        const value = row.rawFlat?.[key];
        if (typeof value === "boolean") return value ? "true" : "false";
        return value ?? "";
      },
    }));

  return [...defaultColumns, ...rawColumns];
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function shortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizeToken(token) {
  const trimmed = token.trim();
  if (!trimmed) return "";
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

async function fetchJson(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: normalizeToken(token),
      Accept: "application/json, text/plain, */*",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    redirect: "follow",
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    payload = { message: text.slice(0, 260) };
  }
  if (!response.ok) {
    const detail = payload?.message || payload?.error || response.statusText;
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }
  return payload;
}

function normalizeFeedback(record) {
  const employee = record.employee || {};
  return {
    id: record._id || record.id || "",
    employeeId: employee._id || record.employee_id || "",
    employeeName: clean(employee.name || record.employee_name),
    employeeCode: clean(employee.employee_code || record.employee_code),
    employeeLevel: clean(employee.employee_level?.level || record.employee_level),
    experience: numberOrNull(employee.experience ?? record.experience),
    resourceLanguage: clean(employee.resource_language?.name || record.resource_language),
    officialEmail: clean(employee.official_email_id),
    reportingManager: clean(record.reporting_to?.name || record.reporting_to),
    practiceHead: clean(record.practice_head?.name || record.practice_head),
    project: clean(record.project?.project || record.project, "(blank)"),
    financialYear: clean(record.financial_year?.financial_year || record.financial_year, "(blank)"),
    quarter: clean(record.quater || record.quarter, "(blank)"),
    rating: clean(record.overall_rating, "(blank)"),
    ratingExport: clean(record.rating_export, "(blank)"),
    submittedOn: shortDate(record.submitted_on),
    projectStartDate: shortDate(record.project_start_date),
    projectEndDate: shortDate(record.project_end_date),
    rawFlat: flattenRecord(record),
  };
}

function employeeLabel(row) {
  const code = clean(row.employeeCode);
  const name = clean(row.employeeName);
  return [code, name].filter(Boolean).join(" ") || row.employeeId || "(unknown)";
}

function buildEmployeeIndex(feedbackRows) {
  const index = new Map();
  feedbackRows.forEach((row) => {
    if (!row.employeeId) return;
    const existing = index.get(row.employeeId) || {};
    index.set(row.employeeId, {
      employeeId: row.employeeId,
      employeeName: existing.employeeName || row.employeeName,
      employeeCode: existing.employeeCode || row.employeeCode,
      employeeLevel: existing.employeeLevel || row.employeeLevel,
      resourceLanguage: existing.resourceLanguage || row.resourceLanguage,
      officialEmail: existing.officialEmail || row.officialEmail,
      feedbackCount: (existing.feedbackCount || 0) + 1,
    });
  });
  return index;
}

function normalizeAppraisal(record, employeeIndex) {
  const embeddedEmployee = typeof record.employee === "object" && record.employee ? record.employee : {};
  const employeeId = embeddedEmployee._id || (typeof record.employee === "string" ? record.employee : "");
  const employee = employeeIndex.get(employeeId) || {};
  const overall = clean(record.overall_rating || record.overall_grading_unitHeadFinal || record.overall_grading_peopleManager, "(blank)");
  return {
    id: record._id || record.id || "",
    employeeId,
    employeeName: clean(embeddedEmployee.name || employee.employeeName),
    employeeCode: clean(embeddedEmployee.employee_code || employee.employeeCode),
    employeeLevel: clean(embeddedEmployee.employee_level?.level || employee.employeeLevel),
    resourceLanguage: clean(embeddedEmployee.resource_language?.name || employee.resourceLanguage),
    officialEmail: clean(
      embeddedEmployee.official_email_id || record.official_email_id || employee.officialEmail,
    ),
    feedbackCount: employee.feedbackCount || 0,
    status: clean(record.status, "(blank)"),
    departmentType: clean(record.department_type, "(blank)"),
    effectiveDate: shortDate(record.effective_date),
    fromDate: shortDate(record.from_date),
    toDate: shortDate(record.to_date),
    extendedTill: shortDate(record.extended_till),
    holdTill: shortDate(record.hold_till),
    closedDate: shortDate(record.closed_date),
    overallRating: overall,
    pmOverallRating: clean(record.pm_overall_rating, "(blank)"),
    peopleManagerGrade: clean(record.overall_grading_peopleManager, "(blank)"),
    unitHeadGrade: clean(record.overall_grading_unitHeadFinal, "(blank)"),
    pmOverallScore: numberOrNull(record.pm_overall_score),
    innovationScore: numberOrNull(record.people_manager_innovation_score),
    utilisation: numberOrNull(record.utilisation_perc),
    totalAvailableHours: numberOrNull(record.total_available_hours),
    totalBilledHours: numberOrNull(record.total_billed_hours),
    deliveredHours: numberOrNull(record.delivered_hours),
    rfrAssigned: numberOrNull(record.rfr_assigned),
    rfrWon: numberOrNull(record.rfr_won),
    rfrSelection: numberOrNull(record.rfr_selection_percentage),
    totalLeave: numberOrNull(record.total_leave),
    totalRnr: numberOrNull(record.total_rnr),
    selfDone: Boolean(record.self_appraisal_status),
    managerDone: Boolean(record.manager_appraisal_status),
    peopleManagerDone: Boolean(record.people_manager_appraisal_status),
    unitDone: Boolean(record.unit_appraisal_status),
    payrollDone: Boolean(record.hrPayroll_appraisal_status),
    offerAccepted: Boolean(record.offer_accepted_by_employee),
    incrementAgreement: clean(record.ifIncrement_asPer_aggrement, "(blank)"),
    incrementRecommendation:
      record.increment_recommendation === undefined || record.increment_recommendation === null
        ? "(blank)"
        : String(record.increment_recommendation),
    hasSelfFeedback: Boolean(
      record.question_1_feedback ||
        record.question_2_feedback ||
        record.question_3_feedback ||
        record.question_4_feedback,
    ),
    rawFlat: flattenRecord(record),
  };
}

function countBy(rows, accessor) {
  const map = new Map();
  rows.forEach((row) => {
    const key = clean(typeof accessor === "function" ? accessor(row) : row[accessor], "(blank)");
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

function topBy(rows, accessor, limit = 8) {
  return countBy(rows, accessor).slice(0, limit);
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function minMaxRows(rows, field) {
  const valid = rows.filter((row) => Number.isFinite(row[field]));
  if (!valid.length) return { min: null, max: null };
  return {
    min: valid.reduce((current, row) => (row[field] < current[field] ? row : current), valid[0]),
    max: valid.reduce((current, row) => (row[field] > current[field] ? row : current), valid[0]),
  };
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, rows, columns) {
  const header = columns.map((column) => csvEscape(column.label)).join(",");
  const body = rows
    .map((row) => columns.map((column) => csvEscape(column.value(row))).join(","))
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${formatNumber(value, 1)}%`;
}

function uniqueOptions(rows, key) {
  return [...new Set(rows.map((row) => clean(row[key])).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function matchesSearch(row, query) {
  if (!query.trim()) return true;
  const needle = query.toLowerCase();
  const normalizedMatch = Object.entries(row)
    .filter(([key]) => key !== "rawFlat")
    .some(([, value]) => String(value ?? "").toLowerCase().includes(needle));
  if (normalizedMatch) return true;
  return Object.values(row.rawFlat || {}).some((value) => String(value ?? "").toLowerCase().includes(needle));
}

function utilisationBucket(value) {
  if (!Number.isFinite(value)) return "Missing";
  if (value <= 0) return "Zero";
  if (value < 50) return "Below 50";
  if (value <= 100) return "50 to 100";
  return "Above 100";
}

function useThemeMode() {
  const [mode, setMode] = useState(() => localStorage.getItem("locomo-theme") || "system");

  useEffect(() => {
    localStorage.setItem("locomo-theme", mode);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [mode]);

  return [mode, setMode];
}

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    good: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
    warn: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    bad: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Metric({ icon: Icon, label, value, subtext, tone = "teal" }) {
  const toneClass = {
    teal: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  };
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">{value}</p>
        </div>
        <span className={`rounded-md p-2 ${toneClass[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      {subtext ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{subtext}</p> : null}
    </article>
  );
}

function SelectControl({ label, icon: Icon = Filter, value, onChange, options }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
      {label}
      <span className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-8 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All" : option}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </label>
  );
}

function DataTable({
  tableId,
  title,
  rows,
  columns,
  defaultColumnKeys,
  search,
  onSearch,
  searchPlaceholder = "Search rows",
  emptyText,
  onExport,
}) {
  const storageKey = `locomo-columns-${tableId}`;
  const columnPickerRef = useRef(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {
      // Ignore malformed local preferences.
    }
    return defaultColumnKeys?.length ? defaultColumnKeys : columns.map((column) => column.key);
  });
  const visibleColumns = useMemo(() => {
    const visible = columns.filter((column) => visibleColumnKeys.includes(column.key));
    return visible.length ? visible : columns;
  }, [columns, visibleColumnKeys]);
  const [sort, setSort] = useState({ key: visibleColumns[0]?.key, direction: "asc" });
  const [page, setPage] = useState(1);
  const [columnsOpen, setColumnsOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [rows, search]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(visibleColumnKeys));
  }, [storageKey, visibleColumnKeys]);

  useEffect(() => {
    if (!visibleColumns.some((column) => column.key === sort.key)) {
      setSort({ key: visibleColumns[0]?.key, direction: "asc" });
    }
  }, [sort.key, visibleColumns]);

  useEffect(() => {
    if (!columnsOpen) return undefined;

    function handlePointerDown(event) {
      if (!columnPickerRef.current?.contains(event.target)) {
        setColumnsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setColumnsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [columnsOpen]);

  const sortedRows = useMemo(() => {
    const column = visibleColumns.find((item) => item.key === sort.key) || visibleColumns[0];
    if (!column) return rows;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const aValue = column.value(a);
      const bValue = column.value(b);
      if (typeof aValue === "number" && typeof bValue === "number") return (aValue - bValue) * direction;
      return String(aValue ?? "").localeCompare(String(bValue ?? ""), undefined, { numeric: true }) * direction;
    });
  }, [rows, visibleColumns, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / tablePageSize));
  const pageRows = sortedRows.slice((page - 1) * tablePageSize, page * tablePageSize);

  function toggleSort(key) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  function toggleColumn(key) {
    setVisibleColumnKeys((current) => {
      if (current.includes(key)) {
        return current.length === 1 ? current : current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  }

  function showAllColumns() {
    setVisibleColumnKeys(columns.map((column) => column.key));
  }

  return (
    <section className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatNumber(rows.length)} matching rows</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <div className="min-w-0 flex-1 lg:w-80">
            <SearchBox value={search} onChange={onSearch} placeholder={searchPlaceholder} />
          </div>
          <button
            type="button"
            onClick={() => onExport(sortedRows, visibleColumns)}
            disabled={!sortedRows.length}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-bold text-slate-800 transition hover:border-teal-400 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-teal-500 dark:hover:text-teal-200"
            title="Export visible rows"
          >
            <Download size={17} />
            CSV
          </button>
          <div ref={columnPickerRef} className="relative">
            <button
              type="button"
              onClick={() => setColumnsOpen((open) => !open)}
              aria-expanded={columnsOpen}
              aria-haspopup="menu"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-bold text-slate-800 transition hover:border-teal-400 hover:text-teal-700 dark:border-slate-700 dark:text-slate-100 dark:hover:border-teal-500 dark:hover:text-teal-200"
            >
              <Columns3 size={17} />
              Columns
            </button>
            {columnsOpen ? (
              <div className="absolute right-0 z-20 mt-2 max-h-96 w-72 overflow-auto rounded-lg border border-slate-200 bg-white p-3 shadow-panel dark:border-slate-700 dark:bg-slate-950">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                    {visibleColumns.length}/{columns.length} visible
                  </p>
                  <button
                    type="button"
                    onClick={showAllColumns}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
                  >
                    Show all
                  </button>
                </div>
                <div className="grid gap-1">
                  {columns.map((column) => (
                    <label
                      key={column.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumnKeys.includes(column.key)}
                        onChange={() => toggleColumn(column.key)}
                        className="h-4 w-4 accent-teal-700"
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="max-w-full overflow-x-auto overscroll-x-contain">
        <table className="w-max min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              {visibleColumns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="inline-flex items-center gap-1 font-bold hover:text-teal-700 dark:hover:text-teal-200"
                  >
                    {column.label}
                    {sort.key === column.key ? (
                      sort.direction === "asc" ? (
                        <ArrowUp size={13} />
                      ) : (
                        <ArrowDown size={13} />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {pageRows.map((row) => (
              <tr key={row.id} className="align-top transition hover:bg-slate-50 dark:hover:bg-slate-900/70">
                {visibleColumns.map((column) => (
                  <td key={column.key} className="max-w-72 whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                    <div
                      className="max-w-72 overflow-hidden text-ellipsis"
                      title={String(column.value(row) ?? "") || undefined}
                    >
                      {column.render ? column.render(row) : column.value(row)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!pageRows.length ? (
        <div className="grid min-h-48 place-items-center p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {emptyText}
        </div>
      ) : null}
      <div className="flex flex-col gap-3 border-t border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page === 1}
            className="rounded-md border border-slate-200 px-3 py-2 font-bold disabled:opacity-50 dark:border-slate-700"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-slate-200 px-3 py-2 font-bold disabled:opacity-50 dark:border-slate-700"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function ChartPanel({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">{title}</h3>
      <div className="mt-4 h-72">{children}</div>
    </section>
  );
}

function DistributionBar({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return null;
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
      <div className="flex h-4">
        {data.map((item, index) => (
          <div
            key={item.name}
            className="h-full"
            style={{ width: `${(item.value / total) * 100}%`, backgroundColor: chartColors[index % chartColors.length] }}
            title={`${item.name}: ${item.value}`}
          />
        ))}
      </div>
    </div>
  );
}

function App() {
  const [themeMode, setThemeMode] = useThemeMode();
  const [token, setToken] = useState(() => sessionStorage.getItem("locomo-token") || "");
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [appraisalRows, setAppraisalRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState("overview");
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [appraisalSearch, setAppraisalSearch] = useState("");
  const [feedbackFilters, setFeedbackFilters] = useState({
    rating: "all",
    financialYear: "all",
    quarter: "all",
    project: "all",
  });
  const [appraisalFilters, setAppraisalFilters] = useState({
    rating: "all",
    departmentType: "all",
    status: "all",
    utilisation: "all",
  });

  useEffect(() => {
    if (token) sessionStorage.setItem("locomo-token", token);
    else sessionStorage.removeItem("locomo-token");
  }, [token]);

  const employeeIndex = useMemo(() => buildEmployeeIndex(feedbackRows), [feedbackRows]);

  async function loadData() {
    if (!token.trim()) {
      setErrors(["Add an authorization token before fetching."]);
      return;
    }
    setLoading(true);
    setErrors([]);
    const [feedbackResult, appraisalsResult] = await Promise.allSettled([
      fetchJson("/employeeprojectfeedback", token),
      fetchJson("/appraisals", token),
    ]);

    const nextErrors = [];
    let normalizedFeedback = feedbackRows;
    if (feedbackResult.status === "fulfilled") {
      normalizedFeedback = asArray(feedbackResult.value).map(normalizeFeedback);
      setFeedbackRows(normalizedFeedback);
    } else {
      nextErrors.push(`Project feedback failed: ${feedbackResult.reason.message}`);
    }

    const nextEmployeeIndex = buildEmployeeIndex(normalizedFeedback);
    if (appraisalsResult.status === "fulfilled") {
      setAppraisalRows(asArray(appraisalsResult.value).map((record) => normalizeAppraisal(record, nextEmployeeIndex)));
    } else {
      nextErrors.push(`Appraisals failed: ${appraisalsResult.reason.message}`);
    }

    setErrors(nextErrors);
    setLoading(false);
  }

  const feedbackStats = useMemo(() => {
    const ratings = countBy(feedbackRows, "rating");
    const ranked = feedbackRows.filter((row) => ratingOrder[row.rating] !== undefined);
    const best = ranked.reduce((current, row) => (ratingOrder[row.rating] > ratingOrder[current.rating] ? row : current), ranked[0]);
    const worst = ranked.reduce((current, row) => (ratingOrder[row.rating] < ratingOrder[current.rating] ? row : current), ranked[0]);
    return {
      records: feedbackRows.length,
      employees: new Set(feedbackRows.map((row) => row.employeeId).filter(Boolean)).size,
      projects: new Set(feedbackRows.map((row) => row.project).filter((value) => value && value !== "(blank)")).size,
      rated: feedbackRows.filter((row) => row.rating && row.rating !== "(blank)").length,
      ratings,
      topProjects: topBy(feedbackRows, "project", 8),
      topEmployees: topBy(feedbackRows, employeeLabel, 8),
      best,
      worst,
    };
  }, [feedbackRows]);

  const appraisalStats = useMemo(() => {
    const utilisationValues = appraisalRows.map((row) => row.utilisation).filter((value) => Number.isFinite(value));
    const pmScoreValues = appraisalRows.map((row) => row.pmOverallScore).filter((value) => Number.isFinite(value));
    const utilisation = minMaxRows(appraisalRows, "utilisation");
    const pmScore = minMaxRows(appraisalRows, "pmOverallScore");
    return {
      records: appraisalRows.length,
      departments: countBy(appraisalRows, "departmentType"),
      statuses: countBy(appraisalRows, "status"),
      ratings: countBy(appraisalRows, "overallRating"),
      avgUtilisation: average(utilisationValues),
      avgPmScore: average(pmScoreValues),
      utilisation,
      pmScore,
      workflowDone: appraisalRows.filter((row) => row.selfDone && row.peopleManagerDone && row.unitDone).length,
      withFeedbackNames: appraisalRows.filter((row) => row.employeeName || row.employeeCode).length,
      utilisationBuckets: countBy(appraisalRows, (row) => utilisationBucket(row.utilisation)),
    };
  }, [appraisalRows]);

  const filteredFeedback = useMemo(() => {
    return feedbackRows.filter((row) => {
      if (!matchesSearch(row, feedbackSearch)) return false;
      if (feedbackFilters.rating !== "all" && row.rating !== feedbackFilters.rating) return false;
      if (feedbackFilters.financialYear !== "all" && row.financialYear !== feedbackFilters.financialYear) return false;
      if (feedbackFilters.quarter !== "all" && row.quarter !== feedbackFilters.quarter) return false;
      if (feedbackFilters.project !== "all" && row.project !== feedbackFilters.project) return false;
      return true;
    });
  }, [feedbackRows, feedbackSearch, feedbackFilters]);

  const filteredAppraisals = useMemo(() => {
    return appraisalRows.filter((row) => {
      if (!matchesSearch(row, appraisalSearch)) return false;
      if (appraisalFilters.rating !== "all" && row.overallRating !== appraisalFilters.rating) return false;
      if (appraisalFilters.departmentType !== "all" && row.departmentType !== appraisalFilters.departmentType) return false;
      if (appraisalFilters.status !== "all" && row.status !== appraisalFilters.status) return false;
      if (appraisalFilters.utilisation !== "all" && utilisationBucket(row.utilisation) !== appraisalFilters.utilisation) return false;
      return true;
    });
  }, [appraisalRows, appraisalSearch, appraisalFilters]);

  const feedbackDefaultColumns = useMemo(() => [
    { key: "employee", label: "Employee", value: employeeLabel, render: (row) => <strong>{employeeLabel(row)}</strong> },
    { key: "project", label: "Project", value: (row) => row.project },
    { key: "rating", label: "Rating", value: (row) => row.rating, render: (row) => <Pill tone={row.rating === "A+" || row.rating === "A" ? "good" : row.rating === "(blank)" ? "neutral" : "warn"}>{row.rating}</Pill> },
    { key: "fy", label: "FY", value: (row) => row.financialYear },
    { key: "quarter", label: "Quarter", value: (row) => row.quarter },
    { key: "submitted", label: "Submitted", value: (row) => row.submittedOn },
    { key: "language", label: "Skill", value: (row) => row.resourceLanguage },
    { key: "manager", label: "Manager", value: (row) => row.reportingManager },
    { key: "practiceHead", label: "Practice Head", value: (row) => row.practiceHead },
  ], []);

  const appraisalDefaultColumns = useMemo(() => [
    { key: "employee", label: "Employee", value: employeeLabel, render: (row) => <strong>{employeeLabel(row)}</strong> },
    { key: "email", label: "Email", value: (row) => row.officialEmail },
    { key: "effective", label: "Effective", value: (row) => row.effectiveDate },
    { key: "department", label: "Department", value: (row) => row.departmentType },
    { key: "rating", label: "Overall", value: (row) => row.overallRating, render: (row) => <Pill tone={row.overallRating === "A+" || row.overallRating === "A" ? "good" : row.overallRating === "(blank)" ? "neutral" : "warn"}>{row.overallRating}</Pill> },
    { key: "pmRating", label: "PM Rating", value: (row) => row.pmOverallRating },
    { key: "pmScore", label: "PM Score", value: (row) => row.pmOverallScore ?? -1, render: (row) => formatNumber(row.pmOverallScore, 2) },
    { key: "utilisation", label: "Utilisation", value: (row) => row.utilisation ?? -1, render: (row) => <span className={row.utilisation > 100 ? "font-bold text-rose-700 dark:text-rose-300" : ""}>{formatPercent(row.utilisation)}</span> },
    { key: "workflow", label: "Workflow", value: (row) => [row.selfDone, row.managerDone, row.peopleManagerDone, row.unitDone, row.payrollDone].filter(Boolean).length, render: (row) => `${[row.selfDone, row.managerDone, row.peopleManagerDone, row.unitDone, row.payrollDone].filter(Boolean).length}/5` },
    { key: "status", label: "Status", value: (row) => row.status },
    { key: "agreement", label: "Increment", value: (row) => row.incrementAgreement },
  ], []);

  const feedbackColumns = useMemo(
    () => buildColumnsWithRawFields(feedbackDefaultColumns, feedbackRows),
    [feedbackDefaultColumns, feedbackRows],
  );
  const appraisalColumns = useMemo(
    () => buildColumnsWithRawFields(appraisalDefaultColumns, appraisalRows),
    [appraisalDefaultColumns, appraisalRows],
  );
  const feedbackDefaultColumnKeys = useMemo(
    () => feedbackDefaultColumns.map((column) => column.key),
    [feedbackDefaultColumns],
  );
  const appraisalDefaultColumnKeys = useMemo(
    () => appraisalDefaultColumns.map((column) => column.key),
    [appraisalDefaultColumns],
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:28px_28px] dark:bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-normal text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <Shield size={14} />
              Locomo API cockpit
            </div>
            <h1 className="mt-3 font-display text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">
              Appraisal and feedback analytics
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Searchable operating view for project feedback, appraisal workflow, ratings, utilisation, and outliers.
            </p>
          </div>
          <div className="flex rounded-md border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {[
              ["system", Activity, "Device"],
              ["light", Sun, "Light"],
              ["dark", Moon, "Dark"],
            ].map(([mode, Icon, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setThemeMode(mode)}
                className={`inline-flex h-9 items-center gap-2 rounded px-3 text-sm font-bold transition ${
                  themeMode === mode
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-200"
                }`}
                title={`${label} theme`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </header>

        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-panel dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
              Authorization token
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Bearer token"
                className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-slate-950 dark:hover:bg-teal-200"
            >
              {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
              Fetch data
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill>{formatNumber(feedbackRows.length)} feedback rows</Pill>
            <Pill>{formatNumber(appraisalRows.length)} appraisal rows</Pill>
            {errors.map((error) => (
              <Pill key={error} tone="bad">
                <AlertTriangle className="mr-1" size={13} />
                {error}
              </Pill>
            ))}
          </div>
        </section>

        <nav className="mb-5 flex flex-wrap gap-2">
          {[
            ["overview", BarChart3, "Overview"],
            ["feedback", Table2, "Project Feedback"],
            ["appraisals", SlidersHorizontal, "Appraisals"],
          ].map(([view, Icon, label]) => (
            <button
              key={view}
              type="button"
              onClick={() => setActiveView(view)}
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-black transition ${
                activeView === view
                  ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-teal-500 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-teal-300 dark:hover:text-teal-200"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {activeView === "overview" ? (
          <div className="grid gap-5">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={Database} label="Feedback records" value={formatNumber(feedbackStats.records)} subtext={`${formatNumber(feedbackStats.employees)} employees, ${formatNumber(feedbackStats.projects)} projects`} />
              <Metric icon={CheckCircle2} label="Rated feedback" value={formatNumber(feedbackStats.rated)} subtext={`${formatPercent((feedbackStats.rated / Math.max(feedbackStats.records, 1)) * 100)} of feedback`} tone="blue" />
              <Metric icon={Activity} label="Appraisals" value={formatNumber(appraisalStats.records)} subtext={`${formatNumber(appraisalStats.withFeedbackNames)} resolved employee names`} tone="amber" />
              <Metric icon={TrendingUp} label="Avg utilisation" value={formatPercent(appraisalStats.avgUtilisation)} subtext={`${formatNumber(appraisalStats.workflowDone)} workflows past unit review`} tone="rose" />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ChartPanel title="Feedback rating mix">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={feedbackStats.ratings}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip cursor={chartHoverCursor} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {feedbackStats.ratings.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
              <ChartPanel title="Appraisal departments">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={appraisalStats.departments} dataKey="value" nameKey="name" outerRadius={100} label>
                      {appraisalStats.departments.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip cursor={chartHoverCursor} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartPanel>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <h3 className="font-display text-lg font-bold">Utilisation extremes</h3>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-md bg-rose-50 p-3 dark:bg-rose-950/50">
                    <p className="flex items-center gap-2 text-sm font-bold text-rose-800 dark:text-rose-200"><TrendingUp size={16} />Maximum</p>
                    <p className="mt-1 text-sm">{appraisalStats.utilisation.max ? `${employeeLabel(appraisalStats.utilisation.max)} - ${formatPercent(appraisalStats.utilisation.max.utilisation)}` : "-"}</p>
                  </div>
                  <div className="rounded-md bg-teal-50 p-3 dark:bg-teal-950/50">
                    <p className="flex items-center gap-2 text-sm font-bold text-teal-800 dark:text-teal-200"><TrendingDown size={16} />Minimum</p>
                    <p className="mt-1 text-sm">{appraisalStats.utilisation.min ? `${employeeLabel(appraisalStats.utilisation.min)} - ${formatPercent(appraisalStats.utilisation.min.utilisation)}` : "-"}</p>
                  </div>
                </div>
              </article>
              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <h3 className="font-display text-lg font-bold">Feedback extremes</h3>
                <div className="mt-4 grid gap-3">
                  <p className="text-sm"><strong>Highest rating:</strong> {feedbackStats.best ? `${employeeLabel(feedbackStats.best)} on ${feedbackStats.best.project} (${feedbackStats.best.rating})` : "-"}</p>
                  <p className="text-sm"><strong>Lowest rating:</strong> {feedbackStats.worst ? `${employeeLabel(feedbackStats.worst)} on ${feedbackStats.worst.project} (${feedbackStats.worst.rating})` : "-"}</p>
                  <DistributionBar data={feedbackStats.ratings} />
                </div>
              </article>
              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <h3 className="font-display text-lg font-bold">PM score range</h3>
                <div className="mt-4 grid gap-3 text-sm">
                  <p><strong>Average:</strong> {formatNumber(appraisalStats.avgPmScore, 2)}</p>
                  <p><strong>Maximum:</strong> {appraisalStats.pmScore.max ? `${employeeLabel(appraisalStats.pmScore.max)} - ${formatNumber(appraisalStats.pmScore.max.pmOverallScore, 2)}` : "-"}</p>
                  <p><strong>Minimum:</strong> {appraisalStats.pmScore.min ? `${employeeLabel(appraisalStats.pmScore.min)} - ${formatNumber(appraisalStats.pmScore.min.pmOverallScore, 2)}` : "-"}</p>
                </div>
              </article>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ChartPanel title="Top projects by feedback">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={feedbackStats.topProjects} layout="vertical" margin={{ left: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" width={150} tickLine={false} axisLine={false} />
                    <Tooltip cursor={chartHoverCursor} />
                    <Bar dataKey="value" fill="#0f766e" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
              <ChartPanel title="Utilisation buckets">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={appraisalStats.utilisationBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip cursor={chartHoverCursor} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {appraisalStats.utilisationBuckets.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </section>
          </div>
        ) : null}

        {activeView === "feedback" ? (
          <div className="grid min-w-0 gap-4">
            <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2 lg:grid-cols-4">
              <SelectControl label="Rating" value={feedbackFilters.rating} onChange={(value) => setFeedbackFilters((current) => ({ ...current, rating: value }))} options={["all", ...uniqueOptions(feedbackRows, "rating")]} />
              <SelectControl label="Financial year" value={feedbackFilters.financialYear} onChange={(value) => setFeedbackFilters((current) => ({ ...current, financialYear: value }))} options={["all", ...uniqueOptions(feedbackRows, "financialYear")]} />
              <SelectControl label="Quarter" value={feedbackFilters.quarter} onChange={(value) => setFeedbackFilters((current) => ({ ...current, quarter: value }))} options={["all", ...uniqueOptions(feedbackRows, "quarter")]} />
              <SelectControl label="Project" value={feedbackFilters.project} onChange={(value) => setFeedbackFilters((current) => ({ ...current, project: value }))} options={["all", ...uniqueOptions(feedbackRows, "project")]} />
            </section>
            <DataTable
              tableId="feedback"
              title="Project feedback"
              rows={filteredFeedback}
              columns={feedbackColumns}
              defaultColumnKeys={feedbackDefaultColumnKeys}
              search={feedbackSearch}
              onSearch={setFeedbackSearch}
              emptyText="No feedback rows match the current search and filters."
              onExport={(rows, visibleColumns) => downloadCsv("project-feedback.csv", rows, visibleColumns)}
            />
          </div>
        ) : null}

        {activeView === "appraisals" ? (
          <div className="grid min-w-0 gap-4">
            <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2 lg:grid-cols-4">
              <SelectControl label="Rating" value={appraisalFilters.rating} onChange={(value) => setAppraisalFilters((current) => ({ ...current, rating: value }))} options={["all", ...uniqueOptions(appraisalRows, "overallRating")]} />
              <SelectControl label="Department" value={appraisalFilters.departmentType} onChange={(value) => setAppraisalFilters((current) => ({ ...current, departmentType: value }))} options={["all", ...uniqueOptions(appraisalRows, "departmentType")]} />
              <SelectControl label="Status" value={appraisalFilters.status} onChange={(value) => setAppraisalFilters((current) => ({ ...current, status: value }))} options={["all", ...uniqueOptions(appraisalRows, "status")]} />
              <SelectControl label="Utilisation" value={appraisalFilters.utilisation} onChange={(value) => setAppraisalFilters((current) => ({ ...current, utilisation: value }))} options={["all", "Missing", "Zero", "Below 50", "50 to 100", "Above 100"]} />
            </section>
            <DataTable
              tableId="appraisals"
              title="Appraisals"
              rows={filteredAppraisals}
              columns={appraisalColumns}
              defaultColumnKeys={appraisalDefaultColumnKeys}
              search={appraisalSearch}
              onSearch={setAppraisalSearch}
              searchPlaceholder="Search rows, including email"
              emptyText="No appraisal rows match the current search and filters."
              onExport={(rows, visibleColumns) => downloadCsv("appraisals.csv", rows, visibleColumns)}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default App;
