import { Card, Form, InputNumber, Row, Col, Statistic, Progress, Button, Divider } from 'antd';
import { DollarOutlined, ShoppingCartOutlined, BankOutlined, CalculatorOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { formatMoney } from '../../utils/repaymentEngine';

interface IncomeFormValues {
  monthlyIncome: number;
  monthlyExpense: number;
  extraIncome?: number;
}

export default function IncomeManager() {
  const { incomeConfig, updateIncomeConfig, totalDebt } = useApp();
  const [form] = Form.useForm<IncomeFormValues>();

  const handleValuesChange = (_: any, allValues: IncomeFormValues) => {
    const available = allValues.monthlyIncome - allValues.monthlyExpense + (allValues.extraIncome || 0);
    updateIncomeConfig({
      monthlyIncome: allValues.monthlyIncome,
      monthlyExpense: allValues.monthlyExpense,
      extraIncome: allValues.extraIncome || 0,
      availableForRepayment: Math.max(0, available)
    });
  };

  const availableRatio = incomeConfig.monthlyIncome > 0
    ? (incomeConfig.availableForRepayment / incomeConfig.monthlyIncome) * 100
    : 0;

  const monthsToPayoff = incomeConfig.availableForRepayment > 0 && totalDebt > 0
    ? Math.ceil(totalDebt / incomeConfig.availableForRepayment)
    : Infinity;

  const expenseRatio = incomeConfig.monthlyIncome > 0
    ? (incomeConfig.monthlyExpense / incomeConfig.monthlyIncome) * 100
    : 0;

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>收入与支出</h3>
      <p style={{ color: '#666' }}>设置你的月收入和固定支出，系统将自动计算可用于还款的金额</p>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="月收入"
              value={incomeConfig.monthlyIncome}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              suffix="元"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="月支出"
              value={incomeConfig.monthlyExpense}
              prefix={<ShoppingCartOutlined style={{ color: '#ff4d4f' }} />}
              suffix="元"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="可用于还款"
              value={incomeConfig.availableForRepayment}
              prefix={<BankOutlined style={{ color: '#1890ff' }} />}
              suffix="元"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="预计还清时间"
              value={isFinite(monthsToPayoff) ? monthsToPayoff : '--'}
              prefix={<CalculatorOutlined style={{ color: '#722ed1' }} />}
              suffix={isFinite(monthsToPayoff) ? '个月' : ''}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="支出占比" size="small">
            <Progress
              type="dashboard"
              percent={Math.min(100, expenseRatio)}
              strokeColor={expenseRatio > 70 ? '#ff4d4f' : expenseRatio > 50 ? '#faad14' : '#52c41a'}
              format={(percent) => `${percent?.toFixed(1)}%`}
            />
            <p style={{ textAlign: 'center', color: '#666', marginTop: 8 }}>
              {expenseRatio > 70 ? '支出过高，建议压缩' : expenseRatio > 50 ? '支出适中' : '支出控制良好'}
            </p>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="可还款占收入比例" size="small">
            <Progress
              type="dashboard"
              percent={Math.min(100, availableRatio)}
              strokeColor={availableRatio > 50 ? '#52c41a' : availableRatio > 30 ? '#1890ff' : '#faad14'}
              format={(percent) => `${percent?.toFixed(1)}%`}
            />
            <p style={{ textAlign: 'center', color: '#666', marginTop: 8 }}>
              {availableRatio > 50 ? '还款能力强' : availableRatio > 30 ? '还款能力适中' : '还款能力较弱'}
            </p>
          </Card>
        </Col>
      </Row>

      <Card title="设置收入支出" size="small">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            monthlyIncome: incomeConfig.monthlyIncome,
            monthlyExpense: incomeConfig.monthlyExpense,
            extraIncome: incomeConfig.extraIncome || 0
          }}
          onValuesChange={handleValuesChange}
        >
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="monthlyIncome" label="月收入（元）" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="monthlyExpense" label="月固定支出（元）" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="extraIncome" label="额外收入/兼职（元）">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
          <p style={{ margin: 0, color: '#666' }}>
            <strong>可用于还款金额：</strong>
            <span style={{ color: '#1890ff', fontSize: 16, fontWeight: 600 }}>
              ¥{formatMoney(incomeConfig.availableForRepayment)}
            </span>
            <span style={{ marginLeft: 8, fontSize: 12 }}>
              = 月收入 - 月支出 + 额外收入
            </span>
          </p>
        </Form>
      </Card>
    </div>
  );
}
