import { Card, Statistic } from 'antd';
import { COLORS, RADIUS, SPACING, FONT, FONT_WEIGHT } from '../../styles/theme';

interface StatisticCardProps {
  title: string;
  value: number | string;
  precision?: number;
  prefix?: React.ReactNode;
  suffix?: string;
  valueStyle?: React.CSSProperties;
  color?: string;
  formatter?: (value: number | string) => React.ReactNode;
}

export default function StatisticCard({
  title,
  value,
  precision,
  prefix,
  suffix,
  valueStyle,
  color,
  formatter,
}: StatisticCardProps) {
  return (
    <Card
      size="small"
      styles={{
        body: {
          padding: SPACING.lg,
        },
      }}
      style={{
        borderRadius: RADIUS.lg,
        border: 'none',
        background: COLORS.bgLight,
        height: '100%',
        transition: 'background 0.2s',
      }}
      hoverable={false}
    >
      <Statistic
        title={title}
        value={value}
        precision={precision}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{
          fontSize: FONT.statistic,
          fontWeight: FONT_WEIGHT.bold,
          color: color || COLORS.textPrimary,
          ...valueStyle,
        }}
        formatter={formatter as any}
      />
    </Card>
  );
}
