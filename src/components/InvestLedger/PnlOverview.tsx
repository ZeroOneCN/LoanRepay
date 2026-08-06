import { useMemo } from 'react';
import { Row, Col, Button, Empty, Tag, Space } from 'antd';
import { RiseOutlined, FallOutlined, DollarOutlined, PlusOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../../context/AppContext';
import { INVEST_MARKET_LABELS, InvestMarket, Currency, ProductType, PRODUCT_TYPE_LABELS } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';
import StatisticCard from '../Common/StatisticCard';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING } from '../../styles/theme';

const CURRENCY_SYMBOL: Record<Currency, string> = {
  CNY: '¥', USD: '$', HKD: 'HK$', USDT: '₮'
};

export default function PnlOverview({ onGotoRecords }: { onGotoRecords: () => void }) {
  const { pnlRecords, platforms, accounts, fxRates, convertCurrency, displayCurrency, convertToCNY } = useApp();

  const DC = displayCurrency;
  const dSym = CURRENCY_SYMBOL[DC] || '';
  // 转换到 displayCurrency 的简写
  const cur = (amount: number, from: Currency) => convertCurrency(amount, from, DC);

  const stats = useMemo(() => {
    const byCurrency: Record<Currency, number> = { CNY: 0, USD: 0, HKD: 0, USDT: 0 };
    pnlRecords.forEach(r => { byCurrency[r.currency] += r.pnl; });
    const totalDisplay = pnlRecords.reduce((sum, r) => sum + cur(r.pnl, r.currency), 0);
    const profitDisplay = pnlRecords.filter(r => r.pnl > 0).reduce((sum, r) => sum + cur(r.pnl, r.currency), 0);
    const lossDisplay = pnlRecords.filter(r => r.pnl < 0).reduce((sum, r) => sum + cur(r.pnl, r.currency), 0);
    return { byCurrency, totalDisplay, profitDisplay, lossDisplay };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pnlRecords, fxRates, DC]);

  // 按账户汇总（displayCurrency 口径），同时包含所属平台
  const byAccount = useMemo(() => {
    const map = new Map<string, { name: string; platformName: string; markets: InvestMarket[]; productTypes?: ProductType[]; pnlDisplay: number; recordCount: number }>();
    pnlRecords.forEach(r => {
      const acc = accounts.find(a => a.id === r.accountId);
      const pf = platforms.find(p => p.id === r.platformId) || platforms.find(p => p.id === acc?.platformId);
      const key = acc?.id || r.platformId || 'unknown';
      const accName = acc?.name || (pf ? `${pf.name}（旧数据）` : '未知账户');
      let mkts = pf?.markets;
      if (!mkts && (pf as any)?.market) mkts = [(pf as any).market];
      let pts = acc?.productTypes;
      if (!pts && (acc as any)?.productType) pts = [(acc as any).productType];
      const existing = map.get(key) || { name: accName, platformName: pf?.name || '未知', markets: Array.isArray(mkts) && mkts.length > 0 ? mkts : ['other'], productTypes: pts, pnlDisplay: 0, recordCount: 0 };
      existing.pnlDisplay += cur(r.pnl, r.currency);
      existing.recordCount += 1;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.pnlDisplay - a.pnlDisplay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pnlRecords, platforms, accounts, fxRates, DC]);

  // 按平台汇总
  const byPlatform = useMemo(() => {
    const map = new Map<string, { name: string; pnlDisplay: number }>();
    pnlRecords.forEach(r => {
      const acc = accounts.find(a => a.id === r.accountId);
      const pf = platforms.find(p => p.id === r.platformId) || platforms.find(p => p.id === acc?.platformId);
      const pid = pf?.id || r.platformId || 'unknown';
      const name = pf?.name || '未知平台';
      const existing = map.get(pid) || { name, pnlDisplay: 0 };
      existing.pnlDisplay += cur(r.pnl, r.currency);
      map.set(pid, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.pnlDisplay - a.pnlDisplay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pnlRecords, platforms, accounts, fxRates, DC]);

  // 按市场汇总：平台可多市场，记录计入其所属平台的全部市场（市场敞口口径）
  const byMarket = useMemo(() => {
    const map = new Map<InvestMarket, number>();
    pnlRecords.forEach(r => {
      const acc = accounts.find(a => a.id === r.accountId);
      const pf = platforms.find(p => p.id === r.platformId) || platforms.find(p => p.id === acc?.platformId);
      let mkts = pf?.markets;
      if (!mkts && (pf as any)?.market) mkts = [(pf as any).market];
      const arr: InvestMarket[] = Array.isArray(mkts) && mkts.length > 0 ? mkts : ['other'];
      const val = cur(r.pnl, r.currency);
      arr.forEach(m => map.set(m, (map.get(m) || 0) + val));
    });
    return Array.from(map.entries()).map(([market, value]) => ({ market, value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pnlRecords, platforms, accounts, fxRates, DC]);

  // 多市场下记录会重复计入多个市场，改用条形图展示市场敞口，避免饼图占比失真
  const marketBarOption = useMemo(() => {
    if (byMarket.length === 0) return {};
    const colorMap: Record<InvestMarket, string> = {
      crypto: COLORS.orange, us_stock: COLORS.primary, hk_stock: COLORS.purple, a_stock: COLORS.danger, other: COLORS.textTertiary
    };
    const sorted = [...byMarket].sort((a, b) => b.value - a.value);
    return {
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>${p[0].marker}${dSym}${formatMoney(p[0].value)}` },
      grid: { left: '3%', right: '8%', bottom: '3%', top: '8%', containLabel: true },
      xAxis: { type: 'value', axisLabel: { fontSize: 11, formatter: (v: number) => Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toFixed(0) } },
      yAxis: {
        type: 'category',
        data: sorted.map(d => INVEST_MARKET_LABELS[d.market]),
        axisLabel: { fontSize: 12 }
      },
      series: [{
        type: 'bar',
        data: sorted.map(d => ({
          value: Number(d.value.toFixed(2)),
          itemStyle: { color: d.value >= 0 ? colorMap[d.market] : COLORS.danger }
        })),
        barWidth: '50%',
        label: { show: true, position: 'right', fontSize: 11, formatter: (p: any) => `${dSym}${formatMoney(p.value)}` }
      }]
    };
  }, [byMarket, dSym]);

  const platformBarOption = useMemo(() => {
    if (byPlatform.length === 0) return {};
    return {
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}<br/>${p[0].marker}${dSym}${formatMoney(p[0].value)}` },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: byPlatform.map(p => p.name),
        axisLabel: { fontSize: 11, interval: 0, rotate: byPlatform.length > 4 ? 30 : 0 }
      },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => Math.abs(v) >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toFixed(0) } },
      series: [{
        type: 'bar',
        data: byPlatform.map(p => ({
          value: Number(p.pnlDisplay.toFixed(2)),
          itemStyle: { color: p.pnlDisplay >= 0 ? COLORS.success : COLORS.danger }
        }))
      }]
    };
  }, [byPlatform, dSym]);

  if (pnlRecords.length === 0) {
    return (
      <EmptyState
        description="暂无盈亏记录，请先在「平台管理」添加平台和账户，再到「盈亏记录」录入数据"
        actionText="去录入盈亏"
        onAction={onGotoRecords}
      />
    );
  }

  // 缺失汇率：哪些币种既有盈亏，又没配置汇率（折算 displayCurrency 会不准）
  const missingRates = (Object.keys(stats.byCurrency) as Currency[]).filter(
    c => stats.byCurrency[c] !== 0 && c !== 'CNY' && !fxRates.find(r => r.from === c)
  );
  // displayCurrency 本身非 CNY 但没汇率
  const missingDisplayRate = DC !== 'CNY' && !fxRates.find(r => r.from === DC);

  return (
    <div>
      {(missingRates.length > 0 || missingDisplayRate) && (
        <div style={{
          marginBottom: SPACING.lg, padding: SPACING.md,
          background: COLORS.bgWarningLight, borderRadius: 6,
          fontSize: FONT.bodySmall, color: COLORS.warning
        }}>
          {missingRates.length > 0 && (
            <div>缺少 {missingRates.join('、')} 汇率，折算数值可能不准确。</div>
          )}
          {missingDisplayRate && (
            <div>当前展示币种「{DC}」未配置汇率，请先到「汇率设置」补全。</div>
          )}
          <div style={{ marginTop: 2 }}>提示：到「汇率设置」配置汇率可让所有多币种统计更精准。</div>
        </div>
      )}

      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title={`累计总盈亏（${DC}）`}
            value={stats.totalDisplay}
            precision={2}
            prefix={stats.totalDisplay >= 0 ? <RiseOutlined /> : <FallOutlined />}
            suffix={DC}
            color={stats.totalDisplay >= 0 ? COLORS.success : COLORS.danger}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title={`累计盈利（${DC}）`}
            value={stats.profitDisplay}
            precision={2}
            prefix={<RiseOutlined />}
            suffix={DC}
            color={COLORS.success}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title={`累计亏损（${DC}）`}
            value={stats.lossDisplay}
            precision={2}
            prefix={<FallOutlined />}
            suffix={DC}
            color={COLORS.danger}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="盈亏记录数" value={pnlRecords.length} prefix={<DollarOutlined />} suffix="条" color={COLORS.primary} />
        </Col>
      </Row>

      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} md={12}>
          <SectionCard title={`各平台盈亏（${DC} 折算）`}>
            {byPlatform.length > 0 ? (
              <ReactECharts option={platformBarOption} style={{ height: 280 }} notMerge={true} />
            ) : (
              <Empty description="暂无平台数据" />
            )}
          </SectionCard>
        </Col>
        <Col xs={24} md={12}>
          <SectionCard
            title={`各市场盈亏（${DC} 敞口）`}
            extra={<span style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>多市场平台按各市场计入</span>}
          >
            {byMarket.length > 0 ? (
              <ReactECharts option={marketBarOption} style={{ height: 280 }} notMerge={true} />
            ) : (
              <Empty description="暂无市场数据" />
            )}
          </SectionCard>
        </Col>
      </Row>

      {/* 按账户明细 */}
      <SectionCard
        title={`各账户明细（${DC} 折算）`}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={onGotoRecords}>录入盈亏</Button>}
        style={{ marginBottom: SPACING.lg }}
      >
        {byAccount.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: SPACING.lg
          }}>
            {byAccount.map(a => (
              <div key={a.name + a.platformName} style={{
                padding: SPACING.lg, borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.bgLight
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm }}>
                  <div style={{ fontWeight: 500, fontSize: FONT.h3, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <Space size={4} wrap>
                    {a.markets.map(m => (
                      <Tag key={m} style={{ fontSize: FONT.caption, marginRight: 0 }}>{INVEST_MARKET_LABELS[m]}</Tag>
                    ))}
                  </Space>
                </div>
                <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary, marginBottom: SPACING.md }}>
                  {a.platformName}
                  {a.productTypes && a.productTypes.length > 0 && a.productTypes.map(pt => (
                    <Tag key={pt} color={pt === 'spot' ? 'green' : 'magenta'} style={{ marginLeft: 6 }}>
                      {PRODUCT_TYPE_LABELS[pt]}
                    </Tag>
                  ))}
                  <span style={{ marginLeft: 6 }}>· {a.recordCount} 条记录</span>
                </div>
                <div style={{
                  fontSize: FONT.h2, fontWeight: 600,
                  color: a.pnlDisplay >= 0 ? COLORS.success : COLORS.danger
                }}>
                  {a.pnlDisplay >= 0 ? '+' : ''}{dSym}{formatMoney(a.pnlDisplay)} {a.pnlDisplay >= 0 ? '' : ''}<span style={{ fontSize: FONT.bodySmall, fontWeight: 400 }}>{DC}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="暂无账户数据" />
        )}
      </SectionCard>

      <SectionCard title={`各币种原值（下方附≈ ${DC} 折算）`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.lg }}>
          {(Object.keys(stats.byCurrency) as Currency[]).map(c => (
            <div key={c} style={{ minWidth: 160, padding: SPACING.md, background: COLORS.bgLight, borderRadius: 6 }}>
              <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>{c}（原值）</div>
              <div style={{ fontSize: FONT.h2, fontWeight: 600, color: stats.byCurrency[c] >= 0 ? COLORS.success : COLORS.danger }}>
                {stats.byCurrency[c] >= 0 ? '+' : ''}{formatMoney(stats.byCurrency[c])}
              </div>
              {c !== DC && (
                <div style={{ fontSize: FONT.caption, color: COLORS.textSecondary, marginTop: 4 }}>
                  ≈ {dSym}{formatMoney(cur(stats.byCurrency[c], c))} {DC}
                </div>
              )}
              {c !== 'CNY' && DC !== 'CNY' && c !== DC && (
                <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary, marginTop: 2 }}>
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
