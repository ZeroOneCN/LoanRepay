import { Card, Form, InputNumber, Row, Col, Statistic, Progress, Button, Divider, message } from 'antd';
import { DollarOutlined, ShoppingCartOutlined, BankOutlined, CalculatorOutlined, SaveOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { formatMoney } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import StatisticCard from '../Common/StatisticCard';
import { COLORS, FONT, SPACING } from '../../styles/theme';

interface IncomeFormValues {
  monthlyIncome: number;
  monthlyExpense: number;
  extraIncome?: number;
}

export default function IncomeManager() {
  const { incomeConfig, updateIncomeConfig, totalDebt } = useApp();
  const [form] = Form.useForm<IncomeFormValues>();

  const availableRatio = incomeConfig.monthlyIncome > 0
    ? (incomeConfig.availableForRepayment / incomeConfig.monthlyIncome) * 100
    : 0;

  const monthsToPayoff = incomeConfig.availableForRepayment > 0 && totalDebt > 0
    ? Math.ceil(totalDebt / incomeConfig.availableForRepayment)
    : Infinity;

  const expenseRatio = incomeConfig.monthlyIncome > 0
    ? (incomeConfig.monthlyExpense / incomeConfig.monthlyIncome) * 100
    : 0;

  // 计算实时预览值
  const getPreviewValues = (values: IncomeFormValues) => {
    const income = values.monthlyIncome || 0;
    const expense = values.monthlyExpense || 0;
    const extra = values.extraIncome || 0;
    const available = Math.max(0, income - expense + extra);
    const ratio = income > 0 ? (available / income) * 100 : 0;
    const months = available > 0 && totalDebt > 0 ? Math.ceil(totalDebt / available) : Infinity;
    return { available, ratio, months };
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const available = Math.max(0, values.monthlyIncome - values.monthlyExpense + (values.extraIncome || 0));
      await updateIncomeConfig({
        monthlyIncome: values.monthlyIncome,
        monthlyExpense: values.monthlyExpense,
        extraIncome: values.extraIncome || 0,
        availableForRepayment: available
      });
      message.success('收入支出配置保存成功');
    } catch (e) {
      console.error('Form validation failed:', e);
    }
  };

  return (
    <div>
      <PageHeader
        title="收入与支出"
        subtitle="设置你的月收入和固定支出，系统将自动计算可用于还款的金额"
      />

      {/* 统计卡片 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title="月收入"
            value={incomeConfig.monthlyIncome}
            precision={2}
            prefix={<DollarOutlined />}
            suffix="元"
            color={COLORS.success}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title="月支出"
            value={incomeConfig.monthlyExpense}
            precision={2}
            prefix={<ShoppingCartOutlined />}
            suffix="元"
            color={COLORS.danger}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title="可用于还款"
            value={incomeConfig.availableForRepayment}
            precision={2}
            prefix={<BankOutlined />}
            suffix="元"
            color={COLORS.primary}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title="预计还清时间"
            value={isFinite(monthsToPayoff) ? monthsToPayoff : '--'}
            prefix={<CalculatorOutlined />}
            suffix={isFinite(monthsToPayoff) ? '个月' : ''}
            color={COLORS.purple}
          />
        </Col>
      </Row>

      {/* 图表分析 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} md={12}>
          <Card title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>支出占比</span>} size="small">
            <Progress
              type="dashboard"
              percent={Math.min(100, expenseRatio)}
              strokeColor={expenseRatio > 70 ? COLORS.danger : expenseRatio > 50 ? COLORS.warning : COLORS.success}
              format={(percent) => `${percent?.toFixed(1)}%`}
            />
            <p style={{ textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.sm, fontSize: FONT.bodySmall }}>
              {expenseRatio > 70 ? '支出过高，建议压缩' : expenseRatio > 50 ? '支出适中' : '支出控制良好'}
            </p>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>可还款占收入比例</span>} size="small">
            <Progress
              type="dashboard"
              percent={Math.min(100, availableRatio)}
              strokeColor={availableRatio > 50 ? COLORS.success : availableRatio > 30 ? COLORS.primary : COLORS.warning}
              format={(percent) => `${percent?.toFixed(1)}%`}
            />
            <p style={{ textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.sm, fontSize: FONT.bodySmall }}>
              {availableRatio > 50 ? '还款能力强' : availableRatio > 30 ? '还款能力适中' : '还款能力较弱'}
            </p>
          </Card>
        </Col>
      </Row>

      {/* 设置表单 */}
      <Card title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>设置收入支出</span>} size="small">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            monthlyIncome: incomeConfig.monthlyIncome,
            monthlyExpense: incomeConfig.monthlyExpense,
            extraIncome: incomeConfig.extraIncome || 0
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="monthlyIncome" label="月收入（元）" rules={[{ required: true, message: '请输入月收入' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="如：15000" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="monthlyExpense" label="月固定支出（元）" rules={[{ required: true, message: '请输入月支出' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="如：8000" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="extraIncome" label="额外收入/兼职（元）">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="如：2000" />
              </Form.Item>
            </Col>
          </Row>

          {/* 实时预览 */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) =>
              prev.monthlyIncome !== cur.monthlyIncome ||
              prev.monthlyExpense !== cur.monthlyExpense ||
              prev.extraIncome !== cur.extraIncome
            }
          >
            {({ getFieldsValue }) => {
              const values = getFieldsValue() as IncomeFormValues;
              const preview = getPreviewValues(values);
              return (
                <div style={{ padding: SPACING.md, background: '#f6f8fa', borderRadius: 6, marginBottom: SPACING.md }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm }}>
                    <span style={{ fontSize: FONT.body, color: COLORS.textSecondary }}>
                      实时预览：
                    </span>
                    <span style={{ fontSize: FONT.body }}>
                      可用于还款：<strong style={{ color: COLORS.primary, fontSize: FONT.h1 }}>¥{formatMoney(preview.available)}</strong>
                    </span>
                    <span style={{ fontSize: FONT.bodySmall, color: COLORS.textTertiary }}>
                      可还款占比：{preview.ratio.toFixed(1)}% ｜
                      预计还清：{isFinite(preview.months) ? `${preview.months}个月` : '--'}
                    </span>
                  </div>
                </div>
              );
            }}
          </Form.Item>

          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: FONT.bodySmall, color: COLORS.textTertiary }}>
              当前可用：<strong style={{ color: COLORS.primary }}>¥{formatMoney(incomeConfig.availableForRepayment)}</strong>
              {' '}= 月收入 - 月支出 + 额外收入
            </span>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              保存配置
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}