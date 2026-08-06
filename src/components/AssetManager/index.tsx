import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Popconfirm, Tag, Space, Row, Col, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BankOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { AssetType, LiquidityLevel, ASSET_TYPE_LABELS, LIQUIDITY_LABELS } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import StatisticCard from '../Common/StatisticCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING } from '../../styles/theme';

const { Option } = Select;

interface AssetFormValues {
  name: string;
  type: AssetType;
  amount: number;
  liquidity: LiquidityLevel;
  note?: string;
}

export default function AssetManager() {
  const { assets, addAsset, updateAsset, deleteAsset, totalAsset } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<AssetFormValues>();

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'bank',
      liquidity: 'high'
    });
    setIsModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      amount: record.amount,
      liquidity: record.liquidity,
      note: record.note
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await updateAsset(editingId, values);
        message.success('资产更新成功');
      } else {
        await addAsset(values);
        message.success('资产添加成功');
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error('Form validation failed:', e);
    }
  };

  const liquidityColor = {
    high: 'green',
    medium: 'orange',
    low: 'red'
  };

  const liquidityIcon = {
    high: '●',
    medium: '◆',
    low: '▲'
  };

  const columns = [
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500, fontSize: FONT.tableCell }}>{text}</span>
          <Tag color="blue">{ASSET_TYPE_LABELS[record.type as AssetType]}</Tag>
        </Space>
      )
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => <span style={{ color: COLORS.success, fontWeight: 500, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span>,
      sorter: (a: any, b: any) => a.amount - b.amount
    },
    {
      title: '流动性',
      dataIndex: 'liquidity',
      key: 'liquidity',
      render: (val: LiquidityLevel) => (
        <Tag color={liquidityColor[val]}>
          {liquidityIcon[val]} {LIQUIDITY_LABELS[val]}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除这笔资产？" onConfirm={async () => { await deleteAsset(record.id); message.success('删除成功'); }} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const highLiquidityAmount = assets
    .filter(a => a.liquidity === 'high')
    .reduce((sum, a) => sum + a.amount, 0);

  return (
    <div>
      <PageHeader
        title="资产管理"
        subtitle="管理你的资产，了解资产流动性和分布情况"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加资产
          </Button>
        }
      />

      {/* 统计栏 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12} md={8}>
          <StatisticCard
            title="总资产"
            value={totalAsset}
            precision={2}
            prefix={<BankOutlined />}
            suffix="元"
            color={COLORS.success}
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatisticCard
            title="高流动性资产"
            value={highLiquidityAmount}
            precision={2}
            prefix="¥"
            color={COLORS.primary}
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatisticCard
            title="资产笔数"
            value={assets.length}
            prefix="📦"
            suffix="笔"
            color={COLORS.textPrimary}
          />
        </Col>
      </Row>

      {/* 表格 */}
      {assets.length === 0 ? (
        <EmptyState
          description="还没有资产记录，点击上方「添加资产」开始管理"
          actionText="添加资产"
          onAction={handleAdd}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={assets}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      )}

      <Modal
        title={editingId ? '编辑资产' : '添加资产'}
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
              <Form.Item name="name" label="资产名称" rules={[{ required: true, message: '请输入资产名称' }]}>
                <Input placeholder="如：招商银行储蓄卡" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="资产类型" rules={[{ required: true, message: '请选择资产类型' }]}>
                <Select>
                  {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                    <Option key={value} value={value}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="金额（元）"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} placeholder="如：50000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="liquidity"
                label="流动性"
                rules={[{ required: true, message: '请选择流动性' }]}
                tooltip="流动性越高，越容易变现用于还款"
              >
                <Select>
                  <Option value="high">高流动性（随取随用）</Option>
                  <Option value="medium">中流动性（T+1~T+7）</Option>
                  <Option value="low">低流动性（定期/长期）</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}