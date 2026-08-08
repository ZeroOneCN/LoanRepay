import { useState, useMemo } from 'react';
import { Tabs, Table, Button, Modal, Form, Input, Select, Popconfirm, Tag, Checkbox, Space, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { InvestMarket, INVEST_MARKET_LABELS, Currency, CURRENCY_LABELS, ProductType, PRODUCT_TYPE_LABELS, PRODUCT_TYPE_COLORS } from '../../types';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT } from '../../styles/theme';

const { Option } = Select;

const marketColor: Record<InvestMarket, string> = {
  crypto: 'orange', us_stock: 'blue', hk_stock: 'purple', a_stock: 'red', other: 'default'
};

const productColor: Record<ProductType, string> = PRODUCT_TYPE_COLORS;

function MarketTags({ markets }: { markets?: InvestMarket[] }) {
  if (!markets || markets.length === 0) return <span style={{ color: COLORS.textTertiary, fontSize: FONT.caption }}>-</span>;
  return (
    <Space size={4} wrap>
      {markets.map(m => (
        <Tag key={m} color={marketColor[m]}>{INVEST_MARKET_LABELS[m]}</Tag>
      ))}
    </Space>
  );
}

function ProductTypeTags({ types }: { types?: ProductType[] }) {
  if (!types || types.length === 0) return <span style={{ color: COLORS.textTertiary, fontSize: FONT.caption }}>-</span>;
  return (
    <Space size={4} wrap>
      {types.map(t => (
        <Tag key={t} color={productColor[t]}>{PRODUCT_TYPE_LABELS[t]}</Tag>
      ))}
    </Space>
  );
}

interface PlatformFormValues {
  name: string;
  markets: InvestMarket[];
  currency: Currency;
  note?: string;
}

interface AccountFormValues {
  platformId: string;
  name: string;
  currency: Currency;
  productTypes?: ProductType[];
  note?: string;
}

export default function PlatformManager() {
  const { platforms, accounts, pnlRecords, addPlatform, updatePlatform, deletePlatform, addAccount, updateAccount, deleteAccount } = useApp();

  const [activeKey, setActiveKey] = useState<'platform' | 'account'>('platform');

  // ====== 平台 ======
  const [pModalOpen, setPModalOpen] = useState(false);
  const [pEditingId, setPEditingId] = useState<string | null>(null);
  const [pForm] = Form.useForm<PlatformFormValues>();

  // ====== 账户 ======
  const [aModalOpen, setAModalOpen] = useState(false);
  const [aEditingId, setAEditingId] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [aForm] = Form.useForm<AccountFormValues>();

  // ====== 平台操作 ======
  const openAddP = () => {
    setPEditingId(null);
    pForm.resetFields();
    pForm.setFieldsValue({ markets: ['crypto'], currency: 'USDT' });
    setPModalOpen(true);
  };
  const openEditP = (record: any) => {
    setPEditingId(record.id);
    // 兼容老的 market 单值字段
    let ms = record.markets;
    if (!ms && record.market) ms = [record.market];
    pForm.setFieldsValue({
      name: record.name,
      markets: Array.isArray(ms) ? ms : (ms ? [ms] : []),
      currency: record.currency,
      note: record.note,
    });
    setPModalOpen(true);
  };
  const submitP = async () => {
    let values;
    try {
      values = await pForm.validateFields();
    } catch {
      return; // 校验失败，表单自带红色提示
    }
    if (!values.name?.trim()) { message.warning('请输入平台名称'); return; }
    if (!values.markets || values.markets.length === 0) {
      message.warning('请选择市场类型'); return;
    }
    const data = { name: values.name.trim(), markets: values.markets, currency: values.currency, note: values.note };
    try {
      if (pEditingId) { await updatePlatform(pEditingId, data); message.success('更新成功'); }
      else { await addPlatform(data); message.success('添加成功'); }
      setPModalOpen(false);
    } catch (e: any) {
      message.error(e?.message || '操作失败，请检查后端服务是否启动');
    }
  };
  const deleteP = async (id: string) => {
    const relAcc = accounts.filter(a => a.platformId === id).length;
    const relPnl = pnlRecords.filter(r => r.platformId === id).length;
    try {
      await deletePlatform(id);
      message.success(relAcc + relPnl > 0 ? `已删除平台及 ${relAcc} 个账户、${relPnl} 条盈亏记录` : '删除成功');
    } catch (e: any) {
      message.error(e?.message || '删除失败，请检查后端服务是否启动');
    }
  };

  // ====== 账户操作 ======
  const openAddA = (platformId?: string) => {
    if (platforms.length === 0) { message.warning('请先添加平台'); return; }
    setAEditingId(null);
    aForm.resetFields();
    const defaultPid = platformId || (accountFilter !== 'all' ? accountFilter : platforms[0]?.id);
    const defaultPf = platforms.find(p => p.id === defaultPid);
    const isCrypto = defaultPf?.markets?.includes('crypto');
    aForm.setFieldsValue({
      platformId: defaultPid,
      currency: defaultPf?.currency || 'USDT',
      // 类型改为可选，默认不预先勾选（用户按需勾选）
      productTypes: undefined,
    });
    setAModalOpen(true);
  };
  const openEditA = (record: any) => {
    setAEditingId(record.id);
    // 兼容老的 productType（单值字符串）
    let pts = record.productTypes;
    if (!pts && record.productType) pts = [record.productType];
    aForm.setFieldsValue({
      platformId: record.platformId,
      name: record.name,
      currency: record.currency,
      productTypes: Array.isArray(pts) ? pts : (pts ? [pts] : undefined),
      note: record.note,
    });
    setAModalOpen(true);
  };
  const submitA = async () => {
    let values;
    try {
      values = await aForm.validateFields();
    } catch {
      return; // 校验失败，表单自带红色提示
    }
    if (!values.name?.trim()) { message.warning('请输入账户名称'); return; }
    if (!values.platformId) { message.warning('请选择所属平台'); return; }
    const pf = platforms.find(p => p.id === values.platformId);
    const isCrypto = pf?.markets?.includes('crypto');
    const pts: ProductType[] | undefined =
      isCrypto && values.productTypes && values.productTypes.length > 0 ? values.productTypes : undefined;
    const data = {
      platformId: values.platformId,
      name: values.name.trim(),
      currency: values.currency,
      productTypes: pts,
      note: values.note,
    };
    try {
      if (aEditingId) { await updateAccount(aEditingId, data); message.success('更新成功'); }
      else { await addAccount(data); message.success('添加成功'); }
      setAModalOpen(false);
    } catch (e: any) {
      message.error(e?.message || '操作失败，请检查后端服务是否启动');
    }
  };
  const deleteA = async (id: string) => {
    const relCount = pnlRecords.filter(r => r.accountId === id).length;
    try {
      await deleteAccount(id);
      message.success(relCount > 0 ? `已删除账户及关联的 ${relCount} 条盈亏记录` : '删除成功');
    } catch (e: any) {
      message.error(e?.message || '删除失败，请检查后端服务是否启动');
    }
  };

  const selectedPlatformForAccount = Form.useWatch('platformId', aForm);
  // 当前选中平台的市场（数组）
  const selectedPlatformMarkets = useMemo(() => {
    if (!aModalOpen) return null;
    if (!selectedPlatformForAccount) return null;
    const pf = platforms.find(p => p.id === selectedPlatformForAccount);
    return pf?.markets || null;
  }, [aModalOpen, selectedPlatformForAccount, platforms]);
  const isCryptoPlatform = selectedPlatformMarkets?.includes('crypto');

  const filteredAccounts = useMemo(() => {
    return accountFilter === 'all' ? accounts : accounts.filter(a => a.platformId === accountFilter);
  }, [accounts, accountFilter]);

  // ====== 列定义：平台 ======
  const platformColumns = [
    { title: '平台名称', dataIndex: 'name', key: 'name', render: (t: string) => <span style={{ fontWeight: 500, fontSize: FONT.tableCell }}>{t}</span> },
    {
      title: '市场', key: 'markets', width: 160,
      render: (_: any, r: any) => {
        let ms = r.markets;
        if (!ms && r.market) ms = [r.market];
        return <MarketTags markets={Array.isArray(ms) ? ms : (ms ? [ms] : undefined)} />;
      }
    },
    { title: '默认币种', dataIndex: 'currency', key: 'currency', width: 100, render: (c: Currency) => <span style={{ fontSize: FONT.tableCell }}>{c}</span> },
    {
      title: '账户数', key: 'accCount', width: 80,
      render: (_: any, r: any) => {
        const count = accounts.filter(a => a.platformId === r.id).length;
        return <span style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>{count}</span>;
      }
    },
    {
      title: '盈亏记录', key: 'pnlCount', width: 80,
      render: (_: any, r: any) => {
        const count = pnlRecords.filter(p => p.platformId === r.id).length;
        return <span style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>{count}</span>;
      }
    },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true, render: (v: string) => <span style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>{v || '-'}</span> },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size={0} wrap={false}>
          <Button type="link" size="small" icon={<TeamOutlined />} onClick={() => { setAccountFilter(r.id); setActiveKey('account'); }} style={{ padding: '0 4px' }}>账户</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditP(r)} style={{ padding: '0 4px' }}>编辑</Button>
          <Popconfirm title="删除平台将同时删除其下所有账户和盈亏，确定？" onConfirm={() => deleteP(r.id)} okText="确定删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ padding: '0 4px' }}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // ====== 列定义：账户 ======
  const accountColumns = [
    {
      title: '账户名称', dataIndex: 'name', key: 'name', width: 160,
      render: (t: string, r: any) => {
        const pf = platforms.find(p => p.id === r.platformId);
        return (
          <div>
            <div style={{ fontWeight: 500, fontSize: FONT.tableCell, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t}>{t}</div>
            <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={'所属平台：' + (pf?.name || '未知')}>所属平台：{pf?.name || '未知'}</div>
          </div>
        );
      }
    },
    {
      title: '市场', key: 'markets', width: 110,
      render: (_: any, r: any) => {
        const pf = platforms.find(p => p.id === r.platformId);
        return <MarketTags markets={pf?.markets} />;
      }
    },
    {
      title: '类型', key: 'productType', width: 150,
      render: (_: any, r: any) => {
        let pts = r.productTypes;
        if (!pts && r.productType) pts = [r.productType];
        return <ProductTypeTags types={Array.isArray(pts) ? pts : (pts ? [pts] : undefined)} />;
      }
    },
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 72, render: (c: Currency) => <span style={{ fontSize: FONT.tableCell }}>{c}</span> },
    {
      title: '盈亏记录', key: 'pnlCount', width: 72,
      render: (_: any, r: any) => {
        const count = pnlRecords.filter(p => p.accountId === r.id).length;
        return <span style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>{count}</span>;
      }
    },
    { title: '备注', dataIndex: 'note', key: 'note', width: 140, ellipsis: true, render: (v: string) => <span title={v || ''} style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>{v || '-'}</span> },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size={0} wrap={false}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditA(r)} style={{ padding: '0 4px' }}>编辑</Button>
          <Popconfirm title="删除账户将同时删除其下所有盈亏记录，确定？" onConfirm={() => deleteA(r.id)} okText="确定删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ padding: '0 4px' }}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Tabs
        activeKey={activeKey}
        onChange={(k) => setActiveKey(k as any)}
        items={[
          {
            key: 'platform', label: `平台管理（${platforms.length}）`,
            children: (
              <SectionCard
                title={''}
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAddP}>添加平台</Button>}
              >
                {platforms.length === 0 ? (
                  <EmptyState description="暂无平台，点击「添加平台」开始" actionText="添加平台" onAction={openAddP} />
                ) : (
                  <Table columns={platformColumns} dataSource={platforms} rowKey="id" pagination={false} size="middle" scroll={{ x: 'max-content' }} />
                )}
              </SectionCard>
            )
          },
          {
            key: 'account', label: `账户管理（${accounts.length}）`,
            children: (
              <SectionCard
                title={''}
                extra={(
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {platforms.length > 0 && (
                      <Select value={accountFilter} onChange={setAccountFilter} style={{ width: 180 }}>
                        <Option value="all">全部平台</Option>
                        {platforms.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
                      </Select>
                    )}
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddA()} disabled={platforms.length === 0}>添加账户</Button>
                  </div>
                )}
              >
                {accounts.length === 0 ? (
                  <EmptyState
                    description={platforms.length === 0 ? '请先到「平台管理」添加平台，再添加账户' : '暂无账户，点击「添加账户」开始'}
                    actionText={platforms.length > 0 ? '添加账户' : undefined}
                    onAction={platforms.length > 0 ? () => openAddA() : undefined}
                  />
                ) : (
                  <Table columns={accountColumns} dataSource={filteredAccounts} rowKey="id" pagination={false} size="middle" scroll={{ x: 'max-content' }} />
                )}
              </SectionCard>
            )
          }
        ]}
      />

      {/* 平台 Modal */}
      <Modal title={pEditingId ? '编辑平台' : '添加平台'} open={pModalOpen} onOk={submitP} onCancel={() => setPModalOpen(false)} okText="保存" cancelText="取消" width={520} maskClosable={false}>
        <Form form={pForm} layout="vertical">
          <Form.Item name="name" label="平台名称" rules={[{ required: true, message: '请输入平台名称' }]}>
            <Input placeholder="如：Binance、富途、老虎证券" />
          </Form.Item>
          <Form.Item
            name="markets"
            label="市场类型（可多选）"
            tooltip="某券商同时支持美股和港股时可同时选择，至少选一个"
            rules={[{ required: true, message: '请选择市场类型' }]}
          >
            <Checkbox.Group
              options={(Object.keys(INVEST_MARKET_LABELS) as InvestMarket[]).map(m => ({
                label: INVEST_MARKET_LABELS[m], value: m
              }))}
            />
          </Form.Item>
          <Form.Item name="currency" label="默认记账币种" rules={[{ required: true, message: '请选择币种' }]} tooltip="该平台下新账户的默认币种，账户可单独覆盖">
            <Select>
              {(Object.keys(CURRENCY_LABELS) as Currency[]).map(c => <Option key={c} value={c}>{CURRENCY_LABELS[c]}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="note" label="备注"><Input.TextArea rows={2} placeholder="可选，如：主账户、长期持有账户" /></Form.Item>
        </Form>
      </Modal>

      {/* 账户 Modal */}
      <Modal
        title={aEditingId ? '编辑账户' : '添加账户'}
        open={aModalOpen}
        onOk={submitA}
        onCancel={() => setAModalOpen(false)}
        okText="保存" cancelText="取消" width={520} maskClosable={false}
        destroyOnClose
      >
        <Form form={aForm} layout="vertical">
          <Form.Item name="platformId" label="所属平台" rules={[{ required: true, message: '请选择平台' }]}>
            <Select
              placeholder="选择所属平台"
              onChange={(pid) => {
                const pf = platforms.find(p => p.id === pid);
                if (pf) {
                  // 类型改为可选，切换平台时不清空已有选择；仅同步币种
                  aForm.setFieldsValue({ currency: pf.currency });
                }
              }}
            >
              {platforms.map(p => (
                <Option key={p.id} value={p.id}>
                  {p.name}（{(p.markets || []).map(m => INVEST_MARKET_LABELS[m]).join(' + ') || '未知市场'}）
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="账户名称" rules={[{ required: true, message: '请输入账户名称' }]}>
            <Input placeholder="如：主账户、BTC 长线账户、港股打新账户" />
          </Form.Item>
          <Form.Item name="currency" label="记账币种" rules={[{ required: true, message: '请选择币种' }]}>
            <Select>
              {(Object.keys(CURRENCY_LABELS) as Currency[]).map(c => <Option key={c} value={c}>{CURRENCY_LABELS[c]}</Option>)}
            </Select>
          </Form.Item>
          {isCryptoPlatform && (
            <Form.Item
              name="productTypes"
              label="类型（可多选，非必填）"
              tooltip="加密平台可选择现货/合约/Web3钱包/Alpha，均为可选项"
            >
              <Checkbox.Group
                options={[
                  { label: '现货', value: 'spot' },
                  { label: '合约', value: 'futures' },
                  { label: 'Web3钱包', value: 'web3_wallet' },
                  { label: 'Alpha', value: 'alpha' },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item name="note" label="备注"><Input.TextArea rows={2} placeholder="可选，如：BTC 长线、AAPL 持仓" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
