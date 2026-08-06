import { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Popconfirm, Tag, Space, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { AssetType, LiquidityLevel, ASSET_TYPE_LABELS, LIQUIDITY_LABELS } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';

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
      } else {
        await addAsset(values);
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

  const columns = [
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{text}</span>
          <Tag color="blue">{ASSET_TYPE_LABELS[record.type as AssetType]}</Tag>
        </Space>
      )
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => <span style={{ color: '#52c41a', fontWeight: 500 }}>¥{formatMoney(val)}</span>,
      sorter: (a: any, b: any) => a.amount - b.amount
    },
    {
      title: '流动性',
      dataIndex: 'liquidity',
      key: 'liquidity',
      render: (val: LiquidityLevel) => <Tag color={liquidityColor[val]}>{LIQUIDITY_LABELS[val]}</Tag>
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除这笔资产？" onConfirm={async () => { await deleteAsset(record.id); }} okText="确定" cancelText="取消">
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>资产管理</h3>
          <p style={{ margin: '4px 0 0 0', color: '#666' }}>
            总资产：<span style={{ color: '#52c41a', fontSize: 18, fontWeight: 600 }}>¥{formatMoney(totalAsset)}</span>
            <span style={{ marginLeft: 16, fontSize: 12 }}>
              高流动性：¥{formatMoney(highLiquidityAmount)}
            </span>
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加资产
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={assets}
        rowKey="id"
        pagination={false}
        size="middle"
      />

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
