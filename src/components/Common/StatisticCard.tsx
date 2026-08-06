import { Card, Statistic } from 'antd';
import { RADIUS, SPACING } from '../../styles/theme';

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
          transition: 'box-shadow 0.2s, transform 0.2s',
        },
      }}
      style={{
        borderRadius: RADIUS.lg,
        border: '1px solid #f0f0f0',
        height: '100%',
      }}
      hoverable
    >
      <Statistic
        title={title}
        value={value}
        precision={precision}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{
          fontSize: 24,
          fontWeight: 700,
          color: color || '#1a1a1a',
          ...valueStyle,
        }}
        formatter={formatter as any}
      />
    </Card>
  );
}