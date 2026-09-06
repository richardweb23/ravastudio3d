import Empty from "./Empty.jsx";

export default function DataTable({ heads, rows, empty }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {heads.map((head) => (
              <th key={head}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows
          ) : (
            <tr>
              <td colSpan={heads.length}>
                <Empty text={empty} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
