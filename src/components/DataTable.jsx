import { Children, cloneElement, useId, useState } from "react";
import Empty from "./Empty.jsx";

const PAGE_SIZE = 10;

export default function DataTable({ heads, rows, empty, pagination }) {
  const tableId = useId();
  const signature = JSON.stringify(rows.map((row, index) => row.key ?? index));
  const [position, setPosition] = useState({ signature, page: 0 });
  if (position.signature !== signature) setPosition({ signature, page: 0 });
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const localPage = position.signature === signature ? Math.min(position.page, totalPages - 1) : 0;
  const page = pagination?.page ?? localPage;
  const visibleRows = pagination ? rows.slice(0, PAGE_SIZE) : rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasNext = pagination ? pagination.hasNext : page + 1 < totalPages;
  const changePage = (next) => pagination ? pagination.onPageChange(next) : setPosition({ signature, page: next });
  const actionColumns = heads.map((head, index) => head === "Ações" || (head === "" && index === heads.length - 1));
  const first = rows.length ? page * PAGE_SIZE + 1 : 0;
  const last = rows.length ? page * PAGE_SIZE + visibleRows.length : 0;

  return (
    <div className="data-table">
      <div className="table-wrap">
        <table id={tableId} aria-busy={pagination?.loading || undefined}>
          <thead><tr>{heads.map((head, index) => (
            <th key={index} scope="col" className={actionColumns[index] ? "table-actions-cell" : undefined}>{head}</th>
          ))}</tr></thead>
          <tbody>
            {visibleRows.length ? visibleRows.map(row => cloneElement(row, {}, Children.map(row.props.children, (cell, index) => (
              actionColumns[index] && cell ? cloneElement(cell, { className: [cell.props.className, "table-actions-cell"].filter(Boolean).join(" ") }) : cell
            )))) : <tr><td colSpan={heads.length}><Empty text={empty} /></td></tr>}
          </tbody>
        </table>
      </div>
      <nav className="table-pagination" aria-label="Paginação da tabela" aria-controls={tableId}>
        <span role="status" aria-live="polite">{first}–{last}{pagination ? " registros" : " de " + rows.length + " registros"}</span>
        <div className="table-pagination-controls">
          <button type="button" disabled={page === 0 || pagination?.loading} onClick={() => changePage(page - 1)}>Anterior</button>
          <span>Página {page + 1}{pagination ? "" : " de " + totalPages}</span>
          <button type="button" disabled={!hasNext || pagination?.loading} onClick={() => changePage(page + 1)}>Próxima</button>
        </div>
      </nav>
    </div>
  );
}
