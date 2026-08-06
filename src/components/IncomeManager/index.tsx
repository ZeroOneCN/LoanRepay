import { Card, Form, InputNumber, Row, Col, Progress, Button, message } from 'antd';
import { DollarOutlined, ShoppingCartOutlined, BankOutlined, SaveOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { formatMoney } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import StatisticCard from '../Common/StatisticCard';
import SectionCard from '../Common/SectionCard';
import { COLORS, FONT, SPACING, COMMON_STYLES } from '../../styles/theme';

interface IncomeFormValues {
  monthlyIncome: number;
  monthlyExpense: number;
  extraIncome?: number;
}

export default function IncomeManager() {
  const { incomeConfig, updateIncomeConfig, totalDebt } = useApp();
  const [form] = Form.useForm<IncomeFormValues>();

  const availableRatio = incomeConfig.monthlyIncome > 0
    ? (incomeConfig.availableForRepayment / incomeConfig.monthlyIncome) * 100 : 0;
  const expenseRatio = incomeConfig.monthlyIncome > 0
    ? (incomeConfig.monthlyExpense / incomeConfig.monthlyIncome) * 100 : 0;

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
      message.success('保存成功');
    } catch (e) { console.error('Form validation failed:', e); }
  };

  return (
    <div>
      <PageHeader title="收入与支出" subtitle="设置月收入和固定支出，系统自动计算可还款金额" />

      {/* 统计卡片 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={8}>
          <StatisticCard title="月收入" value={incomeConfig.monthlyIncome} precision={2} prefix={<DollarOutlined />} suffix="元" color={COLORS.success} />
        </Col>
        <Col xs={24} sm={8}>
          <StatisticCard title="月支出" value={incomeConfig.monthlyExpense} precision={2} prefix={<ShoppingCartOutlined />} suffix="元" color={COLORS.danger} />
        </Col>
        <Col xs={24} sm={8}>
          <StatisticCard title="可用于还款" value={incomeConfig.availableForRepayment} precision={2} prefix={<BankOutlined />} suffix="元" color={COLORS.primary} />
        </Col>
      </Row>

      {/* 指标条 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12}>
          <SectionCard title="支出占比">
            <Progress
              percent={Math.min(100, expenseRatio)}
              strokeColor={expenseRatio > 70 ? COLORS.danger : expenseRatio > 50 ? COLORS.warning : COLORS.success}
              format={() => `${expenseRatio.toFixed(1)}%`}
            />
            <div style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.sm }}>
              {expenseRatio > 70 ? '支出过高，建议压缩' : expenseRatio > 50 ? '支出适中' : '支出控制良好'}
            </div>
          </SectionCard>
        </Col>
        <Col xs={24} sm={12}>
          <SectionCard title="可还款占收入比">
            <Progress
              percent={Math.min(100, availableRatio)}
              strokeColor={availableRatio > 50 ? COLORS.success : availableRatio > 30 ? COLORS.primary : COLORS.warning}
              format={() => `${availableRatio.toFixed(1)}%`}
            />
            <div style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.sm }}>
              {availableRatio > 50 ? '还款能力强' : availableRatio > 30 ? '还款能力适中' : '还款能力较弱'}
            </div>
          </SectionCard>
        </Col>
      </Row>

      {/* 设置表单 */}
      <SectionCard
        title="设置收入支出"
        extra={<Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存配置</Button>}
      >
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
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.monthlyIncome !== cur.monthlyIncome || prev.monthlyExpense !== cur.monthlyExpense || prev.extraIncome !== cur.extraIncome}>
            {({ getFieldsValue }) => {
              const values = getFieldsValue() as IncomeFormValues;
              const preview = getPreviewValues(values);
              return (
                <div style={COMMON_STYLES.infoBar}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm }}>
                    <span style={{ fontSize: FONT.body, color: COLORS.textSecondary }}>实时预览</span>
                    <span style={{ fontSize: FONT.body }}>
                      可还款：<strong style={{ color: COLORS.primary, fontSize: FONT.h1 }}>¥{formatMoney(preview.available)}</strong>
                    </span>
                    <span style={{ fontSize: FONT.bodySmall, color: COLORS.textTertiary }}>
                      占比 {preview.ratio.toFixed(1)}% ｜ 预计还清 {isFinite(preview.months) ? `${preview.months}个月` : '--'}
                    </span>
                  </div>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </SectionCard>
    </div>
  );
}
