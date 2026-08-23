import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Form, Input, Select, Popconfirm, Tag, Space, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { InvestMemo, MemoStatus } from '../../types';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import PaginatedTable from '../Common/PaginatedTable';
import { COLORS, FONT, SPACING } from '../../styles/theme';

const { Option } = Select;
const { TextArea } = Input;

interface MemoFormValues {
  platformId?: string;
  accountId?: string;
  title: string;
  approxAmount?: string;
  approxDate?: string;
  note?: string;
}

export default function InvestMemoPage() {
  const navigate = useNavigate();
  const { memos, platforms, accounts, addMemo, updateMemo, deleteMemo } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [form] = Form.useForm<MemoFormValues>();

  const filteredMemos = useMemo(() => {
    let list = memos;
    if (filterStatus !== 'all') {
      list = list.filter(m => m.status === filterStatus);
    }
    return list;
  }, [memos, filterStatus]);

  const pendingCount = memos.filter(m => m.status === 'pending').length;
  const doneCount = memos.filter(m => m.status === 'done').length;

  const openAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (memo: InvestMemo) => {
    setEditingId(memo.id);
    setModalOpen(true);
    setTimeout(() => {
      form.setFieldsValue({
        platformId: memo.platformId,
        accountId: memo.accountId,
        title: memo.title,
        approxAmount: memo.approxAmount,
        approxDate: memo.approxDate,
        note: memo.note,
      });
    }, 50);
  };

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields();
      if (editingId) {
        await updateMemo(editingId, v);
        message.success('备忘录已更新');
      } else {
        await addMemo({ ...v, status: 'pending' as MemoStatus });
        message.success('备忘录已添加');
      }
      setModalOpen(false);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '操作失败');
    }
  };

  const handleMarkDone = async (memo: InvestMemo) => {
    await updateMemo(memo.id, { status: 'done' });
    message.success('已标记为已处理');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemo(id);
      message.success('备忘录已删除');
    } catch (e: any) {
      message.error(e?.message || '删除失败');
    }
  };

  const handleConvertToPnl = (memo: InvestMemo) => {
    // 跳转到盈亏记录页面，通过 state 传递预填数据
    navigate('/invest/records', {
      state: {
        fromMemo: true,
        accountId: memo.accountId,
        platformId: memo.platformId,
        approxAmount: memo.approxAmount,
        approxDate: memo.approxDate,
        note: memo.title,
        memoId: memo.id,
      }
    });
  };

  // 筛选平台关联的账户
  const selectedPlatformId = Form.useWatch('platformId', form);
  const platformAccounts = useMemo(() => {
    if (!selectedPlatformId) return accounts;
    return accounts.filter(a => a.platformId === selectedPlatformId);
  }, [accounts, selectedPlatformId]);

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string) => <span style={{ fontWeight: 500, fontSize: FONT.tableCell }}>{text}</span>,
    },
    {
      title: '关联平台',
      dataIndex: 'platformId',
      key: 'platformId',
      width: 120,
      render: (pid: string) => {
        const pf = platforms.find(p => p.id === pid);
        return <span style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>{pf?.name || '-'}</span>;
      },
    },
    {
      title: '大概金额',
      dataIndex: 'approxAmount',
      key: 'approxAmount',
      width: 120,
      render: (val: string) => <span style={{ fontSize: FONT.tableCell, color: COLORS.warning }}>{val || '-'}</span>,
    },
    {
      title: '大概时间',
      dataIndex: 'approxDate',
      key: 'approxDate',
      width: 120,
      render: (val: string) => <span style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>{val || '-'}</span>,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (val: string) => <span title={val || ''} style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>{val || '-'}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === 'done' ? 'default' : 'processing'}>
          {status === 'done' ? '已处理' : '待处理'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: InvestMemo) => (
        <Space size={0} wrap={false}>
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" onClick={() => handleConvertToPnl(record)} style={{ padding: '0 4px' }}>
                转记录
              </Button>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleMarkDone(record)} style={{ padding: '0 4px' }}>
                完成
              </Button>
            </>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} style={{ padding: '0 4px' }}>编辑</Button>
          <Popconfirm title="删除这条备忘录？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ padding: '0 4px' }}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 统计卡片 — 一行显示 */}
      <div style={{ display: 'flex', gap: SPACING.lg, marginBottom: SPACING.lg, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140, padding: SPACING.md, borderRadius: 8, background: COLORS.bgPrimaryLight }}>
          <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>备忘录总数</div>
          <div style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.primary, marginTop: 2 }}>{memos.length}</div>
        </div>
        <div style={{ flex: 1, minWidth: 140, padding: SPACING.md, borderRadius: 8, background: COLORS.bgWarningLight }}>
          <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>待处理</div>
          <div style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.warning, marginTop: 2 }}>{pendingCount}</div>
        </div>
        <div style={{ flex: 1, minWidth: 140, padding: SPACING.md, borderRadius: 8, background: COLORS.bgSuccessLight }}>
          <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>已处理</div>
          <div style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.success, marginTop: 2 }}>{doneCount}</div>
        </div>
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          style={{ width: 140 }}
        >
          <Option value="all">全部（{memos.length}）</Option>
          <Option value="pending">待处理（{pendingCount}）</Option>
          <Option value="done">已处理（{doneCount}）</Option>
        </Select>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>添加备忘录</Button>
      </div>

      {memos.length === 0 ? (
        <EmptyState description="暂无备忘录。凭记忆记录模糊的投资信息，找到准确数据后可一键转为正式盈亏记录。" />
      ) : (
        <PaginatedTable
          columns={columns}
          dataSource={filteredMemos}
          rowKey="id"
          size="middle"
          scroll={{ x: 'max-content' }}
        />
      )}

      {/* 添加/编辑 Modal */}
      <Modal
        title={editingId ? '编辑备忘录' : '添加备忘录'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editingId ? '保存' : '添加'}
        width={520}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="简要描述，如：币安现货BTC盈利" />
          </Form.Item>
          <Form.Item name="platformId" label="关联平台（可选）">
            <Select
              placeholder="选择平台"
              allowClear
              onChange={() => form.setFieldValue('accountId', undefined)}
            >
              {platforms.map(p => (
                <Option key={p.id} value={p.id}>{p.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="accountId" label="关联账户（可选）">
            <Select placeholder="选择账户" allowClear disabled={!platforms.length}>
              {platformAccounts.map(a => (
                <Option key={a.id} value={a.id}>{a.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="approxAmount" label="大概金额" tooltip="支持模糊输入，如：1000左右、约500">
            <Input placeholder="如：1000左右" />
          </Form.Item>
          <Form.Item name="approxDate" label="大概时间" tooltip="支持模糊输入，如：去年年底、2024年Q1">
            <Input placeholder="如：去年年底" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <TextArea rows={3} placeholder="详细描述，方便后续核实" />
          </Form.Item>
        </Form>
        <div style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.sm }}>
          <ArrowRightOutlined style={{ marginRight: 6 }} />
          找到准确数据后，点击「转记录」可一键跳转到盈亏记录页面补录。
        </div>
      </Modal>
    </div>
  );
}
