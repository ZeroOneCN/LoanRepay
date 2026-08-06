import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Popconfirm, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';
import { Currency, CURRENCY_LABELS } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT } from '../../styles/theme';

const { Option } = Select;

interface PnlFormValues {
  platformId: string;
  symbol: string;
  currency: Currency;
  pnl: number;
  recordedAt: dayjs.Dayjs;
  note?: string;
}

export default function PnlRecords() {
  const { pnlRecords, platforms, addPnl, updatePnl, deletePnl, convertToCNY, fxRates } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<PnlFormValues>();

  const openAdd = () => {
    if (platforms.length === 0) {
      message.warning('请先到「平台管理」添加平台');
      return;
    }
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      platformId: platforms[0]?.id,
      currency: platforms[0]?.currency || 'USD',
      recordedAt: dayjs(),
      pnl: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      platformId: record.platformId,
      symbol: record.symbol,
      currency: record.currency,
      pnl: record.pnl,
      recordedAt: dayjs(record.recordedAt),
      note: record.note,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!values.symbol?.trim()) { message.warning('请输入品种/标的'); return; }
      const data = {
        platformId: values.platformId,
        symbol: values.symbol.trim().toUpperCase(),
        currency: values.currency,
        pnl: values.pnl,
        recordedAt: values.recordedAt.format('YYYY-MM-DD HH:mm'),
        note: values.note,
      };
      if (editingId) {
        await updatePnl(editingId, data);
        message.success('更新成功');
      } else {
        await addPnl(data);
        message.success('添加成功');
      }
      setModalOpen(false);
    } catch (e) {
      // 校验失败静默
    }
  };

  const handleDelete = async (id: string) => {
    await deletePnl(id);
    message.success('删除成功');
  };

  // 选中平台变化时，自动同步币种
  const onPlatformChange = (pid: string) => {
    const pf = platforms.find(p => p.id === pid);
    if (pf) form.setFieldValue('currency', pf.currency);
  };

  const columns = [
    {
      title: '记录时间',
      dataIndex: 'recordedAt',
      key: 'recordedAt',
      width: 160,
      render: (val: string) => <span style={{ fontSize: FONT.tableCell }}>{val}</span>,
      sorter: (a: any, b: any) => a.recordedAt.localeCompare(b.recordedAt),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '平台',
      key: 'platform',
      ellipsis: true,
      render: (_: any, r: any) => {
        const pf = platforms.find(p => p.id === r.platformId);
        return <span style={{ fontWeight: 500, fontSize: FONT.tableCell }}>{pf?.name || '未知'}</span>;
      }
    },
    {
      title: '品种',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: 80,
      render: (c: Currency) => <span style={{ fontSize: FONT.tableCell }}>{c}</span>
    },
    {
      title: '累计盈亏',
      dataIndex: 'pnl',
      key: 'pnl',
      width: 140,
      render: (val: number, r: any) => (
        <span style={{ color: val >= 0 ? COLORS.success : COLORS.danger, fontWeight: 500, fontSize: FONT.tableCell }}>
          {val >= 0 ? '+' : ''}{formatMoney(val)} {r.currency}
        </span>
      ),
      sorter: (a: any, b: any) => a.pnl - b.pnl,
    },
    {
      title: '折算 CNY',
      key: 'pnlCNY',
      width: 140,
      render: (_: any, r: any) => {
        const cny = convertToCNY(r.pnl, r.currency);
        const noRate = r.currency !== 'CNY' && !fxRates.find(fr => fr.from === r.currency);
        return (
          <span style={{ color: cny >= 0 ? COLORS.success : COLORS.danger, fontSize: FONT.tableCell }}>
            {cny >= 0 ? '+' : ''}¥{formatMoney(cny)}
            {noRate && <span style={{ color: COLORS.warning, marginLeft: 4, fontSize: FONT.caption }}>无汇率</span>}
          </span>
        );
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
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ padding: '0 4px' }}>删除</Button>
          </Popconfirm>
        </div>
      )
    }
  ];

  return (
    <SectionCard
      title={`盈亏记录（共 ${pnlRecords.length} 条）`}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={platforms.length === 0}>添加盈亏</Button>}
    >
      {pnlRecords.length === 0 ? (
        <EmptyState description={platforms.length === 0 ? '请先到「平台管理」添加平台' : '暂无盈亏记录，点击「添加盈亏」开始录入'} actionText={platforms.length === 0 ? undefined : '添加盈亏'} onAction={platforms.length === 0 ? undefined : openAdd} />
      ) : (
        <Table
          columns={columns}
          dataSource={pnlRecords}
          rowKey="id"
          pagination={{ defaultPageSize: 15, showSizeChanger: true, pageSizeOptions: ['15', '30', '50'], showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条` }}
          size="middle"
        />
      )}

      <Modal
        title={editingId ? '编辑盈亏' : '添加盈亏'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="platformId" label="平台" rules={[{ required: true, message: '请选择平台' }]}>
            <Select placeholder="选择平台" onChange={onPlatformChange} optionFilterProp="children" showSearch>
              {platforms.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="symbol" label="品种/标的" rules={[{ required: true, message: '请输入品种' }]} tooltip="如 BTC、AAPL、00700">
            <Input placeholder="如 BTC、AAPL、00700" />
          </Form.Item>
          <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
            <Select>
              {(Object.keys(CURRENCY_LABELS) as Currency[]).map(c => <Option key={c} value={c}>{CURRENCY_LABELS[c]}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="pnl" label="累计盈亏金额（负数为亏损）" rules={[{ required: true, message: '请输入盈亏金额' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="如 500 或 -200" />
          </Form.Item>
          <Form.Item name="recordedAt" label="记录时间" rules={[{ required: true, message: '请选择时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="可选，如：X月累计盈亏快照" />
          </Form.Item>
        </Form>
      </Modal>
    </SectionCard>
  );
}
