import { useState } from 'react';
import { Table, Button, Modal, Form, InputNumber, Select, Popconfirm, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';
import { Currency, CURRENCY_LABELS } from '../../types';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT } from '../../styles/theme';

const { Option } = Select;

// 可设置汇率的非 CNY 币种
const FX_CURRENCIES: Currency[] = ['USD', 'HKD', 'USDT'];

interface RateFormValues {
  from: Currency;
  rate: number;
}

export default function RateSettings() {
  const { fxRates, saveFxRate, deleteFxRate } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<RateFormValues>();

  const openAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ from: 'USD', rate: 7.2 });
    setModalOpen(true);
  };

  const openEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({ from: record.from, rate: record.rate });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验失败，表单自带红色提示
    }
    if (!values.rate || values.rate <= 0) { message.warning('请输入有效汇率'); return; }
    try {
      await saveFxRate({ id: editingId || undefined, from: values.from, rate: values.rate });
      message.success(editingId ? '更新成功' : '添加成功');
      setModalOpen(false);
    } catch (e: any) {
      message.error(e?.message || '保存失败，请检查后端服务是否启动');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFxRate(id);
      message.success('删除成功');
    } catch (e: any) {
      message.error(e?.message || '删除失败，请检查后端服务是否启动');
    }
  };

  // 已设置币种
  const configuredCurrencies = new Set(fxRates.map(r => r.from));
  // 还可添加的币种
  const availableCurrencies = FX_CURRENCIES.filter(c => !configuredCurrencies.has(c));

  const columns = [
    {
      title: '源币种',
      dataIndex: 'from',
      key: 'from',
      width: 120,
      render: (c: Currency) => <Tag color="blue">{CURRENCY_LABELS[c]}</Tag>
    },
    {
      title: '兑 CNY 汇率',
      dataIndex: 'rate',
      key: 'rate',
      render: (rate: number, r: any) => (
        <span style={{ fontSize: FONT.tableCell, color: COLORS.primary, fontWeight: 500 }}>
          1 {r.from} = {rate} CNY
        </span>
      )
    },
    {
      title: '示例换算',
      key: 'example',
      render: (_: any, r: any) => (
        <span style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>
          100 {r.from} ≈ ¥{(100 * r.rate).toFixed(2)}
        </span>
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (val: string) => <span style={{ fontSize: FONT.tableCell }}>{dayjs(val).format('YYYY-MM-DD HH:mm')}</span>
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 0 }}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} style={{ padding: '0 4px' }}>编辑</Button>
          <Popconfirm title="确定删除该汇率？" onConfirm={() => handleDelete(r.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ padding: '0 4px' }}>删除</Button>
          </Popconfirm>
        </div>
      )
    }
  ];

  return (
    <SectionCard
      title={`汇率设置（已配置 ${fxRates.length}/${FX_CURRENCIES.length} 个币种）`}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={availableCurrencies.length === 0}>
          添加汇率
        </Button>
      }
    >
      {fxRates.length === 0 ? (
        <EmptyState
          description="暂无汇率，多币种盈亏将无法折算为 CNY。点击「添加汇率」设置 USD/HKD/USDT 兑 CNY 汇率"
          actionText={availableCurrencies.length > 0 ? '添加汇率' : undefined}
          onAction={availableCurrencies.length > 0 ? openAdd : undefined}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={fxRates}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      )}

      <Modal
        title={editingId ? '编辑汇率' : '添加汇率'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={420}
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="from" label="源币种" rules={[{ required: true, message: '请选择币种' }]}>
            <Select disabled={!!editingId} placeholder="选择币种">
              {FX_CURRENCIES.map(c => (
                <Option key={c} value={c}>{CURRENCY_LABELS[c]}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="rate"
            label="兑 CNY 汇率（1 源币种 = ? CNY）"
            rules={[{ required: true, message: '请输入汇率' }]}
            tooltip="如 1 USD = 7.2 CNY，则填 7.2。汇率由您手动设置，不会自动更新"
          >
            <InputNumber style={{ width: '100%' }} min={0.0001} step={0.01} placeholder="如 7.2" />
          </Form.Item>
          <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary, marginTop: 8 }}>
            提示：汇率仅用于将各币种盈亏折算为人民币（CNY）汇总展示，不会自动同步实时汇率，需您手动维护。
          </div>
        </Form>
      </Modal>
    </SectionCard>
  );
}
