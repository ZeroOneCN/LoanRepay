import { Card } from 'antd';
import { FONT, FONT_WEIGHT, COLORS, SPACING } from '../../styles/theme';

interface SectionCardProps {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}

export default function SectionCard({ title, extra, children, style, bodyStyle }: SectionCardProps) {
  return (
    <Card
      size="small"
      style={{
        borderRadius: 8,
        border: 'none',
        background: COLORS.bgCard,
        ...style,
      }}
      styles={{
        header: {
          fontSize: FONT.h2,
          fontWeight: FONT_WEIGHT.semiBold,
          color: COLORS.textPrimary,
          borderBottom: `1px solid ${COLORS.border}`,
          minHeight: 44,
          padding: `0 ${SPACING.lg}px`,
        },
        body: {
          padding: SPACING.lg,
          ...bodyStyle,
        },
      }}
      title={title}
      extra={extra}
    >
      {children}
    </Card>
  );
}
