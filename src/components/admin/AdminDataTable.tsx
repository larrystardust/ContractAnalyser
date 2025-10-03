import React from 'react';
import Button from '../ui/Button';
import { Edit, Trash2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ADDED

interface Column<T> {
  key: keyof T;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface AdminDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading: boolean;
  error: string | null;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  customActions?: (item: T) => React.ReactNode;
}

// MODIFIED: Changed to a traditional function declaration to avoid parsing ambiguity
function AdminDataTable<T extends { id: string | number }>(
  { data, columns, loading, error, onEdit, onDelete, customActions }: AdminDataTableProps<T>
) {
  const { t } = useTranslation(); // ADDED

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-500">{t('loading_data')}...</p> {/* MODIFIED */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{t('error_label')}: {error}</p> {/* MODIFIED */}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p>{t('no_data_found')}</p> {/* MODIFIED */}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white shadow-md rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>{columns.map((column) => (<th key={String(column.key)} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{column.header}</th>)).concat(<th key="actions-header" scope="col" className="relative px-6 py-3"><span className="sr-only">{t('actions_table')}</span></th>)}</tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.id}>{columns.map((column) => (<td key={String(column.key)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{column.render ? column.render(item) : String(item[column.key])}</td>)).concat(<td key="actions-cell" className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><div className="flex items-center justify-end space-x-2">{customActions ? (customActions(item)) : (<><Button variant="secondary" size="sm" onClick={() => onEdit(item)} icon={<Edit className="h-4 w-4" />}>{t('edit_button')}</Button><Button variant="danger" size="sm" onClick={() => onDelete(item)} icon={<Trash2 className="h-4 w-4" />}>{t('delete_button')}</Button></>)}</div></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} // MODIFIED: Closing brace for function declaration

export default AdminDataTable;