import { useMemo } from 'react';
import { Row, Col, Button, Empty } from 'antd';
import { RiseOutlined, FallOutlined, DollarOutlined, PlusOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../../context/AppContext';
import { INVEST_MARKET_LABELS, InvestMarket, Currency } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';
import StatisticCard from '../Common/StatisticCard';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING } from '../../styles/theme';

export default function PnlOverview({ onGotoRecords }: { onGotoRecords: () => void }) {
  const { pnlRecords, platforms, fxRates, convertToCNY } = useApp();

  const stats = useMemo(() => {
    // 各币种原值
    const byCurrency: Record<Currency, number> = { CNY: 0, USD: 0, HKD: 0, USDT: 0 };
    pnlRecords.forEach(r => { byCurrency[r.currency] += r.pnl; });

    // 折算 CNY
    const totalCNY = pnlRecords.reduce((sum, r) => sum + convertToCNY(r.pnl, r.currency), 0);
    const profitCNY = pnlRecords.filter(r => r.pnl > 0).reduce((sum, r) => sum + convertToCNY(r.pnl, r.currency), 0);
    const lossCNY = pnlRecords.filter(r => r.pnl < 0).reduce((sum, r) => sum + convertToCNY(r.pnl, r.currency), 0);

    return { byCurrency, totalCNY, profitCNY, lossCNY };
  }, [pnlRecords, fxRates]);

  // 按平台汇总（CNY 口径）
  const byPlatform = useMemo(() => {
    const map = new Map<string, { name: string; pnlCNY: number }>();
    pnlRecords.forEach(r => {
      const pf = platforms.find(p => p.id === r.platformId);
      const name = pf?.name || '未知平台';
      const existing = map.get(r.platformId) || { name, pnlCNY: 0 };
      existing.pnlCNY += convertToCNY(r.pnl, r.currency);
      map.set(r.platformId, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.pnlCNY - a.pnlCNY);
  }, [pnlRecords, platforms, fxRates]);

  // 按市场汇总（CNY 口径）
  const byMarket = useMemo(() => {
    const map = new Map<InvestMarket, number>();
    pnlRecords.forEach(r => {
      const pf = platforms.find(p => p.id === r.platformId);
      const market = (pf?.market || 'other') as InvestMarket;
      map.set(market, (map.get(market) || 0) + convertToCNY(r.pnl, r.currency));
    });
    return Array.from(map.entries()).map(([market, value]) => ({ market, value }));
  }, [pnlRecords, platforms, fxRates]);

  const marketPieOption = useMemo(() => {
    if (byMarket.length === 0) return {};
    const colorMap: Record<InvestMarket, string> = {
      crypto: COLORS.orange, us_stock: COLORS.primary, hk_stock: COLORS.purple, a_stock: COLORS.danger, other: COLORS.textTertiary
    };
    return {
      tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>¥${formatMoney(p.value)} (${p.percent}%)` },
      legend: { orient: 'horizontal', bottom: 0, textStyle: { fontSize: 12 }, itemWidth: 14, itemHeight: 10 },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        itemStyle: { borderRadius: 0, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: byMarket.map(d => ({
          name: INVEST_MARKET_LABELS[d.market],
          value: Number(d.value.toFixed(2)),
          itemStyle: { color: colorMap[d.market] }
        }))
      }]
    };
  }, [byMarket]);

  const platformBarOption = useMemo(() => {
    if (byPlatform.length === 0) return {};
    return {
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}<br/>${p[0].marker}¥${formatMoney(p[0].value)}` },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: byPlatform.map(p => p.name),
        axisLabel: { fontSize: 11, interval: 0, rotate: byPlatform.length > 4 ? 30 : 0 }
      },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toFixed(0) } },
      series: [{
        type: 'bar',
        data: byPlatform.map(p => ({
          value: Number(p.pnlCNY.toFixed(2)),
          itemStyle: { color: p.pnlCNY >= 0 ? COLORS.success : COLORS.danger }
        }))
      }]
    };
  }, [byPlatform]);

  if (pnlRecords.length === 0) {
    return (
      <EmptyState
        description="暂无盈亏记录，请先在「平台管理」添加平台，再到「盈亏记录」录入数据"
        actionText="去录入盈亏"
        onAction={onGotoRecords}
      />
    );
  }

  // 缺失汇率提示
  const missingRates = (Object.keys(stats.byCurrency) as Currency[]).filter(
    c => c !== 'CNY' && stats.byCurrency[c] !== 0 && !fxRates.find(r => r.from === c)
  );

  return (
    <div>
      {missingRates.length > 0 && (
        <div style={{
          marginBottom: SPACING.lg, padding: SPACING.md,
          background: COLORS.bgWarningLight, borderRadius: 6,
          fontSize: FONT.bodySmall, color: COLORS.warning
        }}>
          提示：检测到 {missingRates.join('、')} 币种的盈亏，但未设置对应汇率，折算 CNY 时按原值计算。请到「汇率设置」补全。
        </div>
      )}

      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计总盈亏（CNY）" value={stats.totalCNY} precision={2} prefix={stats.totalCNY >= 0 ? <RiseOutlined /> : <FallOutlined />} suffix="元" color={stats.totalCNY >= 0 ? COLORS.success : COLORS.danger} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计盈利（CNY）" value={stats.profitCNY} precision={2} prefix={<RiseOutlined />} suffix="元" color={COLORS.success} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计亏损（CNY）" value={stats.lossCNY} precision={2} prefix={<FallOutlined />} suffix="元" color={COLORS.danger} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="盈亏记录数" value={pnlRecords.length} prefix={<DollarOutlined />} suffix="条" color={COLORS.primary} />
        </Col>
      </Row>

      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} md={12}>
          <SectionCard title="各平台盈亏（CNY 折算）">
            {byPlatform.length > 0 ? (
              <ReactECharts option={platformBarOption} style={{ height: 280 }} notMerge={true} />
            ) : (
              <Empty description="暂无平台数据" />
            )}
          </SectionCard>
        </Col>
        <Col xs={24} md={12}>
          <SectionCard title="各市场占比">
            {byMarket.length > 0 ? (
              <ReactECharts option={marketPieOption} style={{ height: 280 }} notMerge={true} />
            ) : (
              <Empty description="暂无市场数据" />
            )}
          </SectionCard>
        </Col>
      </Row>

      <SectionCard
        title="各币种原值明细"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={onGotoRecords}>录入盈亏</Button>}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.lg }}>
          {(Object.keys(stats.byCurrency) as Currency[]).map(c => (
            <div key={c} style={{ minWidth: 140, padding: SPACING.md, background: COLORS.bgLight, borderRadius: 6 }}>
              <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>{c}</div>
              <div style={{ fontSize: FONT.h2, fontWeight: 600, color: stats.byCurrency[c] >= 0 ? COLORS.success : COLORS.danger }}>
                {stats.byCurrency[c] >= 0 ? '+' : ''}{formatMoney(stats.byCurrency[c])}
              </div>
              {c !== 'CNY' && (
                <div style={{ fontSize: FONT.caption, color: COLORS.textSecondary, marginTop: 4 }}>
                  ≈ ¥{formatMoney(convertToCNY(stats.byCurrency[c], c))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
