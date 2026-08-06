import { Space, Typography } from 'antd';
import { COMMON_STYLES, SPACING } from '../../styles/theme';

const { Text } = Typography;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.lg,
      }}
    >
      <Space direction="vertical" size={2}>
        <h1 style={COMMON_STYLES.pageTitle}>{title}</h1>
        {subtitle && <Text style={COMMON_STYLES.pageSubtitle}>{subtitle}</Text>}
      </Space>
      {extra && <div>{extra}</div>}
    </div>
  );
}