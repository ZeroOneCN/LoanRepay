/** 设计令牌 - 统一字体大小体系 */
export const FONT = {
  h1: '20px',        // 页面标题
  h2: '16px',        // 卡片标题
  h3: '14px',        // 区块子标题
  body: '14px',      // 正文
  bodySmall: '13px', // 辅助文字
  caption: '12px',   // 标注/提示
  statistic: '24px', // 统计数值
  tableHeader: '14px', // 表头
  tableCell: '13px',  // 表格内容
  tag: '12px',        // 标签
} as const;

/** 设计令牌 - 统一字重 */
export const FONT_WEIGHT = {
  normal: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
} as const;

/** 设计令牌 - 统一颜色 */
export const COLORS = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#1677ff',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textTertiary: '#999999',
  border: '#f0f0f0',
  bgPage: '#f5f5f5',
  bgCard: '#ffffff',
  bgLight: '#fafafa',
  bgPrimaryLight: '#e6f4ff',
  bgSuccessLight: '#f6ffed',
  bgWarningLight: '#fffbe6',
  bgDangerLight: '#fff2f0',
  // 语义色快捷引用
  green: '#52c41a',
  red: '#ff4d4f',
  blue: '#1677ff',
  orange: '#faad14',
  purple: '#722ed1',
} as const;

/** 卡片阴影 */
export const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)';

/** 设计令牌 - 统一间距 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** 设计令牌 - 统一圆角 */
export const RADIUS = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
} as const;

/** 通用样式辅助 */
export const COMMON_STYLES = {
  pageTitle: {
    fontSize: FONT.h1,
    fontWeight: FONT_WEIGHT.semiBold,
    color: COLORS.textPrimary,
    margin: 0,
  } as React.CSSProperties,
  pageSubtitle: {
    fontSize: FONT.bodySmall,
    color: COLORS.textSecondary,
    margin: '4px 0 0 0',
  } as React.CSSProperties,
  statValue: {
    fontSize: FONT.statistic,
    fontWeight: FONT_WEIGHT.bold,
  } as React.CSSProperties,
  sectionHeader: {
    fontSize: FONT.h2,
    fontWeight: FONT_WEIGHT.semiBold,
    color: COLORS.textPrimary,
    margin: 0,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: FONT.h2,
    fontWeight: FONT_WEIGHT.semiBold,
  } as React.CSSProperties,
  helperText: {
    fontSize: FONT.caption,
    color: COLORS.textTertiary,
  } as React.CSSProperties,
  moneyRed: {
    color: COLORS.danger,
    fontWeight: FONT_WEIGHT.medium,
  } as React.CSSProperties,
  moneyGreen: {
    color: COLORS.success,
    fontWeight: FONT_WEIGHT.medium,
  } as React.CSSProperties,
  moneyBlue: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  } as React.CSSProperties,
  /** 扁平化信息条 */
  infoBar: {
    padding: SPACING.md,
    background: COLORS.bgLight,
    borderRadius: RADIUS.md,
  } as React.CSSProperties,
  /** 扁平化指标行 */
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${SPACING.sm}px 0`,
  } as React.CSSProperties,
  formatMoney: (val: number, color?: string): React.CSSProperties => ({
    color: color || COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.medium,
  }),
  /** 卡片容器 */
  cardContainer: {
    borderRadius: RADIUS.lg,
    border: 'none',
    background: COLORS.bgCard,
    boxShadow: CARD_SHADOW,
  } as React.CSSProperties,
} as const;