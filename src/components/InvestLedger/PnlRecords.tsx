import { useState, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Popconfirm, Tag, Space, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';
import { Currency, CURRENCY_LABELS, ProductType, PRODUCT_TYPE_LABELS } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING } from '../../styles/theme';

const { Option } = Select;

interface PnlFormValues {
  accountId: string;
  symbol?: string;
  currency: Currency;
  pnl: number;
  recordedAt: dayjs.Dayjs;
  note?: string;
}

export default function PnlRecords() {
  const { pnlRecords, platforms, accounts, addPnl, updatePnl, deletePnl, convertToCNY, fxRates } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [form] = Form.useForm<PnlFormValues>();

  // 表单中选中的账户
  const selectedAccountId = Form.useWatch('accountId', form);
  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );
  const pfOfSelectedAccount = useMemo(
    () => (selectedAccount ? platforms.find(p => p.id === selectedAccount.platformId) : null),
    [platforms, selectedAccount]
  );

  // 表单打开时，默认平台过滤器
  const openAdd = () => {
    if (platforms.length === 0) { message.warning('请先到「平台管理」添加平台'); return; }
    if (accounts.length === 0) { message.warning('请先到「平台管理」添加账户'); return; }
    setEditingId(null);
    form.resetFields();
    const defaultAccountFilter = platformFilter !== 'all' ? platformFilter : platforms[0]?.id;
    const firstAccount = accounts.find(a => defaultAccountFilter && a.platformId === defaultAccountFilter) || accounts[0];
    if (firstAccount) {
      const pf = platforms.find(p => p.id === firstAccount.platformId);
      form.setFieldsValue({
        accountId: firstAccount.id,
        currency: firstAccount.currency || pf?.currency || 'CNY',
        recordedAt: dayjs(),
        pnl: 0,
      });
    }
    setModalOpen(true);
  };

  const openEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      accountId: record.accountId,
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
      if (!values.accountId) { message.warning('请选择账户'); return; }
      const acc = accounts.find(a => a.id === values.accountId);
      if (!acc) { message.warning('账户无效'); return; }
      const data = {
        platformId: acc.platformId,
        accountId: acc.id,
        symbol: values.symbol?.trim() ? values.symbol.trim().toUpperCase() : undefined,
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

  // 切换账户时自动同步币种（加密货币还可以看合约/现货展示）
  const onAccountChange = (accId: string) => {
    const acc = accounts.find(a => a.id === accId);
    if (acc) form.setFieldValue('currency', acc.currency);
  };

  const filteredRecords = useMemo(() => {
    if (platformFilter === 'all') return pnlRecords;
    // 按平台过滤：找到属于该平台的所有账户的 pnl 记录
    const accIds = new Set(accounts.filter(a => a.platformId === platformFilter).map(a => a.id));
    return pnlRecords.filter(r => accIds.has(r.accountId) || r.platformId === platformFilter);
  }, [pnlRecords, accounts, platformFilter]);

  const accountOptionsForSelectedPlatform = useMemo(() => {
    if (!modalOpen) return accounts; // modal 内才会用到
    // 如果 form 打开了还没选平台，默认所有可用账户
    return accounts;
  }, [accounts, modalOpen]);

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
      title: '账户',
      key: 'account',
      render: (_: any, r: any) => {
        const acc = accounts.find(a => a.id === r.accountId);
        const pf = platforms.find(p => p.id === r.platformId) || platforms.find(p => p.id === acc?.platformId);
        return (
          <div>
            <div style={{ fontWeight: 500, fontSize: FONT.tableCell }}>
              {acc?.name || '未知账户'}
              {acc?.productTypes && acc.productTypes.length > 0 && acc.productTypes.map(pt => (
                <Tag key={pt} color={pt === 'spot' ? 'green' : 'magenta'} style={{ marginLeft: 4, marginRight: 0 }}>
                  {PRODUCT_TYPE_LABELS[pt as ProductType]}
                </Tag>
              ))}
            </div>
            <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary, marginTop: 2 }}>
              {pf?.name || '未知平台'}
            </div>
          </div>
        );
      }
    },
    {
      title: '品种',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : <span style={{ color: COLORS.textTertiary, fontSize: FONT.caption }}>账户级</span>
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
      width: 130,
      fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size={0} wrap={false}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} style={{ padding: '0 4px' }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ padding: '0 4px' }}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const canAdd = platforms.length > 0 && accounts.length > 0;

  return (
    <SectionCard
      title={`盈亏记录（共 ${filteredRecords.length} 条）`}
      extra={(
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {platforms.length > 0 && (
            <Select value={platformFilter} onChange={setPlatformFilter} style={{ width: 160 }}>
              <Option value="all">全部平台</Option>
              {platforms.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={!canAdd}>添加盈亏</Button>
        </div>
      )}
    >
      {pnlRecords.length === 0 ? (
        <EmptyState
          description={
            platforms.length === 0 ? '请先到「平台管理」添加平台和账户'
              : accounts.length === 0 ? '请先到「平台管理-账户管理」添加账户'
                : '暂无盈亏记录，点击「添加盈亏」开始录入'
          }
          actionText={canAdd ? '添加盈亏' : undefined}
          onAction={canAdd ? openAdd : undefined}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="id"
          pagination={{ defaultPageSize: 15, showSizeChanger: true, pageSizeOptions: ['15', '30', '50'], showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条` }}
          size="middle"
          scroll={{ x: 'max-content' }}
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
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="accountId" label="账户" rules={[{ required: true, message: '请选择账户' }]}>
            <Select
              placeholder="请先选择账户"
              onChange={onAccountChange}
              optionFilterProp="children"
              showSearch
              filterOption={(input, option: any) => {
                const label = option?.label || '';
                return typeof label === 'string' && label.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {accountOptionsForSelectedPlatform.map(a => {
                const pf = platforms.find(p => p.id === a.platformId);
                const pts = a.productTypes || [];
                const label = `${pf?.name || ''} / ${a.name}${pts.length > 0 ? `（${pts.map(pt => PRODUCT_TYPE_LABELS[pt as ProductType]).join(' + ')}）` : ''}`;
                return (
                  <Option key={a.id} value={a.id} label={label}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{a.name}</span>
                      <span style={{ color: COLORS.textTertiary, marginLeft: 4, fontSize: FONT.caption }}>{pf?.name}</span>
                      {pts.map(pt => (
                        <Tag key={pt} color={pt === 'spot' ? 'green' : 'magenta'} style={{ marginLeft: 8 }}>
                          {PRODUCT_TYPE_LABELS[pt as ProductType]}
                        </Tag>
                      ))}
                    </div>
                  </Option>
                );
              })}
            </Select>
          </Form.Item>
          {pfOfSelectedAccount && (
            <div style={{ marginTop: -SPACING.sm, marginBottom: SPACING.md, fontSize: FONT.caption, color: COLORS.textSecondary }}>
              所属平台：<span style={{ fontWeight: 500, color: COLORS.textPrimary }}>{pfOfSelectedAccount.name}</span>
              {' · '}
              {selectedAccount?.productTypes && selectedAccount.productTypes.length > 0 && <>类型：<span style={{ fontWeight: 500, color: COLORS.textPrimary }}>{selectedAccount.productTypes.map(p => PRODUCT_TYPE_LABELS[p]).join(' + ')}</span>{' · '}</>}
              币种：<span style={{ fontWeight: 500, color: COLORS.textPrimary }}>{selectedAccount?.currency || pfOfSelectedAccount.currency}</span>
            </div>
          )}
          <Form.Item name="symbol" label="品种/标的（可选）" tooltip="账户级记录可以不填品种。如 BTC、AAPL、00700，选填">
            <Input placeholder="如 BTC、AAPL、00700（账户级可留空）" />
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
