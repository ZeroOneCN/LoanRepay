import { Table } from 'antd';
import type { TableProps } from 'antd';

const DEFAULT_PAGE_SIZE = 10;

export default function PaginatedTable<T extends object>(props: TableProps<T>) {
  return (
    <Table<T>
      {...props}
      pagination={{
        pageSize: DEFAULT_PAGE_SIZE,
        showSizeChanger: false,
        showQuickJumper: true,
        showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
        ...props.pagination,
      }}
    />
  );
}