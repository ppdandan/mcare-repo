"use client";

type SortOption = { value: string; label: string };

export default function TableControls({
  total,
  page,
  pageSize = 10,
  sortValue,
  sortOptions,
  onSortChange,
  onPageChange,
}: {
  total: number;
  page: number;
  pageSize?: number;
  sortValue: string;
  sortOptions: SortOption[];
  onSortChange: (value: string) => void;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 bg-base-100 px-4 py-3">
      <label className="form-control flex-row items-center gap-2 text-sm">
        <span className="font-semibold">Sort</span>
        <select className="select select-bordered select-sm min-h-11" value={sortValue} onChange={(event) => onSortChange(event.target.value)}>
          {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2 text-sm">
        <span className="mr-1 text-base-content/75">{start}–{end} of {total}</span>
        <button type="button" className="btn btn-outline btn-sm min-h-11" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
        <button type="button" className="btn btn-outline btn-sm min-h-11" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}
