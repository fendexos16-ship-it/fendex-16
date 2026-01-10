import React from 'react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  onEdit?: (item: T) => void;
  onToggleStatus?: (item: T) => void; // Specific for this phase
  actions?: (item: T) => React.ReactNode;
  isLoading?: boolean;
}

export function Table<T extends { id: string; status?: string }>({ 
  data, 
  columns, 
  onEdit, 
  onToggleStatus, 
  actions,
  isLoading 
}: TableProps<T>) {
  
  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-md border border-gray-200 p-8 flex justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-brand-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                scope="col"
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
            {(onEdit || actions) && (
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onEdit || actions ? 1 : 0)} className="px-6 py-8 text-center text-sm text-gray-500">
                No records found.
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                {columns.map((col, idx) => (
                  <td key={idx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {typeof col.accessor === 'function' 
                      ? col.accessor(row) 
                      : (row[col.accessor] as React.ReactNode)}
                  </td>
                ))}
                {(onEdit || actions || onToggleStatus) && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-3">
                    {actions && actions(row)}
                    {onToggleStatus && row.status && (
                      <button
                        onClick={() => onToggleStatus(row)}
                        className={`${row.status === 'Active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                      >
                        {row.status === 'Active' ? 'Disable' : 'Enable'}
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(row)}
                        className="text-brand-600 hover:text-brand-900"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}