import { Empty, Button } from 'antd';
import { SPACING, FONT, COLORS } from '../../styles/theme';

interface EmptyStateProps {
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export default function EmptyState({
  description = '暂无数据',
  actionText,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center' }}>
      <Empty
        image={icon || Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span style={{ fontSize: FONT.bodySmall, color: COLORS.textTertiary }}>
            {description}
          </span>
        }
      >
        {actionText && onAction && (
          <Button type="primary" onClick={onAction} style={{ marginTop: SPACING.sm }}>
            {actionText}
          </Button>
        )}
      </Empty>
    </div>
  );
}