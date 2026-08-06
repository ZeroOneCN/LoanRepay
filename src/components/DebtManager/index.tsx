import { useState, useRef, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Popconfirm, Tag, Space, Row, Col, DatePicker, message, Dropdown, Input as AntInput, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, MoreOutlined, SearchOutlined } from '@ant-design/icons';
import { TransactionOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { DEFAULT_DEBT_TYPES, REPAYMENT_TYPE_LABELS, RepaymentType } from '../../types';
import { formatMoney, calculateMonthlyInterest } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING } from '../../styles/theme';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Option } = Select;
const { useBreakpoint } = Grid;

function getRepaymentTypeColor(type: string): string {
  const colorMap: Record<string, string> = { revolving: 'blue', interest_only: 'orange', flexible: 'green' };
  return colorMap[type] || 'default';
}

interface DebtFormValues {
  name: string;
  type: string;
  remainingAmount: number;
  creditLimit?: number;
  interestRate?: number;
  dueDate: number;
  lastDueDate?: number;
  repaymentType: RepaymentType;
  maturityDate?: dayjs.Dayjs;
  note?: string;
}

export default function DebtManager() {
  const { debts, addDebt, updateDebt, deleteDebt, totalDebt } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [repayModal, setRepayModal] = useState<{ visible: boolean; debtId: string; debtName: string; remaining: number }>({ visible: false, debtId: '', debtName: '', remaining: 0 });
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [form] = Form.useForm<DebtFormValues>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screens = useBreakpoint();

  const handleExport = () => {
    if (debts.length === 0) { message.warning('暂无债务数据可导出'); return; }
    const exportData = debts.map(d => ({
      '债务名称': d.name, '债务类型': d.type, '剩余金额': d.remainingAmount,
      '总额度': d.creditLimit || '', '年利率(%)': d.interestRate || '',
      '出账日': d.dueDate || '', '最迟还款日': d.lastDueDate || '',
      '还款方式': REPAYMENT_TYPE_LABELS[d.repaymentType as RepaymentType] || d.repaymentType,
      '到期日': d.maturityDate || '', '备注': d.note || ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '债务数据');
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
    XLSX.writeFile(wb, `债务数据_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('导出成功');
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { '债务名称': '示例：招商银行信用卡', '债务类型': '信用卡', '剩余金额': 50000, '总额度': 100000, '年利率(%)': 18, '出账日': 10, '最迟还款日': 25, '还款方式': '循环贷', '到期日': '', '备注': '示例备注' },
      { '债务名称': '示例：蚂蚁借呗', '债务类型': '网贷', '剩余金额': 20000, '总额度': '', '年利率(%)': 15, '出账日': 1, '最迟还款日': 10, '还款方式': '灵活模式', '到期日': '', '备注': '' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '导入模板');
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
    XLSX.writeFile(wb, '债务导入模板.xlsx');
    message.success('模板下载成功');
  };

  const handleImport = async (file: File) => {
    setImportLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
          if (jsonData.length === 0) { message.error('导入文件为空'); setImportLoading(false); return; }
          const repayTypeMap: Record<string, RepaymentType> = { '循环贷': 'revolving', '先息后本': 'interest_only', '灵活模式': 'flexible' };
          const existingNames = new Set(debts.map(d => d.name));
          let successCount = 0, skipCount = 0, errorCount = 0;
          for (const row of jsonData) {
            try {
              const name = row['债务名称']; const type = row['债务类型']; const remainingAmount = row['剩余金额'];
              if (!name || !type || remainingAmount === undefined) { errorCount++; continue; }
              if (existingNames.has(String(name))) { skipCount++; continue; }
              const repayType = repayTypeMap[row['还款方式'] || '循环贷'] || 'revolving';
              await addDebt({
                name: String(name), type: String(type), remainingAmount: Number(remainingAmount),
                creditLimit: row['总额度'] ? Number(row['总额度']) : undefined,
                interestRate: row['年利率(%)'] ? Number(row['年利率(%)']) : undefined,
                dueDate: row['出账日'] ? Number(row['出账日']) : 1,
                lastDueDate: row['最迟还款日'] ? Number(row['最迟还款日']) : undefined,
                repaymentType: repayType,
                maturityDate: row['到期日'] ? String(row['到期日']) : undefined,
                note: row['备注'] ? String(row['备注']) : undefined
              });
              existingNames.add(String(name));
              successCount++;
            } catch { errorCount++; }
          }
          const tips: string[] = [];
          if (successCount > 0) tips.push(`成功导入 ${successCount} 条`);
          if (skipCount > 0) tips.push(`跳过 ${skipCount} 条重复`);
          if (errorCount > 0) tips.push(`${errorCount} 条失败`);
          if (successCount > 0) message.success(tips.join('，'));
          else if (skipCount > 0) message.info('所有数据均已存在，无需重复导入');
          else message.error('导入失败，请检查文件格式');
        } catch { message.error('文件解析失败，请确保是有效的Excel文件'); }
        setImportLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch { message.error('读取文件失败'); setImportLoading(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
    e.target.value = '';
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ type: '信用卡', dueDate: 10, repaymentType: 'revolving' });
    setIsModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name, type: record.type, remainingAmount: record.remainingAmount,
      creditLimit: record.creditLimit, interestRate: record.interestRate,
      dueDate: record.dueDate, lastDueDate: record.lastDueDate,
      repaymentType: record.repaymentType || 'revolving',
      maturityDate: record.maturityDate ? dayjs(record.maturityDate) : undefined,
      note: record.note
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data: any = { ...values, maturityDate: values.maturityDate ? values.maturityDate.format('YYYY-MM-DD') : undefined };
      if (editingId) { await updateDebt(editingId, data); message.success('债务更新成功'); }
      else { await addDebt(data); message.success('债务添加成功'); }
      setIsModalOpen(false);
    } catch (e) { console.error('Form validation failed:', e); }
  };

  const handleRepay = (record: any) => {
    setRepayModal({ visible: true, debtId: record.id, debtName: record.name, remaining: record.remainingAmount });
    setRepayAmount(0);
  };

  const handleRepaySubmit = async () => {
    if (repayAmount <= 0) { message.warning('请输入有效还款金额'); return; }
    if (repayAmount > repayModal.remaining) { message.warning('还款金额不能超过剩余金额'); return; }
    const newRemaining = repayModal.remaining - repayAmount;
    await updateDebt(repayModal.debtId, { remainingAmount: newRemaining });
    if (newRemaining === 0) {
      message.success(`「${repayModal.debtName}」已还清`);
    } else {
      message.success(`「${repayModal.debtName}」还款成功，剩余 ¥${formatMoney(newRemaining)}`);
    }
    setRepayModal({ ...repayModal, visible: false });
  };

  const totalCreditLimit = debts.reduce((sum, d) => sum + (d.creditLimit || 0), 0);
  const totalAvailable = totalCreditLimit - totalDebt;

  // 搜索 + 筛选
  const filteredDebts = useMemo(() => {
    let result = [...debts];
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q));
    }
    if (filterType !== 'all') {
      result = result.filter(d => d.type === filterType);
    }
    return result.sort((a, b) => b.remainingAmount - a.remainingAmount);
  }, [debts, searchText, filterType]);

  const debtTypes = useMemo(() => {
    const types = new Set(debts.map(d => d.type));
    return Array.from(types);
  }, [debts]);

  const columns = [
    {
      title: '债务名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4, fontSize: FONT.tableCell }}>{text}</div>
          <Space size={4} wrap>
            <Tag color="blue">{record.type}</Tag>
            <Tag color={getRepaymentTypeColor(record.repaymentType)}>
              {REPAYMENT_TYPE_LABELS[record.repaymentType as RepaymentType] || record.repaymentType}
            </Tag>
          </Space>
        </div>
      )
    },
    {
      title: '剩余金额',
      dataIndex: 'remainingAmount',
      key: 'remainingAmount',
      width: 120,
      ellipsis: true,
      defaultSortOrder: 'descend' as const,
      render: (val: number) => <span style={{ color: COLORS.danger, fontWeight: 500, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span>,
      sorter: (a: any, b: any) => a.remainingAmount - b.remainingAmount
    },
    {
      title: '额度使用',
      key: 'creditInfo',
      width: 130,
      ellipsis: true,
      render: (_: any, record: any) => {
        if (!record.creditLimit) return <span style={{ color: COLORS.textTertiary, fontSize: FONT.tableCell }}>-</span>;
        const rate = (record.remainingAmount / record.creditLimit) * 100;
        const color = rate >= 90 ? COLORS.danger : rate >= 70 ? COLORS.warning : COLORS.success;
        return (
          <div>
            <div style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>¥{formatMoney(record.creditLimit)}</div>
            <div style={{ color, fontSize: FONT.caption, fontWeight: 500 }}>{rate.toFixed(1)}% 已用</div>
          </div>
        );
      },
      sorter: (a: any, b: any) => (a.creditLimit || 0) - (b.creditLimit || 0)
    },
    {
      title: '年利率',
      dataIndex: 'interestRate',
      key: 'interestRate',
      width: 80,
      render: (val: number) => val ? <Tag color={val >= 18 ? 'red' : val >= 10 ? 'orange' : 'green'}>{val}%</Tag> : '-',
      sorter: (a: any, b: any) => (a.interestRate || 0) - (b.interestRate || 0)
    },
    {
      title: '还款日',
      key: 'dueDates',
      render: (_: any, record: any) => {
        const parts: string[] = [];
        if (record.dueDate) parts.push(`出账${record.dueDate}日`);
        if (record.lastDueDate) parts.push(`到期${record.lastDueDate}日`);
        return <span style={{ fontSize: FONT.tableCell }}>{parts.join(' / ') || '-'}</span>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          <Button type="link" size="small" onClick={() => handleRepay(record)} style={{ padding: '0 4px' }}>还款</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)} style={{ padding: '0 4px' }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={async () => { await deleteDebt(record.id); message.success('删除成功'); }} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger style={{ padding: '0 4px' }}>删除</Button>
          </Popconfirm>
        </div>
      )
    }
  ];

  const moreMenuItems = [
    { key: 'template', label: '下载模板', icon: <DownloadOutlined />, onClick: handleDownloadTemplate },
    { key: 'import', label: '导入Excel', icon: <UploadOutlined />, onClick: () => fileInputRef.current?.click() },
    { key: 'export', label: '导出数据', icon: <DownloadOutlined />, onClick: handleExport },
  ];

  // 移动端卡片渲染
  const isMobile = !screens.md;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      {importLoading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>导入中...</div>
        </div>
      )}

      <PageHeader
        title="债务管理"
        subtitle={`总负债 ¥${formatMoney(totalDebt)}${totalCreditLimit > 0 ? ` ｜ 额度 ¥${formatMoney(totalCreditLimit)} ｜ 可用 ¥${formatMoney(Math.max(0, totalAvailable))}` : ''}`}
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加债务</Button>
            <Dropdown menu={{ items: moreMenuItems }}>
              <Button icon={<MoreOutlined />}>更多操作</Button>
            </Dropdown>
          </Space>
        }
      />

      {/* 搜索 + 筛选 */}
      {debts.length > 0 && (
        <Row gutter={SPACING.sm} style={{ marginBottom: SPACING.lg }}>
          <Col xs={24} sm={12} md={8}>
            <AntInput
              prefix={<SearchOutlined style={{ color: COLORS.textTertiary }} />}
              placeholder="搜索债务名称或类型"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              value={filterType}
              onChange={setFilterType}
              style={{ width: '100%' }}
            >
              <Option value="all">全部类型</Option>
              {debtTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
            </Select>
          </Col>
        </Row>
      )}

      {debts.length === 0 ? (
        <EmptyState description="还没有债务记录，点击上方「添加债务」开始管理" actionText="添加债务" onAction={handleAdd} />
      ) : filteredDebts.length === 0 ? (
        <EmptyState description="没有匹配的债务记录" />
      ) : isMobile ? (
        /* 移动端卡片列表 */
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
          {filteredDebts.map((item: any) => (
            <div
              key={item.id}
              style={{
                background: COLORS.bgCard,
                borderRadius: 8,
                padding: SPACING.lg,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {/* 标题行 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: FONT.body, marginBottom: 4 }}>{item.name}</div>
                  <Space size={4} wrap>
                    <Tag color="blue">{item.type}</Tag>
                    <Tag color={getRepaymentTypeColor(item.repaymentType)}>
                      {REPAYMENT_TYPE_LABELS[item.repaymentType as RepaymentType] || item.repaymentType}
                    </Tag>
                  </Space>
                </div>
                <span style={{ color: COLORS.danger, fontWeight: 500, fontSize: FONT.body }}>¥{formatMoney(item.remainingAmount)}</span>
              </div>
              {/* 信息行 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.sm }}>
                {item.creditLimit && (
                  <div>
                    <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>额度</div>
                    <div style={{ fontSize: FONT.bodySmall }}>¥{formatMoney(item.creditLimit)}</div>
                  </div>
                )}
                {item.interestRate && (
                  <div>
                    <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>年利率</div>
                    <div style={{ fontSize: FONT.bodySmall }}>
                      <Tag color={item.interestRate >= 18 ? 'red' : item.interestRate >= 10 ? 'orange' : 'green'} style={{ marginLeft: 0 }}>{item.interestRate}%</Tag>
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>还款日</div>
                  <div style={{ fontSize: FONT.bodySmall }}>
                    {[item.dueDate && `出账${item.dueDate}日`, item.lastDueDate && `到期${item.lastDueDate}日`].filter(Boolean).join(' / ') || '-'}
                  </div>
                </div>
                {item.interestRate && (
                  <div>
                    <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>月利息</div>
                    <div style={{ fontSize: FONT.bodySmall, color: COLORS.warning }}>¥{formatMoney(calculateMonthlyInterest(item.remainingAmount, item.interestRate))}</div>
                  </div>
                )}
              </div>
              {/* 操作行 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 0, marginTop: SPACING.sm, borderTop: `1px solid ${COLORS.border}`, paddingTop: SPACING.sm }}>
                <Button type="link" size="small" icon={<TransactionOutlined />} onClick={() => handleRepay(item)}>还款</Button>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(item)}>编辑</Button>
                <Popconfirm title="确定删除？" onConfirm={async () => { await deleteDebt(item.id); message.success('删除成功'); }} okText="确定" cancelText="取消">
                  <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 桌面端表格 */
        <Table
          columns={columns}
          dataSource={filteredDebts}
          rowKey="id"
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          size="middle"
        />
      )}

      <Modal
        title={editingId ? '编辑债务' : '添加债务'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={600}
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="债务名称" rules={[{ required: true, message: '请输入债务名称' }]}>
                <Input placeholder="如：招商银行信用卡" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="债务类型" rules={[{ required: true, message: '请选择债务类型' }]}>
                <Select placeholder="请选择">{DEFAULT_DEBT_TYPES.map(type => <Option key={type} value={type}>{type}</Option>)}</Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="remainingAmount" label="当前剩余金额（元）" rules={[{ required: true, message: '请输入剩余金额' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="如：50000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="creditLimit" label="总额度（元）" tooltip="信用卡/网贷的授信总额度">
                <InputNumber style={{ width: '100%' }} placeholder="如：100000" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="repaymentType" label="还款方式" rules={[{ required: true, message: '请选择还款方式' }]}>
                <Select>
                  <Option value="revolving">循环贷</Option>
                  <Option value="interest_only">先息后本</Option>
                  <Option value="flexible">灵活模式</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="interestRate" label="年利率（%）" tooltip="信用卡通常18%，网贷15-24%，银行贷款3-8%">
                <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} placeholder="如：18" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.repaymentType !== cur.repaymentType}>
            {({ getFieldValue }) => {
              const type = getFieldValue('repaymentType');
              if (type === 'flexible') return null;
              return (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="dueDate" label="出账日" rules={[{ required: true, message: '请输入出账日' }]} tooltip="每月账单生成的日期">
                      <InputNumber style={{ width: '100%' }} min={1} max={31} placeholder="如：15" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="lastDueDate" label="最迟还款日" rules={[{ required: true, message: '请输入最迟还款日' }]} tooltip="超过这天就算逾期">
                      <InputNumber style={{ width: '100%' }} min={1} max={31} placeholder="如：25" />
                    </Form.Item>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.repaymentType !== cur.repaymentType}>
            {({ getFieldValue }) => {
              const type = getFieldValue('repaymentType');
              if (type !== 'interest_only') return null;
              return (
                <Form.Item name="maturityDate" label="到期日" rules={[{ required: true, message: '请选择到期日' }]} tooltip="先息后本到期时需一次性还本金">
                  <DatePicker style={{ width: '100%' }} placeholder="选择到期日" />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 还款扣减 Modal */}
      <Modal
        title="还款扣减"
        open={repayModal.visible}
        onOk={handleRepaySubmit}
        onCancel={() => setRepayModal({ ...repayModal, visible: false })}
        okText="确认还款"
        cancelText="取消"
        width={440}
        maskClosable={false}
      >
        <div style={{ marginBottom: SPACING.lg }}>
          <div style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary, marginBottom: SPACING.sm }}>
            债务：{repayModal.debtName}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, background: COLORS.bgLight, borderRadius: 6 }}>
            <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>当前剩余金额</span>
            <span style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.danger }}>¥{formatMoney(repayModal.remaining)}</span>
          </div>
        </div>
        <Form layout="vertical">
          <Form.Item label="本次还款金额（元）" required>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={repayModal.remaining}
              value={repayAmount}
              onChange={(v) => setRepayAmount(v ?? 0)}
              placeholder="输入还款金额"
            />
          </Form.Item>
          <Space>
            <Button size="small" onClick={() => setRepayAmount(repayModal.remaining)}>全额还清</Button>
            <Button size="small" onClick={() => setRepayAmount(Math.round(repayModal.remaining * 0.1 * 100) / 100)}>还最低（10%）</Button>
            <Button size="small" onClick={() => setRepayAmount(Math.round(repayModal.remaining * 0.5 * 100) / 100)}>还一半</Button>
          </Space>
          {repayAmount > 0 && (
            <div style={{ marginTop: SPACING.md, padding: SPACING.md, background: COLORS.bgPrimaryLight, borderRadius: 6, fontSize: FONT.bodySmall }}>
              还款后剩余：<strong style={{ color: COLORS.primary, fontSize: FONT.body }}>¥{formatMoney(repayModal.remaining - repayAmount)}</strong>
              {repayModal.remaining - repayAmount === 0 && <span style={{ marginLeft: SPACING.sm, color: COLORS.success, fontWeight: 500 }}>（已还清）</span>}
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}
