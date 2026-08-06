import { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Popconfirm, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { InvestMarket, INVEST_MARKET_LABELS, Currency, CURRENCY_LABELS } from '../../types';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT } from '../../styles/theme';

const { Option } = Select;

const marketColor: Record<InvestMarket, string> = {
  crypto: 'orange', us_stock: 'blue', hk_stock: 'purple', a_stock: 'red', other: 'default'
};

interface PlatformFormValues {
  name: string;
  market: InvestMarket;
  currency: Currency;
  note?: string;
}

export default function PlatformManager() {
  const { platforms, pnlRecords, addPlatform, updatePlatform, deletePlatform } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<PlatformFormValues>();

  const openAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ market: 'crypto', currency: 'USD' });
    setModalOpen(true);
  };

  const openEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      market: record.market,
      currency: record.currency,
      note: record.note,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!values.name?.trim()) { message.warning('请输入平台名称'); return; }
      const data = {
        name: values.name.trim(),
        market: values.market,
        currency: values.currency,
        note: values.note,
      };
      if (editingId) {
        await updatePlatform(editingId, data);
        message.success('更新成功');
      } else {
        await addPlatform(data);
        message.success('添加成功');
      }
      setModalOpen(false);
    } catch (e) {
      // 校验失败静默
    }
  };

  const handleDelete = async (id: string) => {
    const relCount = pnlRecords.filter(r => r.platformId === id).length;
    await deletePlatform(id);
    message.success(relCount > 0 ? `已删除平台及关联的 ${relCount} 条盈亏记录` : '删除成功');
  };

  const columns = [
    {
      title: '平台名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span style={{ fontWeight: 500, fontSize: FONT.tableCell }}>{text}</span>
    },
    {
      title: '市场',
      dataIndex: 'market',
      key: 'market',
      width: 120,
      render: (m: InvestMarket) => <Tag color={marketColor[m]}>{INVEST_MARKET_LABELS[m]}</Tag>
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: 100,
      render: (c: Currency) => <span style={{ fontSize: FONT.tableCell }}>{c}</span>
    },
    {
      title: '盈亏记录',
      key: 'count',
      width: 100,
      render: (_: any, r: any) => {
        const count = pnlRecords.filter(p => p.platformId === r.id).length;
        return <span style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>{count} 条</span>;
      }
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (val: string) => <span style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>{val || '-'}</span>
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 0 }}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} style={{ padding: '0 4px' }}>编辑</Button>
          <Popconfirm title="删除平台将同时删除其下所有盈亏记录，确定？" onConfirm={() => handleDelete(r.id)} okText="确定删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ padding: '0 4px' }}>删除</Button>
          </Popconfirm>
        </div>
      )
    }
  ];

  return (
    <SectionCard
      title={`投资平台（共 ${platforms.length} 个）`}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>添加平台</Button>}
    >
      {platforms.length === 0 ? (
        <EmptyState description="暂无平台，点击「添加平台」开始" actionText="添加平台" onAction={openAdd} />
      ) : (
        <Table
          columns={columns}
          dataSource={platforms}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      )}

      <Modal
        title={editingId ? '编辑平台' : '添加平台'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={480}
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="平台名称" rules={[{ required: true, message: '请输入平台名称' }]}>
            <Input placeholder="如：Binance、富途、老虎证券" />
          </Form.Item>
          <Form.Item name="market" label="市场类型" rules={[{ required: true, message: '请选择市场' }]}>
            <Select>
              {(Object.keys(INVEST_MARKET_LABELS) as InvestMarket[]).map(m => (
                <Option key={m} value={m}>{INVEST_MARKET_LABELS[m]}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="currency" label="记账币种" rules={[{ required: true, message: '请选择币种' }]} tooltip="该平台盈亏的默认币种，记录时可单独覆盖">
            <Select>
              {(Object.keys(CURRENCY_LABELS) as Currency[]).map(c => (
                <Option key={c} value={c}>{CURRENCY_LABELS[c]}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="可选，如：主账户、长期持有账户" />
          </Form.Item>
        </Form>
      </Modal>
    </SectionCard>
  );
}
