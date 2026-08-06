import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Popconfirm, Tag, Space, Row, Col, DatePicker, message, Upload, Dropdown } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, MoreOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { DEFAULT_DEBT_TYPES, REPAYMENT_TYPE_LABELS, RepaymentType, Debt } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import EmptyState from '../Common/EmptyState';
import SectionCard from '../Common/SectionCard';
import StatisticCard from '../Common/StatisticCard';
import { COLORS, FONT, SPACING } from '../../styles/theme';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Option } = Select;

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
  const [form] = Form.useForm<DebtFormValues>();

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
    return false;
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

  const totalCreditLimit = debts.reduce((sum, d) => sum + (d.creditLimit || 0), 0);
  const totalAvailable = totalCreditLimit - totalDebt;
  const sortedDebts = [...debts].sort((a, b) => b.remainingAmount - a.remainingAmount);

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
      defaultSortOrder: 'descend' as const,
      render: (val: number) => <span style={{ color: COLORS.danger, fontWeight: 500, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span>,
      sorter: (a: any, b: any) => a.remainingAmount - b.remainingAmount
    },
    {
      title: '额度使用',
      key: 'creditInfo',
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
      width: 120,
      render: (_: any, record: any) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={async () => { await deleteDebt(record.id); message.success('删除成功'); }} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const moreMenuItems = [
    { key: 'template', label: '下载模板', icon: <DownloadOutlined />, onClick: handleDownloadTemplate },
    { key: 'import', label: '导入Excel', icon: <UploadOutlined />, onClick: () => {} },
    { key: 'export', label: '导出数据', icon: <DownloadOutlined />, onClick: handleExport },
  ];

  return (
    <div>
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

      {/* 隐藏的 Upload，通过 Dropdown 触发 */}
      <Upload
        accept=".xlsx,.xls"
        showUploadList={false}
        beforeUpload={handleImport}
        style={{ display: 'none' }}
        id="debt-import-upload"
      >
        <span style={{ display: 'none' }} />
      </Upload>
      {importLoading && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div>导入中...</div></div>}

      {debts.length === 0 ? (
        <EmptyState description="还没有债务记录，点击上方「添加债务」开始管理" actionText="添加债务" onAction={handleAdd} />
      ) : (
        <Table
          columns={columns}
          dataSource={sortedDebts}
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
    </div>
  );
}
