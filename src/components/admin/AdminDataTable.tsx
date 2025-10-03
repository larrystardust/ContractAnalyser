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

const AdminDataTable = <T extends { id: string | number },>( // ADDED: Trailing comma here
  { data, columns, loading, error, onEdit, onDelete, customActions }: AdminDataTableProps<T>
) => {
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
          <tr>{/* MODIFIED: Removed newline after <tr> */}
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}<th scope="col" className="relative px-6 py-3"> {/* MODIFIED: Moved to same line as previous closing </th> */}
              <span className="sr-only">{t('actions_table')}</span> {/* MODIFIED */}
            </th></tr> {/* MODIFIED: Moved to same line as previous closing </th> */}
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => (
            <tr key={item.id}>{/* MODIFIED: Removed newline after <tr> */}
              {columns.map((column) => (
                <td key={String(column.key)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {column.render ? column.render(item) : String(item[column.key])}
                </td>
              ))}<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"> {/* MODIFIED: Moved to same line as previous closing </td> */}
                <div className="flex items-center justify-end space-x-2">
                  {customActions ? (
                    customActions(item)
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onEdit(item)}
                        icon={<Edit className="h-4 w-4" />}
                      >
                        {t('edit_button')} {/* MODIFIED */}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onDelete(item)}
                        icon={<Trash2 className="h-4 w-4" />}
                      >
                        {t('delete_button')} {/* MODIFIED */}
                      </Button>
                    </>
                  )}
                </div>
              </td></tr> {/* MODIFIED: Moved to same line as previous closing </td> */}
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminDataTable