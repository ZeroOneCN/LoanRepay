import { useState } from 'react';
import { Layout, Menu, theme, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  WalletOutlined,
  BankOutlined,
  MoneyCollectOutlined,
  ThunderboltOutlined,
  SwapOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined
} from '@ant-design/icons';
import { AppProvider } from './context/AppContext';
import Dashboard from './components/Dashboard';
import DebtManager from './components/DebtManager';
import AssetManager from './components/AssetManager';
import IncomeManager from './components/IncomeManager';
import PlanEngine from './components/PlanEngine';
import DebtRestructure from './components/DebtRestructure';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

type MenuKey = 'dashboard' | 'debt' | 'asset' | 'income' | 'plan' | 'restructure';

function AppContent() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeKey, setActiveKey] = useState<MenuKey>(() => {
    const saved = localStorage.getItem('active_page');
    if (saved && ['dashboard', 'debt', 'asset', 'income', 'plan', 'restructure'].includes(saved)) {
      return saved as MenuKey;
    }
    return 'dashboard';
  });
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken();

  const handleMenuClick = (key: MenuKey) => {
    setActiveKey(key);
    localStorage.setItem('active_page', key);
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '财务总览'
    },
    {
      key: 'debt',
      icon: <WalletOutlined />,
      label: '债务管理'
    },
    {
      key: 'asset',
      icon: <BankOutlined />,
      label: '资产管理'
    },
    {
      key: 'income',
      icon: <MoneyCollectOutlined />,
      label: '收入支出'
    },
    {
      key: 'plan',
      icon: <ThunderboltOutlined />,
      label: '还款规划'
    },
    {
      key: 'restructure',
      icon: <SwapOutlined />,
      label: '债务重组'
    }
  ];

  const renderContent = () => {
    switch (activeKey) {
      case 'dashboard':
        return <Dashboard />;
      case 'debt':
        return <DebtManager />;
      case 'asset':
        return <AssetManager />;
      case 'income':
        return <IncomeManager />;
      case 'plan':
        return <PlanEngine />;
      case 'restructure':
        return <DebtRestructure />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        style={{ height: '100vh', overflowY: 'auto' }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0'
        }}>
          {collapsed ? (
            <ThunderboltOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          ) : (
            <Space>
              <ThunderboltOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}>还款管家</span>
            </Space>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key as MenuKey)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        <Header style={{
          padding: '0 24px',
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {collapsed ? (
              <MenuUnfoldOutlined onClick={() => setCollapsed(false)} style={{ fontSize: 18, cursor: 'pointer' }} />
            ) : (
              <MenuFoldOutlined onClick={() => setCollapsed(true)} style={{ fontSize: 18, cursor: 'pointer' }} />
            )}
            <Title level={5} style={{ margin: 0 }}>
              {menuItems.find(m => m.key === activeKey)?.label}
            </Title>
          </div>
          <div style={{ color: '#666', fontSize: 13 }}>
            还款管家
          </div>
        </Header>
        <Content style={{
          margin: '24px',
          padding: 24,
          flex: 1,
          overflowY: 'auto',
          background: colorBgContainer,
          borderRadius: borderRadiusLG
        }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
