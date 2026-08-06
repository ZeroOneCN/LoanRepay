import { useState, useRef } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Popconfirm, Tag, Space, Row, Col, DatePicker, message, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { DEFAULT_DEBT_TYPES, REPAYMENT_TYPE_LABELS, RepaymentType, Debt } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Option } = Select;

function getRepaymentTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    revolving: 'blue',
    interest_only: 'orange',
    flexible: 'green'
  };
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
  const importRef = useRef<any>(null);

  // 导出债务数据
  const handleExport = () => {
    if (debts.length === 0) {
      message.warning('暂无债务数据可导出');
      return;
    }
    const exportData = debts.map(d => ({
      '债务名称': d.name,
      '债务类型': d.type,
      '剩余金额': d.remainingAmount,
      '总额度': d.creditLimit || '',
      '年利率(%)': d.interestRate || '',
      '出账日': d.dueDate || '',
      '最迟还款日': d.lastDueDate || '',
      '还款方式': REPAYMENT_TYPE_LABELS[d.repaymentType as RepaymentType] || d.repaymentType,
      '到期日': d.maturityDate || '',
      '备注': d.note || ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '债务数据');
    // 设置列宽
    ws['!cols'] = [
      { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }
    ];
    XLSX.writeFile(wb, `债务数据_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('导出成功');
  };

  // 下载导入模板
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        '债务名称': '示例：招商银行信用卡',
        '债务类型': '信用卡',
        '剩余金额': 50000,
        '总额度': 100000,
        '年利率(%)': 18,
        '出账日': 10,
        '最迟还款日': 25,
        '还款方式': '循环贷',
        '到期日': '',
        '备注': '示例备注'
      },
      {
        '债务名称': '示例：蚂蚁借呗',
        '债务类型': '网贷',
        '剩余金额': 20000,
        '总额度': '',
        '年利率(%)': 15,
        '出账日': 1,
        '最迟还款日': 10,
        '还款方式': '灵活模式',
        '到期日': '',
        '备注': ''
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '导入模板');
    ws['!cols'] = [
      { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }
    ];
    XLSX.writeFile(wb, '债务导入模板.xlsx');
    message.success('模板下载成功');
  };

  // 导入债务数据
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

          if (jsonData.length === 0) {
            message.error('导入文件为空');
            setImportLoading(false);
            return;
          }

          const repayTypeMap: Record<string, RepaymentType> = {
            '循环贷': 'revolving',
            '先息后本': 'interest_only',
            '灵活模式': 'flexible'
          };

          // 获取已存在的债务名称用于去重
          const existingNames = new Set(debts.map(d => d.name));

          let successCount = 0;
          let skipCount = 0;
          let errorCount = 0;

          for (const row of jsonData) {
            try {
              const name = row['债务名称'];
              const type = row['债务类型'];
              const remainingAmount = row['剩余金额'];

              if (!name || !type || remainingAmount === undefined) {
                errorCount++;
                continue;
              }

              // 去重检查：已存在的债务名称跳过
              if (existingNames.has(String(name))) {
                skipCount++;
                continue;
              }

              const repayTypeKey = row['还款方式'] || '循环贷';
              const repayType = repayTypeMap[repayTypeKey] || 'revolving';

              const debtData: Omit<Debt, 'id' | 'createdAt'> = {
                name: String(name),
                type: String(type),
                remainingAmount: Number(remainingAmount),
                creditLimit: row['总额度'] ? Number(row['总额度']) : undefined,
                interestRate: row['年利率(%)'] ? Number(row['年利率(%)']) : undefined,
                dueDate: row['出账日'] ? Number(row['出账日']) : 1,
                lastDueDate: row['最迟还款日'] ? Number(row['最迟还款日']) : undefined,
                repaymentType: repayType,
                maturityDate: row['到期日'] ? String(row['到期日']) : undefined,
                note: row['备注'] ? String(row['备注']) : undefined
              };

              await addDebt(debtData);
              existingNames.add(String(name)); // 防止Excel中重复
              successCount++;
            } catch {
              errorCount++;
            }
          }

          const tips: string[] = [];
          if (successCount > 0) tips.push(`成功导入 ${successCount} 条`);
          if (skipCount > 0) tips.push(`跳过 ${skipCount} 条重复`);
          if (errorCount > 0) tips.push(`${errorCount} 条失败`);

          if (successCount > 0) {
            message.success(tips.join('，'));
          } else if (skipCount > 0) {
            message.info('所有数据均已存在，无需重复导入');
          } else {
            message.error('导入失败，请检查文件格式');
          }
        } catch {
          message.error('文件解析失败，请确保是有效的Excel文件');
        }
        setImportLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch {
      message.error('读取文件失败');
      setImportLoading(false);
    }
    return false;
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      type: '信用卡',
      dueDate: 10,
      repaymentType: 'revolving'
    });
    setIsModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      remainingAmount: record.remainingAmount,
      creditLimit: record.creditLimit,
      interestRate: record.interestRate,
      dueDate: record.dueDate,
      lastDueDate: record.lastDueDate,
      repaymentType: record.repaymentType || 'revolving',
      maturityDate: record.maturityDate ? dayjs(record.maturityDate) : undefined,
      note: record.note
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data: any = {
        ...values,
        maturityDate: values.maturityDate ? values.maturityDate.format('YYYY-MM-DD') : undefined
      };
      if (editingId) {
        await updateDebt(editingId, data);
      } else {
        await addDebt(data);
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error('Form validation failed:', e);
    }
  };

  const totalCreditLimit = debts.reduce((sum, d) => sum + (d.creditLimit || 0), 0);
  const totalAvailable = totalCreditLimit - totalDebt;

  const sortedDebts = [...debts].sort((a, b) => b.remainingAmount - a.remainingAmount);

  const columns = [
    {
      title: '债务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: any) => (
        <div style={{ wordBreak: 'break-all' }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{text}</div>
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
      render: (val: number) => <span style={{ color: '#ff4d4f', fontWeight: 500 }}>¥{formatMoney(val)}</span>,
      sorter: (a: any, b: any) => a.remainingAmount - b.remainingAmount
    },
    {
      title: '总额度',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      render: (val: number) => val ? `¥${formatMoney(val)}` : '-',
      sorter: (a: any, b: any) => (a.creditLimit || 0) - (b.creditLimit || 0)
    },
    {
      title: '已用额度',
      key: 'usedCredit',
      render: (_: any, record: any) => {
        if (!record.creditLimit) return '-';
        return <span style={{ color: '#ff4d4f', fontWeight: 500 }}>¥{formatMoney(record.remainingAmount)}</span>;
      }
    },
    {
      title: '剩余额度',
      key: 'availableCredit',
      render: (_: any, record: any) => {
        if (!record.creditLimit) return '-';
        const available = record.creditLimit - record.remainingAmount;
        const color = available < 0 ? '#ff4d4f' : '#52c41a';
        return <span style={{ color, fontWeight: 500 }}>¥{formatMoney(Math.max(0, available))}</span>;
      }
    },
    {
      title: '使用率',
      key: 'usageRate',
      render: (_: any, record: any) => {
        if (!record.creditLimit) return '-';
        const rate = (record.remainingAmount / record.creditLimit) * 100;
        let color = 'green';
        if (rate >= 90) color = 'red';
        else if (rate >= 70) color = 'orange';
        return <Tag color={color}>{rate.toFixed(1)}%</Tag>;
      }
    },
    {
      title: '年利率',
      dataIndex: 'interestRate',
      key: 'interestRate',
      render: (val: number) => val ? <Tag color={val >= 18 ? 'red' : val >= 10 ? 'orange' : 'green'}>{val}%</Tag> : '-',
      sorter: (a: any, b: any) => (a.interestRate || 0) - (b.interestRate || 0)
    },
    {
      title: '出账日',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (val: number) => val ? `每月${val}日` : '-'
    },
    {
      title: '最迟还款日',
      dataIndex: 'lastDueDate',
      key: 'lastDueDate',
      render: (val: number) => val ? `每月${val}日` : '-'
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (val: string) => val || '-',
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size={0} wrap={false}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确定删除？" onConfirm={async () => { await deleteDebt(record.id); }} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>债务管理</h3>
          <p style={{ margin: '4px 0 0 0', color: '#666' }}>
            总负债：<span style={{ color: '#ff4d4f', fontSize: 16, fontWeight: 600 }}>¥{formatMoney(totalDebt)}</span>
            {totalCreditLimit > 0 && (
              <>
                <span style={{ marginLeft: 16 }}>总额度：<span style={{ color: '#1890ff', fontSize: 14, fontWeight: 500 }}>¥{formatMoney(totalCreditLimit)}</span></span>
                <span style={{ marginLeft: 12 }}>已用：<span style={{ color: '#ff4d4f', fontSize: 14, fontWeight: 500 }}>¥{formatMoney(totalDebt)}</span></span>
                <span style={{ marginLeft: 12 }}>剩余：<span style={{ color: totalAvailable >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 14, fontWeight: 500 }}>¥{formatMoney(Math.max(0, totalAvailable))}</span></span>
              </>
            )}
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加债务
        </Button>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
          下载模板
        </Button>
        <Upload
          ref={importRef}
          accept=".xlsx,.xls"
          showUploadList={false}
          beforeUpload={handleImport}
        >
          <Button icon={<UploadOutlined />} loading={importLoading}>
            导入Excel
          </Button>
        </Upload>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出数据
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={sortedDebts}
        rowKey="id"
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
        }}
        size="middle"
        scroll={{ x: 1200 }}
      />

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
                <Input placeholder="如：招商银行信用卡、蚂蚁借呗" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="债务类型" rules={[{ required: true, message: '请选择债务类型' }]}>
                <Select placeholder="请选择债务类型">
                  {DEFAULT_DEBT_TYPES.map(type => (
                    <Option key={type} value={type}>{type}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="remainingAmount"
                label="当前剩余金额（元）"
                rules={[{ required: true, message: '请输入剩余金额' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} placeholder="如：50000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="creditLimit"
                label="总额度（元）"
                tooltip="信用卡/网贷的授信总额度，用于额度规划和借新还旧"
              >
                <InputNumber style={{ width: '100%' }} placeholder="如：100000" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="repaymentType"
                label="还款方式"
                rules={[{ required: true, message: '请选择还款方式' }]}
              >
                <Select placeholder="请选择还款方式">
                  <Option value="revolving">循环贷</Option>
                  <Option value="interest_only">先息后本</Option>
                  <Option value="flexible">灵活模式</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="interestRate"
                label="年利率（%）（可选）"
                tooltip="如果不记得可以不填"
              >
                <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} placeholder="如：18" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.repaymentType !== cur.repaymentType}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('repaymentType');
              if (type === 'flexible') return null;
              return (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="dueDate"
                      label="出账日"
                      rules={[{ required: true, message: '请输入出账日' }]}
                      tooltip="每月账单生成的日期"
                    >
                      <InputNumber style={{ width: '100%' }} min={1} max={31} placeholder="如：15" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="lastDueDate"
                      label="最迟还款日"
                      rules={[{ required: true, message: '请输入最迟还款日' }]}
                      tooltip="超过这天就算逾期"
                    >
                      <InputNumber style={{ width: '100%' }} min={1} max={31} placeholder="如：25" />
                    </Form.Item>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.repaymentType !== cur.repaymentType}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('repaymentType');
              if (type !== 'interest_only') return null;
              return (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="maturityDate"
                      label="到期日"
                      rules={[{ required: true, message: '请选择到期日' }]}
                      tooltip="先息后本到期时需一次性还本金"
                    >
                      <DatePicker style={{ width: '100%' }} placeholder="选择到期日" />
                    </Form.Item>
                  </Col>
                </Row>
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
